import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const trackedEvents = new Set([
  "email.sent", "email.delivered", "email.delivery_delayed", "email.bounced",
  "email.complained", "email.opened", "email.clicked", "email.failed", "email.suppressed",
]);

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let i = 0; i < left.length; i += 1) difference |= left[i] ^ right[i];
  return difference === 0;
}

async function verifySvix(req: Request, rawBody: string, secret: string): Promise<boolean> {
  const id = req.headers.get("svix-id") || "";
  const timestamp = req.headers.get("svix-timestamp") || "";
  const signatures = req.headers.get("svix-signature") || "";
  const timestampSeconds = Number(timestamp);
  if (!id || !timestamp || !signatures || !Number.isFinite(timestampSeconds)) return false;
  if (Math.abs(Date.now() / 1000 - timestampSeconds) > 5 * 60) return false;

  const encodedSecret = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  let keyBytes: Uint8Array;
  try { keyBytes = decodeBase64(encodedSecret); } catch { return false; }
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signedContent = new TextEncoder().encode(`${id}.${timestamp}.${rawBody}`);
  const expected = new Uint8Array(await crypto.subtle.sign("HMAC", key, signedContent));

  return signatures.split(" ").some((entry) => {
    const [version, value] = entry.split(",", 2);
    if (version !== "v1" || !value) return false;
    try { return constantTimeEqual(expected, decodeBase64(value)); } catch { return false; }
  });
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const secret = Deno.env.get("RESEND_WEBHOOK_SECRET") || "";
  if (!secret) return new Response("Webhook secret is not configured", { status: 503 });

  try {
    const rawBody = await req.text();
    if (rawBody.length > 1_000_000) return new Response("Payload too large", { status: 413 });
    if (!await verifySvix(req, rawBody, secret)) return new Response("Invalid webhook signature", { status: 401 });

    const event = JSON.parse(rawBody);
    const eventType = String(event?.type || "");
    if (!trackedEvents.has(eventType)) return new Response(JSON.stringify({ received: true, ignored: true }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
    const emailId = String(event?.data?.email_id || "");
    if (!emailId) return new Response("Missing email_id", { status: 400 });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const recipients = Array.isArray(event?.data?.to) ? event.data.to : [];
    const recipientEmail = recipients.length ? String(recipients[0]).toLowerCase() : null;
    const eventCreatedAt = event?.created_at || event?.data?.created_at || new Date().toISOString();
    const { data, error } = await supabase.rpc("record_cas_email_webhook_event", {
      p_svix_id: req.headers.get("svix-id"),
      p_email_id: emailId,
      p_event_type: eventType,
      p_recipient_email: recipientEmail,
      p_event_created_at: eventCreatedAt,
      p_payload: event,
    });
    if (error) throw error;
    return new Response(JSON.stringify({ received: true, duplicate: Boolean(data?.duplicate), matched: Boolean(data?.matched) }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Resend campaign webhook failed:", error instanceof Error ? error.message : "unknown error");
    return new Response("Webhook processing failed", { status: 500 });
  }
});
