import { createClient } from "npm:@supabase/supabase-js@2";
import { generateEmbedding } from "../_shared/publication-embedding.ts";

const allowedOrigins = (Deno.env.get("CORS_ALLOWED_ORIGINS") || "http://localhost:5500,http://127.0.0.1:5500,http://localhost:5501,http://127.0.0.1:5501")
  .split(",").map(origin => origin.trim()).filter(Boolean);

function headers(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: headers(req) });
}

function clean(value: unknown, maxLength = 12000) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function safeSources(rows: Array<Record<string, any>>) {
  const seen = new Set<string>();
  return rows.filter(row => {
    const key = `${row.publication_id}:${row.page_number ?? "profile"}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 10).map(row => ({
    publication_id: row.publication_id,
    title: row.title,
    author: row.authors,
    year: row.year,
    page: row.page_number,
    evidence_type: row.evidence_type,
    relevance: Number(row.relevance || 0),
    viewer_url: row.page_number
      ? `viewer.html?id=${encodeURIComponent(row.publication_id)}#page/${Math.max(1, Number(row.page_number))}`
      : `viewer.html?id=${encodeURIComponent(row.publication_id)}`
  }));
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: headers(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return json(req, { error: "RMRDC search is not configured." }, 503);

  const body = await req.json().catch(() => ({}));
  const question = clean(body.question, 2000);
  if (!question) return json(req, { error: "Enter a research question." }, 400);

  const client = createClient(supabaseUrl, anonKey);
  let queryEmbedding: number[] | null = null;
  try {
    queryEmbedding = await generateEmbedding(question);
  } catch (error) {
    console.warn("Semantic query embedding unavailable; using hybrid full-text matching:", error);
  }

  const { data: evidence, error: searchError } = await client.rpc("search_publication_evidence", {
    p_query: question,
    p_query_embedding: queryEmbedding ? JSON.stringify(queryEmbedding) : null,
    p_match_count: 30
  });
  if (searchError) {
    console.error("Publication evidence retrieval failed:", searchError);
    return json(req, { error: "Publication search is temporarily unavailable." }, 502);
  }

  const candidates = (evidence || []) as Array<Record<string, any>>;
  const selected = candidates.slice(0, 10);
  const sources = safeSources(selected);
  if (!selected.length) {
    return json(req, {
      answer: "The available RMRDC knowledge base does not provide enough indexed evidence to answer this question. Try a publication title, author, raw material, location, ISBN, or DOI.",
      sources: [],
      evidenceFound: false
    });
  }

  const numberedEvidence = selected.map((row, index) => {
    const page = row.page_number ? `, page ${row.page_number}` : ", Research Intelligence Profile";
    return `[S${index + 1}] ${row.title || "Untitled publication"} — ${row.authors || "RMRDC"} (${row.year || "n.d."})${page}\n${clean(row.content, 5000)}`;
  }).join("\n\n").slice(0, 42000);

  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiKey) {
    return json(req, {
      answer: "The AI answer service is not configured. Retrieved RMRDC evidence is shown below for manual review.",
      sources,
      evidenceFound: true,
      evidence: selected.map(row => ({ title: row.title, page: row.page_number, excerpt: clean(row.content, 700) }))
    });
  }

  const model = Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash";
  const prompt = `You are the RMRDC Research Assistant for the Raw Materials Research and Development Council Current Awareness Service.

Answer the user's question using only the retrieved RMRDC evidence. Do not invent findings, statistics, technologies, methods, policy claims, or publication details. Distinguish documented facts from concise summaries. If the sources do not support an answer, say that the available RMRDC knowledge base does not provide enough information. Cite every substantive publication-derived claim with one or more source IDs exactly like [S1]. Do not cite a source ID that is not included below. Page numbers are supplied for full-text evidence; profile evidence has no page number.

Return JSON with one string property named answer. Do not include prompts, secrets, or extra properties.

User question:
${question}

Retrieved RMRDC evidence:
${numberedEvidence}`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(50000),
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1600,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: { answer: { type: "STRING" } },
            required: ["answer"]
          }
        }
      })
    });
    if (!response.ok) throw new Error(`Gemini returned ${response.status}.`);
    const result = await response.json();
    const responseText = result?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text || "")
      .join("")
      .trim();
    if (!responseText) throw new Error("Gemini returned an empty answer.");
    const parsed = JSON.parse(responseText.replace(/^```(?:json)?\s*|\s*```$/g, ""));
    const answer = clean(parsed.answer, 10000);
    if (!answer) throw new Error("Gemini returned an empty answer.");
    return json(req, { answer, sources, evidenceFound: true });
  } catch (error) {
    console.error("Grounded RMRDC answer generation failed:", error);
    return json(req, {
      answer: "The AI response could not be generated. The retrieved RMRDC publications are available in the sources below.",
      sources,
      evidenceFound: true
    });
  }
});
