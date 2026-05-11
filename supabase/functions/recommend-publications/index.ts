import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function publicationText(pub: any) {
  return [
    pub?.title,
    pub?.authors,
    pub?.type,
    pub?.year,
    pub?.abstract,
    pub?.isbn,
    pub?.doi,
    ...(pub?.research_areas || [])
  ].filter(Boolean).join("\n").slice(0, 4000);
}

async function embed(text: string) {
  const hfKey = Deno.env.get("HUGGINGFACE_API_KEY");
  const model = Deno.env.get("EMBEDDING_MODEL") || "sentence-transformers/all-MiniLM-L6-v2";
  if (!hfKey) throw new Error("Missing HUGGINGFACE_API_KEY");

  const res = await fetch(`https://api-inference.huggingface.co/pipeline/feature-extraction/${model}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${hfKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ inputs: text, options: { wait_for_model: true } }),
  });

  if (!res.ok) throw new Error(await res.text());
  const output = await res.json();

  // HF can return [dim] or [[tokens, dim]]. Mean-pool if needed.
  if (Array.isArray(output) && typeof output[0] === "number") return output;
  if (Array.isArray(output) && Array.isArray(output[0])) {
    const rows = output as number[][];
    const dim = rows[0].length;
    const pooled = new Array(dim).fill(0);
    for (const row of rows) row.forEach((v, i) => pooled[i] += v);
    return pooled.map(v => v / rows.length);
  }

  throw new Error("Unexpected embedding response");
}

function keywordScore(source: any, candidate: any) {
  const text = publicationText(source).toLowerCase();
  const cand = publicationText(candidate).toLowerCase();
  const terms = new Set(text.split(/[^a-z0-9]+/).filter(w => w.length > 3));
  let score = 0;
  for (const term of cand.split(/[^a-z0-9]+/)) {
    if (terms.has(term)) score++;
  }
  const srcAreas = (source?.research_areas || []).map((x: string) => String(x).toLowerCase());
  const candAreas = (candidate?.research_areas || []).map((x: string) => String(x).toLowerCase());
  for (const area of candAreas) if (srcAreas.includes(area)) score += 8;
  if (source?.type && source.type === candidate?.type) score += 4;
  score += Math.min(6, Number(candidate?.view_count || 0) / 10);
  return score;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { publication_id, interests = [], limit = 8 } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let queryText = "";
    let excludeId = publication_id || null;
    let sourcePub: any = null;

    if (publication_id) {
      const { data, error } = await supabase
        .from("publications_with_stats")
        .select("*")
        .eq("id", publication_id)
        .single();

      if (error) throw error;
      sourcePub = data;
      queryText = publicationText(data);

      // Ensure source embedding exists.
      const { data: existing } = await supabase
        .from("publication_embeddings")
        .select("embedding")
        .eq("publication_id", publication_id)
        .maybeSingle();

      if (!existing) {
        const embedding = await embed(queryText);
        await supabase.from("publication_embeddings").upsert({
          publication_id,
          content_text: queryText,
          embedding,
          model: Deno.env.get("EMBEDDING_MODEL") || "sentence-transformers/all-MiniLM-L6-v2",
        }, { onConflict: "publication_id" });
      }
    } else {
      queryText = Array.isArray(interests) ? interests.join(" ") : String(interests || "");
      if (!queryText.trim()) throw new Error("publication_id or interests is required");
    }

    let recommendations: any[] = [];

    try {
      const queryEmbedding = await embed(queryText);
      const { data: matches, error: matchError } = await supabase.rpc("match_publications_by_embedding", {
        query_embedding: queryEmbedding,
        match_count: limit,
        exclude_publication_id: excludeId,
      });

      if (!matchError && matches?.length) {
        const ids = matches.map((m: any) => m.publication_id);
        const { data: pubs } = await supabase.from("publications_with_stats").select("*").in("id", ids);
        recommendations = ids.map((id: string) => pubs?.find((p: any) => p.id === id)).filter(Boolean);
      }
    } catch (_semanticError) {
      // fallback below
    }

    if (!recommendations.length) {
      const { data: allPubs, error } = await supabase
        .from("publications_with_stats")
        .select("*")
        .neq("id", excludeId || "00000000-0000-0000-0000-000000000000")
        .limit(120);

      if (error) throw error;

      const source = sourcePub || { title: queryText, abstract: queryText, research_areas: interests };
      recommendations = (allPubs || [])
        .map((pub: any) => ({ pub, score: keywordScore(source, pub) }))
        .filter((item: any) => item.score > 0)
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, limit)
        .map((item: any) => item.pub);
    }

    return new Response(JSON.stringify({ recommendations }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error?.message || error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
