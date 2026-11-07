import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = (Deno.env.get("CORS_ALLOWED_ORIGINS") || "https://rmrdc-cas.netlify.app,http://localhost:3000,http://localhost:3001")
  .split(",").map((origin) => origin.trim()).filter(Boolean);

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.includes(origin) ? origin : "null",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(req: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed." }, 405);
  if (!allowedOrigins.includes(req.headers.get("origin") || "")) return json(req, { error: "Request origin is not allowed." }, 403);

  const secretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secretKey || !supabaseUrl || !serviceRoleKey) {
    return json(req, { error: "Payment service is not configured." }, 503);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(req, { error: "Invalid request body." }, 400);
  }

  const reference = String(body.reference || "");
  if (!/^rmrdc_[0-9a-f]{32}$/i.test(reference)) {
    return json(req, { error: "A valid payment reference is required." }, 400);
  }
  const expectedPublicationId = String(body.publication_id || "");
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(expectedPublicationId)) {
    return json(req, { error: "A valid publication is required." }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: purchase, error: purchaseError } = await admin
    .from("publication_purchases")
    .select("publication_id,buyer_email,amount_kobo,currency,status")
    .eq("reference", reference)
    .maybeSingle();

  if (purchaseError) {
    console.error("Could not load publication purchase:", purchaseError);
    return json(req, { error: "Could not verify this payment." }, 500);
  }
  if (!purchase) return json(req, { error: "Payment reference was not found." }, 404);
  if (purchase.publication_id !== expectedPublicationId) {
    return json(req, { error: "This payment is for a different publication." }, 403);
  }

  let response: Response;
  try {
    response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    console.error("Could not reach Paystack to verify payment:", error);
    return json(req, { error: "Could not verify this payment. Please retry shortly." }, 502);
  }
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.status || !result?.data) {
    console.error("Paystack verification failed:", result?.message || response.status);
    return json(req, { error: "Could not verify this payment. Please retry shortly." }, 502);
  }

  const transaction = result.data;
  if (transaction.status !== "success") {
    if (transaction.status === "failed" || transaction.status === "abandoned") {
      const { error: statusError } = await admin.from("publication_purchases")
        .update({ status: "failed" }).eq("reference", reference).eq("status", "pending");
      if (statusError) console.error("Could not mark failed publication payment:", statusError);
    }
    return json(req, { error: "Payment has not been completed." }, 402);
  }

  const transactionEmail = String(transaction.customer?.email || "").trim().toLowerCase();
  if (
    Number(transaction.amount) !== Number(purchase.amount_kobo) ||
    transaction.currency !== purchase.currency ||
    transactionEmail !== String(purchase.buyer_email).toLowerCase() ||
    !transaction.id
  ) {
    console.error("Paystack transaction did not match the pending publication purchase:", reference);
    return json(req, { error: "Payment details did not match this publication order." }, 402);
  }

  const { data: publication, error: publicationError } = await admin
    .from("publications")
    .select("id,pdf_path")
    .eq("id", purchase.publication_id)
    .maybeSingle();
  if (publicationError || !publication?.pdf_path) {
    console.error("Could not load purchased publication file:", publicationError);
    return json(req, { error: "The full publication file is not available yet." }, 500);
  }

  const { error: updateError } = await admin
    .from("publication_purchases")
    .update({
      status: "success",
      gateway_transaction_id: String(transaction.id),
      paid_at: transaction.paid_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("reference", reference);
  if (updateError) {
    console.error("Could not record verified publication payment:", updateError);
    return json(req, { error: "Payment was received, but access could not be prepared. Contact support with your payment reference." }, 500);
  }

  const { data: signed, error: signedError } = await admin.storage
    .from("paid-documents")
    .createSignedUrl(publication.pdf_path, 15 * 60);
  if (signedError || !signed?.signedUrl) {
    console.error("Could not sign purchased publication:", signedError);
    return json(req, { error: "Payment succeeded, but the publication file could not be opened. Contact support with your payment reference." }, 500);
  }

  return json(req, { status: "success", signed_url: signed.signedUrl });
});
