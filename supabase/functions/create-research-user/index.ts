import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData?.user) throw new Error("Not authenticated.");

    const { data: requester } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", authData.user.id)
      .maybeSingle();
    if (requester?.role !== "admin") throw new Error("Only admins can create research users.");

    const body = await req.json();
    const full_name = String(body.full_name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const organisation = String(body.organisation || "").trim();
    const password = String(body.password || "");
    const research_areas = normalizeAreas(body.research_areas);

    if (!full_name || !email || !password) throw new Error("Full name, email, and password are required.");
    if (password.length < 8) throw new Error("Password must be at least 8 characters.");
    if (!research_areas.length) throw new Error("Enter at least one research area.");

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, organisation, research_areas },
    });

    let userId = created?.user?.id;
    if (createError) {
      if (!createError.message.toLowerCase().includes("already")) throw createError;
      const { data: existingUsers, error: listError } = await adminClient.auth.admin.listUsers();
      if (listError) throw listError;
      userId = existingUsers.users.find((u) => u.email?.toLowerCase() === email)?.id;
      if (!userId) throw createError;
      const { error: updateAuthError } = await adminClient.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
        user_metadata: { full_name, organisation, research_areas },
      });
      if (updateAuthError) throw updateAuthError;
    }

    const { error: profileError } = await adminClient.from("profiles").upsert({
      id: userId,
      full_name,
      email,
      organisation,
      research_areas,
      email_notifications: true,
      role: "viewer",
    });
    if (profileError) throw profileError;

    const { error: subscriberError } = await adminClient.from("research_subscribers").upsert({
      full_name,
      email,
      organisation,
      research_areas,
      is_active: true,
    }, { onConflict: "email" });
    if (subscriberError) throw subscriberError;

    return new Response(JSON.stringify({ ok: true, user_id: userId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || "Failed to create research user." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
