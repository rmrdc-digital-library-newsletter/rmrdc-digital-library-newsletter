import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const headers = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" };
  const token = new URL(req.url).searchParams.get("token") || "";
  if (!/^[0-9a-f-]{36}$/i.test(token)) {
    return new Response("<h1>Invalid unsubscribe link</h1><p>Please contact RMRDC if you need help.</p>", { status: 400, headers });
  }

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: subscriber, error: lookupError } = await admin
      .from("research_subscribers")
      .select("id, profile_id")
      .eq("unsubscribe_token", token)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!subscriber) return new Response("<h1>Link not found</h1><p>This unsubscribe link may have expired.</p>", { status: 404, headers });

    const { error: updateError } = await admin.from("research_subscribers")
      .update({ email_notifications: false }).eq("id", subscriber.id);
    if (updateError) throw updateError;
    if (subscriber.profile_id) {
      const { error } = await admin.from("profiles").update({ email_notifications: false }).eq("id", subscriber.profile_id);
      if (error) throw error;
    }
    return new Response("<main style='font:16px Arial,sans-serif;max-width:600px;margin:60px auto;padding:24px;color:#153321'><h1>You are unsubscribed</h1><p>You will no longer receive RMRDC publication emails. You can update your preferences by contacting RMRDC.</p></main>", { headers });
  } catch (error) {
    console.error("CAS unsubscribe failed:", error);
    return new Response("<h1>We could not update your email preference</h1><p>Please contact RMRDC for assistance.</p>", { status: 500, headers });
  }
});
