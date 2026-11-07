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
  const callbackBaseUrl = Deno.env.get("PAYSTACK_CALLBACK_URL") || Deno.env.get("SITE_URL");
  if (!secretKey || !supabaseUrl || !serviceRoleKey || !callbackBaseUrl) {
    return json(req, { error: "Payment service is not configured." }, 503);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(req, { error: "Invalid request body." }, 400);
  }

  const publicationId = String(body.publication_id || "");
  const email = String(body.email || "").trim().toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(publicationId)) {
    return json(req, { error: "A valid publication is required." }, 400);
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(req, { error: "Enter a valid email address." }, 400);
  }

  let callbackUrl: URL;
  try {
    callbackUrl = new URL(callbackBaseUrl);
    if (!callbackUrl.pathname.endsWith("/viewer.html")) {
      callbackUrl.pathname = `${callbackUrl.pathname.replace(/\/+$/, "")}/viewer.html`;
    }
    callbackUrl.hash = "";
  } catch {
    return json(req, { error: "Payment service is not configured." }, 503);
  }
  callbackUrl.searchParams.set("id", publicationId);

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: publication, error: publicationError } = await admin
    .from("publications")
    .select("id,title,price,is_paid,pdf_path")
    .eq("id", publicationId)
    .maybeSingle();

  if (publicationError) {
    console.error("Could not load publication for payment:", publicationError);
    return json(req, { error: "Could not prepare this publication for payment." }, 500);
  }
  if (!publication) return json(req, { error: "Publication not found." }, 404);

  const amountKobo = Math.round(Number(publication.price) * 100);
  if ((!publication.is_paid && Number(publication.price) <= 0) || !Number.isSafeInteger(amountKobo) || amountKobo <= 0) {
    return json(req, { error: "This publication is not available for purchase." }, 400);
  }
  if (!publication.pdf_path) {
    return json(req, { error: "Online purchase is not configured for this publication." }, 400);
  }

  const reference = `rmrdc_${crypto.randomUUID().replace(/-/g, "")}`;
  const { error: purchaseError } = await admin.from("publication_purchases").insert({
    publication_id: publication.id,
    reference,
    buyer_email: email,
    amount_kobo: amountKobo,
    currency: "NGN",
  });
  if (purchaseError) {
    console.error("Could not record pending publication payment:", purchaseError);
    return json(req, { error: "Could not prepare this publication for payment." }, 500);
  }

  let response: Response;
  try {
    response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: amountKobo,
        currency: "NGN",
        reference,
        callback_url: callbackUrl.toString(),
        metadata: {
          publication_id: publication.id,
          publication_title: publication.title,
        },
      }),
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    const { error: statusError } = await admin.from("publication_purchases").update({ status: "failed" }).eq("reference", reference);
    if (statusError) console.error("Could not mark failed Paystack initialization:", statusError);
    console.error("Could not reach Paystack to initialize payment:", error);
    return json(req, { error: "Could not reach Paystack. Please try again later." }, 502);
  }

  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.status || !result?.data?.authorization_url) {
    const { error: statusError } = await admin.from("publication_purchases").update({ status: "failed" }).eq("reference", reference);
    if (statusError) console.error("Could not mark failed Paystack initialization:", statusError);
    console.error("Paystack initialization failed:", result?.message || response.status);
    return json(req, { error: "Could not start payment. Please try again." }, 502);
  }

  return json(req, {
    authorization_url: result.data.authorization_url,
    reference,
  });
});
