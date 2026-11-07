import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const origins = (Deno.env.get("CORS_ALLOWED_ORIGINS") || "https://rmrdc-cas.netlify.app,http://localhost:5500,http://127.0.0.1:5500,http://localhost:5501,http://127.0.0.1:5501")
  .split(",").map((value) => value.trim()).filter(Boolean);

function cors(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": origins.includes(origin) ? origin : "null",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cas-cron-secret",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[char] || char));
}

function normalizeAreas(value: unknown): string[] {
  const values = Array.isArray(value) ? value : String(value || "").split(",");
  return [...new Set(values.map((area) => String(area).trim().toLowerCase()).filter(Boolean))];
}

function campaignHtml(name: string, body: string, unsubscribeUrl: string) {
  return `<div style="font-family:Arial,sans-serif;line-height:1.65;color:#153321;max-width:680px;margin:auto">
    <div style="white-space:pre-wrap">${escapeHtml(body).replace(/\n/g, "<br>")}</div>
    <hr style="border:0;border-top:1px solid #dce8df;margin:28px 0 14px">
    <p style="font-size:12px;color:#64736a">${escapeHtml(name)} · RMRDC Digital Library</p>
    <p style="font-size:12px;color:#64736a"><a href="${escapeHtml(unsubscribeUrl)}">Unsubscribe from publication emails</a></p>
  </div>`;
}

async function sendEmail(to: string, subject: string, html: string, unsubscribeUrl?: string, idempotencyKey?: string) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) throw new Error("RESEND_API_KEY is not configured.");
  const from = Deno.env.get("CAS_CAMPAIGN_FROM_EMAIL") || Deno.env.get("NOTIFICATION_FROM_EMAIL") || "RMRDC Digital Library <onboarding@resend.dev>";
  const headers: Record<string, string> = {};
  if (unsubscribeUrl) {
    headers["List-Unsubscribe"] = `<${unsubscribeUrl}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`, "Content-Type": "application/json",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: JSON.stringify({ from, to: [to], subject, html, ...(Object.keys(headers).length ? { headers } : {}) }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || data?.name || `Resend failed with status ${response.status}`);
  return data;
}

