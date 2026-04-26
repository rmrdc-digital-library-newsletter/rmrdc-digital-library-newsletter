import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function normalizeSiteUrl(value: string | undefined) {
  return (value || "").replace(/\/$/, "");
}

function normalizeAreas(value: unknown): string[] {
  if (Array.isArray(value)) {
    return [...new Set(value.map((v) => String(v).trim().toLowerCase()).filter(Boolean))];
  }
  return [...new Set(String(value || "").split(",").map((v) => v.trim().toLowerCase()).filter(Boolean))];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;
    const fromEmail = Deno.env.get("NOTIFICATION_FROM_EMAIL") || "RMRDC Digital Library <onboarding@resend.dev>";
    const siteUrl = normalizeSiteUrl(Deno.env.get("SITE_URL"));

    if (!resendApiKey) throw new Error("RESEND_API_KEY is not set in Supabase secrets.");

    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData?.user) throw new Error("Not authenticated.");

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (profileError || !["admin", "editor"].includes(profile?.role)) {
      throw new Error("Only admin/editor users can send publication emails.");
    }

    const body = await req.json();
    const incomingPublication = body.publication || null;
    const publicationId = body.publication_id || incomingPublication?.id;
    if (!publicationId) throw new Error("publication.id or publication_id is required.");

    const { data: publication, error: pubError } = await adminClient
      .from("publications")
      .select("id, title, authors, type, year, abstract, research_areas, price, is_paid, preview_url, pdf_url")
      .eq("id", publicationId)
      .single();
    if (pubError) throw pubError;

    const publicationAreas = normalizeAreas(publication.research_areas);
    if (!publicationAreas.length) {
      return new Response(JSON.stringify({ success: true, matched: 0, sent: 0, warning: "Publication has no research areas." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: subscribers, error: subscriberError } = await adminClient
      .from("research_subscribers")
      .select("id, full_name, email, organisation, research_areas, is_active")
      .eq("is_active", true);
    if (subscriberError) throw subscriberError;

    const matched = (subscribers || []).filter((subscriber) => {
      const subscriberAreas = normalizeAreas(subscriber.research_areas);
      return subscriberAreas.some((area) => publicationAreas.includes(area));
    });

    let sent = 0;
    const errors: Array<{ email: string; message: string }> = [];
    const viewUrl = siteUrl ? `${siteUrl}/viewer.html?id=${publication.id}` : (publication.preview_url || publication.pdf_url || "");

    for (const subscriber of matched) {
      const subscriberAreas = normalizeAreas(subscriber.research_areas);
      const matchedAreas = subscriberAreas.filter((area) => publicationAreas.includes(area));
      const paidText = publication.is_paid || Number(publication.price || 0) > 0
        ? "This is a paid publication. You may preview it online, then subscribe or visit the library for the full copy."
        : "This publication is available to read online.";

      const html = `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#153321;max-width:680px">
          <h2 style="color:#0f5a2d;margin-bottom:8px">New RMRDC publication in your research area</h2>
          <p>Dear ${subscriber.full_name || "Researcher"},</p>
          <p>A new publication has been added to the RMRDC Digital Library that matches your research preferences.</p>
          <h3 style="margin-bottom:4px">${publication.title}</h3>
          <p><strong>Authors:</strong> ${publication.authors || "N/A"}<br>
          <strong>Type:</strong> ${publication.type || "Publication"}<br>
          <strong>Year:</strong> ${publication.year || "N/A"}<br>
          <strong>Matched area(s):</strong> ${matchedAreas.join(", ") || "Your selected preferences"}</p>
          <p>${publication.abstract || ""}</p>
          <p>${paidText}</p>
          ${viewUrl ? `<p><a href="${viewUrl}" style="display:inline-block;background:#0f5a2d;color:#ffffff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:bold">Open publication</a></p>` : ""}
          <p style="color:#5c6f63;font-size:13px">RMRDC Digital Library</p>
        </div>`;

      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [subscriber.email],
            subject: `New RMRDC publication: ${publication.title}`,
            html,
          }),
        });

        if (!response.ok) {
          const detail = await response.text();
          throw new Error(detail || `Resend failed with status ${response.status}`);
        }

        await adminClient.from("publication_notifications").upsert({
          publication_id: publication.id,
          subscriber_id: subscriber.id,
          email: subscriber.email,
          status: "sent",
          sent_at: new Date().toISOString(),
          error_message: null,
        }, { onConflict: "publication_id,subscriber_id" });

        sent += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push({ email: subscriber.email, message });
        await adminClient.from("publication_notifications").upsert({
          publication_id: publication.id,
          subscriber_id: subscriber.id,
          email: subscriber.email,
          status: "failed",
          error_message: message,
        }, { onConflict: "publication_id,subscriber_id" });
      }
    }

    return new Response(JSON.stringify({ success: true, matched: matched.length, sent, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
