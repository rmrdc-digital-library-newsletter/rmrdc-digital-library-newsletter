const corsHeaders = {
  "Access-Control-Allow-Origin": (Deno.env.get("CORS_ALLOWED_ORIGINS") || "*").split(",")[0].trim(),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const escapeHtml = (value: unknown) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const staffEmails = () => (Deno.env.get("RMRDC_STAFF_EMAILS") || Deno.env.get("ADMIN_EMAIL") || "")
  .split(",").map(email => email.trim().toLowerCase()).filter(Boolean);

async function sendEmail(to: string[], subject: string, html: string) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key || !to.length) return { skipped: true };
  const from = Deno.env.get("NOTIFICATION_FROM_EMAIL") || "RMRDC Research-to-Industry <onboarding@resend.dev>";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!response.ok) throw new Error(await response.text());
  return await response.json();
}

async function resolveEmails(client: any, profiles: Array<{ id: string }>) {
  const users = await Promise.all(profiles.map(async profile => {
    const result = await client.auth.admin.getUserById(profile.id);
    return { id: profile.id, email: result.data?.user?.email || "" };
  }));
  return users.filter(user => user.email);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !serviceKey || !anonKey) return json({ error: "The notification service is temporarily unavailable." }, 500);

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const authClient = createClient(url, anonKey, {
      global: { headers: { Authorization: request.headers.get("Authorization") || "" } },
    });
    const serviceClient = createClient(url, serviceKey);
    const { data: authData } = await authClient.auth.getUser();
    const actor = authData.user;
    if (!actor) return json({ error: "Authentication required." }, 401);

    const body = await request.json();
    const event = String(body.event || "");
    const opportunityId = String(body.opportunity_id || "");
    if (!["submitted", "approved"].includes(event) || !opportunityId) {
      return json({ error: "event and opportunity_id are required." }, 400);
    }

    const { data: opportunity, error: opportunityError } = await serviceClient
      .from("technology_opportunities")
      .select("id,title,sector,trl,short_summary,created_by,approved_by,approved_at,visibility")
      .eq("id", opportunityId).single();
    if (opportunityError || !opportunity) return json({ error: "Technology opportunity not found." }, 404);

    const { data: actorProfile } = await serviceClient.from("profiles").select("id,role").eq("id", actor.id).maybeSingle();
    const isStaff = ["admin", "editor"].includes(actorProfile?.role);
    if (event === "submitted" && opportunity.created_by !== actor.id) return json({ error: "Only the submitting researcher can send this event." }, 403);
    if (event === "approved" && !isStaff) return json({ error: "Only RMRDC staff can send approval events." }, 403);

    const { data: staffProfiles } = await serviceClient.from("profiles").select("id,role").in("role", ["admin", "editor"]);
    const staff = await resolveEmails(serviceClient, staffProfiles || []);
    const staffIds = (staff || []).map(person => person.id).filter(Boolean);
    const title = escapeHtml(opportunity.title);
    const sector = escapeHtml(opportunity.sector || "Not specified");
    const trl = opportunity.trl ? `TRL ${opportunity.trl}` : "TRL not specified";

    if (event === "submitted") {
      if (staffIds.length) {
        await serviceClient.from("platform_notifications").insert(staffIds.map(userId => ({
          user_id: userId,
          notification_type: "technology_submitted",
          title: "New technology awaiting review",
          message: `${opportunity.title} was submitted by a researcher and is ready for RMRDC approval.`,
          link_url: "admin/technology-opportunities.html",
          entity_type: "technology_opportunity",
          entity_id: opportunity.id,
        })));
      }
      const html = `<div style="font-family:Arial,sans-serif;max-width:640px;color:#173d30"><div style="background:#075c36;padding:22px 26px;color:#fff"><strong style="font-size:18px">RMRDC Research-to-Industry</strong><div style="margin-top:5px;opacity:.82">Technology review request</div></div><div style="padding:26px"><h2 style="margin:0 0 10px">New technology submitted for approval</h2><p>A researcher has submitted a technology profile for RMRDC review.</p><table style="border-collapse:collapse;width:100%;margin:20px 0"><tr><td style="padding:9px 0;color:#68776f">Technology</td><td style="padding:9px 0;font-weight:bold">${title}</td></tr><tr><td style="padding:9px 0;color:#68776f">Sector</td><td style="padding:9px 0">${sector}</td></tr><tr><td style="padding:9px 0;color:#68776f">Readiness</td><td style="padding:9px 0">${trl}</td></tr></table><a href="${Deno.env.get("ADMIN_PORTAL_URL") || "https://rmrdc.gov.ng/admin/technology-opportunities.html"}" style="display:inline-block;background:#075c36;color:#fff;padding:12px 16px;text-decoration:none;border-radius:6px">Open review queue</a><p style="font-size:12px;color:#68776f;margin-top:24px">Review the evidence, commercial details and disclosure permissions before approving publication.</p></div></div>`;
      await sendEmail([...new Set([...staffEmails(), ...staff.map(person => person.email)])], `Review required: ${opportunity.title}`, html);
      return json({ ok: true, event, notified_staff: staffIds.length });
    }

    const { data: investorProfiles } = await serviceClient.from("profiles").select("id,role").eq("role", "investor");
    const investors = await resolveEmails(serviceClient, investorProfiles || []);
    const investorIds = (investors || []).map(investor => investor.id).filter(Boolean);
    if (investorIds.length) {
      await serviceClient.from("platform_notifications").insert(investorIds.map(userId => ({
        user_id: userId,
        notification_type: "technology_approved",
        title: "New RMRDC technology opportunity",
        message: `${opportunity.title} has been approved and is now available for investor discovery.`,
        link_url: "investor-portal.html#discover",
        entity_type: "technology_opportunity",
        entity_id: opportunity.id,
      })));
    }
    const html = `<div style="font-family:Arial,sans-serif;max-width:640px;color:#173d30"><div style="background:#075c36;padding:22px 26px;color:#fff"><strong style="font-size:18px">RMRDC Research-to-Industry</strong><div style="margin-top:5px;opacity:.82">Investor opportunity alert</div></div><div style="padding:26px"><div style="display:inline-block;background:#e7f5eb;color:#087244;padding:6px 10px;border-radius:20px;font-size:12px;font-weight:bold">RMRDC APPROVED</div><h2 style="margin:16px 0 10px">A new technology matches your investment interests</h2><p>${title} has completed RMRDC review and is now available for investor discovery.</p><table style="border-collapse:collapse;width:100%;margin:20px 0"><tr><td style="padding:9px 0;color:#68776f">Sector</td><td style="padding:9px 0">${sector}</td></tr><tr><td style="padding:9px 0;color:#68776f">Readiness</td><td style="padding:9px 0">${trl}</td></tr></table><a href="${Deno.env.get("INVESTOR_PORTAL_URL") || "https://rmrdc.gov.ng/investor-portal.html#discover"}" style="display:inline-block;background:#075c36;color:#fff;padding:12px 16px;text-decoration:none;border-radius:6px">View opportunity</a><p style="font-size:12px;color:#68776f;margin-top:24px">Sign in to review the available brief and request deeper technology intelligence from RMRDC.</p></div></div>`;
    await sendEmail((investors || []).map(investor => investor.email).filter(Boolean), `New RMRDC opportunity: ${opportunity.title}`, html);
    return json({ ok: true, event, notified_investors: investorIds.length });
  } catch (error) {
    console.error("Technology workflow notification failed:", error);
    return json({ error: "The notification service is temporarily unavailable." }, 500);
  }
});