async function sendBatch(admin: ReturnType<typeof createClient>, campaignId?: string) {
  const now = new Date().toISOString();
  let campaignsQuery = admin.from("cas_email_campaigns").select("*")
    .in("status", ["queued", "sending"]).lte("scheduled_at", now)
    .order("scheduled_at", { ascending: true }).limit(campaignId ? 1 : 5);
  if (campaignId) campaignsQuery = campaignsQuery.eq("id", campaignId);
  const { data: campaigns, error: campaignsError } = await campaignsQuery;
  if (campaignsError) throw campaignsError;

  let handled = 0;
  for (const campaign of campaigns || []) {
    await admin.from("cas_email_campaigns").update({ status: "sending", started_at: campaign.started_at || now }).eq("id", campaign.id);
    const staleCutoff = new Date(Date.now() - 10 * 60_000).toISOString();
    await admin.from("cas_email_campaign_recipients").update({
      status: "failed", next_attempt_at: now, claimed_at: null,
      error_message: "Recovered an interrupted delivery attempt; safe to retry.",
    }).eq("campaign_id", campaign.id).eq("status", "sending").lt("claimed_at", staleCutoff);
    const { data: dueRows, error: rowsError } = await admin.from("cas_email_campaign_recipients")
      .select("id, subscriber_id, email, unsubscribe_token, status, attempt_count")
      .eq("campaign_id", campaign.id).in("status", ["pending", "failed"])
      .lt("attempt_count", 3).lte("next_attempt_at", now)
      .order("id", { ascending: true }).limit(25);
    if (rowsError) throw rowsError;

    for (const row of dueRows || []) {
      const claimed = await admin.from("cas_email_campaign_recipients")
        .update({ status: "sending", attempt_count: row.attempt_count + 1, claimed_at: now, error_message: null })
        .eq("id", row.id).eq("status", row.status).select("id").maybeSingle();
      if (claimed.error) throw claimed.error;
      if (!claimed.data) continue;

      const { data: subscriber, error: subscriberError } = await admin.from("research_subscribers")
        .select("email, is_active, email_notifications, admin_email_enabled, unsubscribe_token")
        .eq("id", row.subscriber_id).maybeSingle();
      if (subscriberError) throw subscriberError;
      if (!subscriber || !subscriber.is_active || subscriber.email_notifications === false ||
        subscriber.admin_email_enabled === false || !subscriber.email || subscriber.email.toLowerCase() !== row.email.toLowerCase()) {
        await admin.from("cas_email_campaign_recipients").update({ status: "skipped", claimed_at: null, error_message: "Subscriber is no longer eligible for email." }).eq("id", row.id);
        handled += 1;
        continue;
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const unsubscribeUrl = `${supabaseUrl}/functions/v1/cas-email-unsubscribe?token=${encodeURIComponent(String(subscriber.unsubscribe_token))}`;
      try {
        const result = await sendEmail(row.email, campaign.subject, campaignHtml(campaign.campaign_name, campaign.body_text, unsubscribeUrl), unsubscribeUrl, `cas-campaign/${campaign.id}/${row.subscriber_id}`);
        await admin.from("cas_email_campaign_recipients").update({
          status: "sent", claimed_at: null, sent_at: new Date().toISOString(), provider_message_id: result?.id || null,
          error_message: null,
        }).eq("id", row.id);
        if (result?.id) {
          const { error: reconcileError } = await admin.rpc("reconcile_cas_email_webhook_events", { p_email_id: String(result.id) });
          if (reconcileError) console.error("Could not reconcile early Resend event:", reconcileError.message);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const delayMinutes = row.attempt_count === 0 ? 1 : row.attempt_count === 1 ? 10 : 60;
        await admin.from("cas_email_campaign_recipients").update({
          status: "failed", claimed_at: null, error_message: message,
          next_attempt_at: new Date(Date.now() + delayMinutes * 60_000).toISOString(),
        }).eq("id", row.id);
      }
      handled += 1;
    }

    const [pending, sending, sent, failed] = await Promise.all([
      admin.from("cas_email_campaign_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", campaign.id).eq("status", "pending"),
      admin.from("cas_email_campaign_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", campaign.id).eq("status", "sending"),
      admin.from("cas_email_campaign_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", campaign.id).eq("status", "sent"),
      admin.from("cas_email_campaign_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", campaign.id).eq("status", "failed"),
    ]);
    const pendingCount = pending.count || 0;
    const sendingCount = sending.count || 0;
    const sentCount = sent.count || 0;
    const failedCount = failed.count || 0;
    const { count: skippedCount } = await admin.from("cas_email_campaign_recipients")
      .select("id", { count: "exact", head: true }).eq("campaign_id", campaign.id).eq("status", "skipped");
    const finished = pendingCount === 0 && sendingCount === 0 && failedCount === 0;
    const retriesRemain = await admin.from("cas_email_campaign_recipients")
      .select("id", { count: "exact", head: true }).eq("campaign_id", campaign.id).eq("status", "failed").lt("attempt_count", 3);
    const nextStatus = finished ? (sentCount > 0 || (skippedCount || 0) > 0 ? "sent" : "failed")
      : ((retriesRemain.count || 0) > 0 ? "queued" : "partial");
    await admin.from("cas_email_campaigns").update({
      status: nextStatus, sent_count: sentCount, skipped_count: skippedCount || 0,
      failed_count: failedCount, completed_at: finished ? new Date().toISOString() : null,
    }).eq("id", campaign.id);
  }
  return { campaigns_processed: campaigns?.length || 0, recipients_processed: handled };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  const headers = { ...cors(req), "Content-Type": "application/json" };
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const body = await req.json();
    const action = String(body.action || "");
    const cronSecret = Deno.env.get("CAS_CAMPAIGN_CRON_SECRET") || "";
    const cronAuthorized = Boolean(cronSecret) && req.headers.get("x-cas-cron-secret") === cronSecret;

    let userId: string | null = null;
    if (!cronAuthorized) {
      const authHeader = req.headers.get("Authorization") || "";
      const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
      const { data: authData, error: authError } = await userClient.auth.getUser();
      if (authError || !authData?.user) throw new Error("Not authenticated.");
      const { data: profile, error: profileError } = await admin.from("profiles").select("role").eq("id", authData.user.id).maybeSingle();
      if (profileError || !["admin", "editor"].includes(profile?.role)) throw new Error("Only admin/editor users can manage CAS campaigns.");
      userId = authData.user.id;
    }

    if (action === "process_due") {
      if (!cronAuthorized && !userId) throw new Error("Not authorized to process the campaign queue.");
      return new Response(JSON.stringify({ success: true, ...(await sendBatch(admin, body.campaign_id || undefined)) }), { headers });
    }
    if (cronAuthorized) throw new Error("Scheduled processing credentials cannot create or test campaigns.");

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (action === "send_test") {
      const email = String(body.email || "").trim().toLowerCase();
      const subject = String(body.subject || "").trim();
      const message = String(body.message || "").trim();
      const name = String(body.campaign_name || "RMRDC CAS test").trim();
      if (!resendKey) throw new Error("RESEND_API_KEY is not configured.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid test email address.");
      if (!subject || !message) throw new Error("Enter an email subject and message before sending a test.");
      const html = `<div style="font-family:Arial,sans-serif;line-height:1.65;color:#153321;max-width:680px;margin:auto"><div style="white-space:pre-wrap">${escapeHtml(message).replace(/\n/g, "<br>")}</div><hr><p style="font-size:12px;color:#64736a">${escapeHtml(name)} · RMRDC Digital Library (test email)</p></div>`;
      const result = await sendEmail(email, `[TEST] ${subject}`, html);
      return new Response(JSON.stringify({ success: true, message_id: result?.id || null }), { headers });
    }

    if (action === "retry_failed") {
      if (!resendKey) throw new Error("RESEND_API_KEY is not configured.");
      const campaignId = String(body.campaign_id || "");
      if (!campaignId) throw new Error("Campaign ID is required.");
      const { data: campaign, error: campaignError } = await admin.from("cas_email_campaigns")
        .select("id, status").eq("id", campaignId).maybeSingle();
      if (campaignError) throw campaignError;
      if (!campaign || !["partial", "failed"].includes(campaign.status)) throw new Error("This campaign has no completed failed deliveries to retry.");
      const { data: resetRows, error: resetError } = await admin.from("cas_email_campaign_recipients")
        .update({ status: "pending", attempt_count: 0, next_attempt_at: new Date().toISOString(), claimed_at: null, error_message: null })
        .eq("campaign_id", campaignId).eq("status", "failed").select("id");
      if (resetError) throw resetError;
      if (!resetRows?.length) throw new Error("There are no failed recipients to retry.");
      const { error: updateCampaignError } = await admin.from("cas_email_campaigns")
        .update({ status: "queued", failed_count: 0, completed_at: null }).eq("id", campaignId);
      if (updateCampaignError) throw updateCampaignError;
      EdgeRuntime.waitUntil(sendBatch(admin, campaignId).catch((error) => console.error("CAS campaign retry failed:", error)));
      return new Response(JSON.stringify({ success: true, retried: resetRows.length }), { headers });
    }

    if (action === "create_campaign") {
      const campaignName = String(body.campaign_name || "").trim();
      const subject = String(body.subject || "").trim();
      const bodyText = String(body.message || "").trim();
      const audienceMode = String(body.audience_mode || "");
      const areas = normalizeAreas(body.areas);
      const selectedIds = [...new Set((Array.isArray(body.subscriber_ids) ? body.subscriber_ids : []).map(String))];
      if (!campaignName || !subject || !bodyText) throw new Error("Campaign name, subject, and message are required.");
      if (!resendKey) throw new Error("RESEND_API_KEY is not configured.");
      if (!['all', 'areas', 'selected'].includes(audienceMode)) throw new Error("Choose a valid recipient group.");
      if (audienceMode === "areas" && !areas.length) throw new Error("Choose at least one research area.");
      if (audienceMode === "selected" && !selectedIds.length) throw new Error("Choose at least one individual recipient.");
      const scheduledAt = body.scheduled_at ? new Date(body.scheduled_at) : new Date();
      if (!Number.isFinite(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now() - 60_000) throw new Error("Choose a valid future delivery time.");

      const subscribers: Array<Record<string, unknown>> = [];
      for (let from = 0; ; from += 500) {
        const { data, error } = await admin.from("research_subscribers")
          .select("id, email, unsubscribe_token, research_areas")
          .eq("is_active", true).eq("email_notifications", true).eq("admin_email_enabled", true)
          .not("email", "is", null).range(from, from + 499);
        if (error) throw error;
        subscribers.push(...(data || []));
        if ((data || []).length < 500) break;
      }
      let eligible = subscribers.filter((sub) => String(sub.email || "").trim());
      if (audienceMode === "areas") {
        eligible = eligible.filter((sub) => normalizeAreas(sub.research_areas).some((area) => areas.includes(area)));
      } else if (audienceMode === "selected") {
        const idSet = new Set(selectedIds);
        eligible = eligible.filter((sub) => idSet.has(String(sub.id)));
      }
      if (!eligible.length) throw new Error("No eligible subscribers match this audience. Check subscriber opt-ins and research interests.");

      const { data: campaign, error: campaignError } = await admin.from("cas_email_campaigns").insert({
        campaign_name: campaignName, subject, body_text: bodyText, audience_mode: audienceMode,
        audience_areas: audienceMode === "areas" ? areas : [], scheduled_at: scheduledAt.toISOString(),
        status: "queued", recipient_count: eligible.length, created_by: userId,
      }).select("id").single();
      if (campaignError) throw campaignError;
      for (let from = 0; from < eligible.length; from += 250) {
        const batch = eligible.slice(from, from + 250).map((sub) => ({
          campaign_id: campaign.id, subscriber_id: sub.id, email: sub.email,
          unsubscribe_token: sub.unsubscribe_token, status: "pending",
        }));
        const { error } = await admin.from("cas_email_campaign_recipients").insert(batch);
        if (error) {
          await admin.from("cas_email_campaigns").update({ status: "failed", failed_count: eligible.length }).eq("id", campaign.id);
          throw error;
        }
      }
      if (scheduledAt.getTime() <= Date.now() + 60_000) {
        EdgeRuntime.waitUntil(sendBatch(admin, campaign.id).catch((error) => console.error("CAS campaign batch failed:", error)));
      }
      return new Response(JSON.stringify({ success: true, campaign_id: campaign.id, recipient_count: eligible.length, scheduled_at: scheduledAt.toISOString(), status: "queued" }), { headers });
    }
    throw new Error("Unknown campaign action.");
  } catch (error) {
    console.error("CAS email campaign request failed:", error);
    return new Response(JSON.stringify({ success: false, error: "The campaign request could not be completed. Please try again later." }), { status: 400, headers });
  }
});
