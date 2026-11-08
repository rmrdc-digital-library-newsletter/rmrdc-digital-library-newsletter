import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins = (Deno.env.get("CORS_ALLOWED_ORIGINS") || "*").split(",").map(value => value.trim()).filter(Boolean);
const responseHeaders = (request: Request) => ({
  "Access-Control-Allow-Origin": allowedOrigins.includes(request.headers.get("origin") || "") ? request.headers.get("origin") || "" : allowedOrigins[0],
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-processing-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
});
const json = (request: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: responseHeaders(request),
});

const compact = (value: unknown) => {
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  if (value === null || value === undefined || value === "") return "Not specified in the approved evidence";
  return String(value);
};

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: responseHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "Method not allowed." }, 405);

  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  const internal = Boolean(
    Deno.env.get("DOCUMENT_PROCESSING_INTERNAL_SECRET")
    && request.headers.get("X-Internal-Processing-Secret") === Deno.env.get("DOCUMENT_PROCESSING_INTERNAL_SECRET")
  );
  if (!token && !internal) return json(request, { error: "Authentication required." }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!url || !serviceKey || !anonKey || !geminiKey) {
    return json(request, { error: "Investor business-model service is not configured." }, 503);
  }

  if (!internal) {
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json(request, { error: "Authentication required." }, 401);
    const { data: profile } = await userClient.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (!profile || !["admin", "editor"].includes(profile.role)) {
      return json(request, { error: "Admin or editor access is required." }, 403);
    }
  }

  const body = await request.json().catch(() => ({}));
  const opportunityId = String(body.opportunity_id || "");
  if (!opportunityId) return json(request, { error: "opportunity_id is required." }, 400);

  const serviceClient = createClient(url, serviceKey);
  const { data: opportunity, error } = await serviceClient.from("technology_opportunities").select("*").eq("id", opportunityId).single();
  if (error || !opportunity) return json(request, { error: "Technology opportunity not found." }, 404);

  const { data: chunks } = await serviceClient
    .from("technology_document_chunks")
    .select("content,source_filename,page_number")
    .eq("technology_id", opportunityId)
    .order("chunk_index")
    .limit(25);
  const evidence = (chunks || []).map(chunk =>
    `[${chunk.source_filename || "RMRDC document"}, page ${chunk.page_number || "unknown"}]\n${String(chunk.content || "").slice(0, 4000)}`
  ).join("\n\n").slice(0, 90000);

  const model = Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash";
  const schema = {
    type: "OBJECT",
    properties: {
      subject: { type: "STRING" },
      opening_hook: { type: "STRING" },
      problem: { type: "STRING" },
      solution: { type: "STRING" },
      unique_value: { type: "STRING" },
      customer_segments: { type: "ARRAY", items: { type: "STRING" } },
      revenue_streams: { type: "ARRAY", items: { type: "STRING" } },
      pricing: { type: "STRING" },
      unit_economics: { type: "STRING" },
      channels: { type: "ARRAY", items: { type: "STRING" } },
      key_resources: { type: "ARRAY", items: { type: "STRING" } },
      key_activities: { type: "ARRAY", items: { type: "STRING" } },
      key_partnerships: { type: "ARRAY", items: { type: "STRING" } },
      cost_structure: { type: "ARRAY", items: { type: "STRING" } },
      traction: { type: "STRING" },
      investment_case: { type: "STRING" },
      assumptions: { type: "ARRAY", items: { type: "STRING" } },
      call_to_action: { type: "STRING" },
      sources: { type: "ARRAY", items: { type: "STRING" } },
    },
    required: ["subject", "opening_hook", "problem", "solution", "unique_value", "customer_segments", "revenue_streams", "pricing", "unit_economics", "channels", "key_resources", "key_activities", "key_partnerships", "cost_structure", "traction", "investment_case", "assumptions", "call_to_action", "sources"],
  };

  const approvedRecord = {
    name: opportunity.title,
    sector: opportunity.sector,
    category: opportunity.category,
    trl: opportunity.trl,
    problem: opportunity.problem_addressed,
    solution: opportunity.technical_specifications || opportunity.production_process,
    summary: opportunity.executive_summary || opportunity.abstract || opportunity.short_summary,
    market: opportunity.market_summary || opportunity.market_opportunity,
    market_size: opportunity.market_size,
    investment: opportunity.estimated_investment,
    costs: opportunity.production_cost_text,
    selling_price: opportunity.expected_selling_price,
    margin: opportunity.profit_margin,
    demand: opportunity.expected_demand_cagr,
    payback: opportunity.payback_period,
    raw_materials: opportunity.raw_materials,
    locations: opportunity.raw_material_locations,
    capacity: opportunity.production_capacity,
    machinery: opportunity.machinery_equipment,
    evidence: opportunity.laboratory_pilot_evidence,
    demonstration: opportunity.demonstration_results,
    prototype: opportunity.prototype_status,
    pilot: opportunity.pilot_plant_availability,
    ip: opportunity.patent_ip_status,
    patent_reference: opportunity.patent_reference,
    partnerships: opportunity.existing_partnerships,
    engagement: opportunity.engagement_models,
  };

  const prompt = `Act as an elite venture capital consultant and startup copywriter. Create an investor-ready Lean Canvas business-model pitch for RMRDC-approved technology.

Use only approved technology data and document evidence. Do not fabricate traction, market size, customers, revenue, margins, costs, price, unit economics, partnerships, grants or pilot users.
If commercial facts are absent, propose clearly labeled "commercial assumption requiring validation". Quantified assumptions must be separated from documented facts. A concise call to action should request a 10-minute introductory call.
Write for busy angel investors and VCs. Keep the narrative concrete, specific, and free of generic corporate language. Use no placeholders.

Approved technology record:
${JSON.stringify(approvedRecord)}

Document evidence:
${evidence || "No additional processed document evidence was supplied."}`;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(55000),
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 3500, responseMimeType: "application/json", responseSchema: schema },
    }),
  });
  if (!response.ok) return json(request, { error: "Business-model generation failed." }, 502);
  const result = await response.json();
  const text = result?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("").trim();
  if (!text) return json(request, { error: "The AI returned an empty business model." }, 502);

  try {
    const modelOutput = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
    return json(request, { opportunity_id: opportunityId, model: modelOutput, model_name: model });
  } catch {
    return json(request, { error: "The AI returned an invalid business model." }, 502);
  }
});
