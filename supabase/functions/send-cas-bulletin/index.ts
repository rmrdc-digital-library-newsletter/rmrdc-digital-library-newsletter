import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function intersects(a: string[] = [], b: string[] = []) {
  const set = new Set(a.map(x => String(x).toLowerCase()));
  return b.some(x => set.has(String(x).toLowerCase()));
}

async function sendEmail(to: string, bulletin: any) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return { skipped: true };
  const html = `<h2>${bulletin.title}</h2><p>${bulletin.summary || ""}</p><hr><p>${String(bulletin.body || "").replace(/\n/g, "<br>")}</p>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "RMRDC CAS <onboarding@resend.dev>",
      to: [to],
      subject: bulletin.title,
      html
    })
  });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

async function sendWhatsApp(to: string, bulletin: any) {
  const token = Deno.env.get("WHATSAPP_TOKEN");
  const phoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  if (!token || !phoneId) return { skipped: true };
  const body = `RMRDC CAS Bulletin\n\n${bulletin.title}\n\n${bulletin.summary || ""}\n\n${String(bulletin.body || "").slice(0, 1200)}`;
  const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body } })
  });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { bulletin_id } = await req.json();
    if (!bulletin_id) throw new Error("bulletin_id is required");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: bulletin, error: bulletinError } = await supabase.from("cas_bulletins").select("*").eq("id", bulletin_id).single();
    if (bulletinError) throw bulletinError;

    const { data: subscribers, error: subError } = await supabase.from("research_subscribers").select("*");
    if (subError) throw subError;

    const sectors = bulletin.sectors || [];
    const matched = (subscribers || []).filter((s: any) => {
      const areas = s.research_areas || [];
      return !sectors.length || !areas.length || intersects(sectors, areas);
    });

    let sent = 0;
    for (const sub of matched) {
      if (sub.email && sub.email_notifications !== false) {
        try {
          await sendEmail(sub.email, bulletin);
          await supabase.from("cas_bulletin_deliveries").insert({ bulletin_id, subscriber_email: sub.email, channel: "email", status: "sent" });
          sent++;
        } catch (e) {
          await supabase.from("cas_bulletin_deliveries").insert({ bulletin_id, subscriber_email: sub.email, channel: "email", status: "failed", error: String(e?.message || e) });
        }
      }

      if (sub.phone && sub.whatsapp_alerts !== false) {
        try {
          await sendWhatsApp(String(sub.phone).replace(/[^0-9]/g, ""), bulletin);
          await supabase.from("cas_bulletin_deliveries").insert({ bulletin_id, subscriber_phone: sub.phone, channel: "whatsapp", status: "sent" });
          sent++;
        } catch (e) {
          await supabase.from("cas_bulletin_deliveries").insert({ bulletin_id, subscriber_phone: sub.phone, channel: "whatsapp", status: "failed", error: String(e?.message || e) });
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, matched: matched.length, sent }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
