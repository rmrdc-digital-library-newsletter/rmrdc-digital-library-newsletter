import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": (Deno.env.get("CORS_ALLOWED_ORIGINS") || "*").split(",")[0].trim(),
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const normalize = (value: unknown) => String(value ?? "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

const tokens = (value: unknown) => new Set(normalize(value).split(/\s+/).filter(Boolean));

const overlap = (left: unknown[], right: unknown[]) => {
  const wanted = new Set(left.map(normalize).filter(Boolean));
  let score = 0;
  for (const item of right) {
    const normalized = normalize(item);
    if (!normalized) continue;
    if (wanted.has(normalized)) score += 30;
    else if ([...wanted].some(value => normalized.includes(value) || value.includes(normalized))) score += 18;
  }
  return score;
};

const textSimilarity = (left: unknown, right: unknown) => {
  const leftTokens = tokens(left);
  const rightTokens = tokens(right);
  let score = 0;
  for (const token of rightTokens) if (leftTokens.has(token) && token.length > 3) score += 2;
  return score;
};

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anonKey || !serviceKey) return json({ error: "Recommendation service is unavailable." }, 503);

    const accessToken = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!accessToken) return json({ error: "Authentication required." }, 401);

    const body = await request.json().catch(() => ({}));
    const limit = Math.min(Math.max(Number(body.limit || 6), 1), 12);
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${accessToken}` } } });
    const { data: auth, error: authError } = await userClient.auth.getUser();
    if (authError || !auth.user) return json({ error: "Authentication required." }, 401);

    const service = createClient(url, serviceKey);
    const { data: profile } = await service.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
    const role = profile?.role;

    const [{ data: opportunities, error: opportunityError }, roleProfileResult] = await Promise.all([
      service.from("technology_opportunities").select("id,title,short_summary,sector,category,trl,commercialisation_status,raw_materials,raw_material_locations,technical_specifications,fabrication_requirements,scale_up_requirements,problem_addressed,created_by,visibility,updated_at")
        .eq("visibility", "approved")
        .order("updated_at", { ascending: false }),
      role === "investor"
        ? service.from("investor_profiles_v2").select("*").eq("user_id", auth.user.id).maybeSingle()
        : role === "fabricator"
          ? service.from("fabricator_profiles_v2").select("*").eq("user_id", auth.user.id).maybeSingle()
          : role === "researcher"
            ? service.from("researcher_profiles").select("*").eq("user_id", auth.user.id).maybeSingle()
            : role === "library_user"
              ? service.from("library_user_profiles").select("*").eq("user_id", auth.user.id).maybeSingle()
              : Promise.resolve({ data: null, error: null }),
    ]);
    if (opportunityError) throw opportunityError;

    const roleProfile = roleProfileResult.data;
    const recommendations = (opportunities || []).map(opportunity => {
      let score = 0;

      if (role === "investor") {
        score += overlap(roleProfile?.technology_interests || [], [opportunity.sector, opportunity.category]);
        score += overlap(roleProfile?.technology_interests || [], opportunity.technical_specifications ? [opportunity.technical_specifications] : []);
        score += overlap(roleProfile?.commercialisation_interests || [], [opportunity.commercialisation_status, opportunity.category]);
        score += overlap(roleProfile?.geographic_interests || [], opportunity.raw_material_locations || []);
        if (opportunity.trl >= roleProfile?.preferred_trl_min && opportunity.trl <= roleProfile?.preferred_trl_max) score += 20;
      } else if (role === "fabricator") {
        score += overlap(roleProfile?.specialisations || [], [opportunity.sector, opportunity.category, opportunity.fabrication_requirements]);
        score += overlap(roleProfile?.services_offered || [], [opportunity.fabrication_requirements, opportunity.scale_up_requirements]);
        score += overlap(roleProfile?.equipment || [], [opportunity.fabrication_requirements, opportunity.scale_up_requirements]);
        score += overlap(roleProfile?.geographic_coverage || [], opportunity.raw_material_locations || []);
      } else if (role === "researcher") {
        const areas = String(roleProfile?.research_areas || "").split(/[,;]/);
        score += overlap(areas, [opportunity.sector, opportunity.category, opportunity.short_summary, opportunity.problem_addressed]);
        if (opportunity.created_by === auth.user.id) score += 15;
      } else if (role === "library_user") {
        const areas = String(roleProfile?.subject_areas || "").split(/[,;]/);
        score += overlap(areas, [opportunity.sector, opportunity.category, opportunity.short_summary, opportunity.title]);
      } else {
        score += textSimilarity(opportunity.title, body.interests);
      }

      score += Math.round(textSimilarity(opportunity.title + " " + opportunity.short_summary, roleProfile?.technology_interests?.join(" ") || ""));
      return { ...opportunity, match_score: score };
    })
      .filter(item => item.match_score > 0 || role === "admin")
      .sort((a, b) => b.match_score - a.match_score || b.updated_at?.localeCompare(a.updated_at || "") || 0)
      .slice(0, limit)
      .map(item => ({
        id: item.id,
        title: item.title,
        short_summary: item.short_summary,
        sector: item.sector,
        category: item.category,
        trl: item.trl,
        match_score: item.match_score,
        reason: item.match_score >= 30 ? "Strong match with your profile" : "Relevant to your selected interests",
      }));

    return json({ role, recommendations });
  } catch (error) {
    console.error("Technology recommendation failed:", error);
    return json({ error: "Personalized recommendations are temporarily unavailable." }, 500);
  }
});
