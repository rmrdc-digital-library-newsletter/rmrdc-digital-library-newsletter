import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateEmbedding, PUBLICATION_EMBEDDING_MODEL } from "../_shared/publication-embedding.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": (Deno.env.get("CORS_ALLOWED_ORIGINS") || "http://localhost:5501,http://127.0.0.1:5501").split(",")[0].trim(),
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
        const embedding = await generateEmbedding(queryText);
        await supabase.from("publication_embeddings").upsert({
          publication_id,
          content_text: queryText,
          embedding,
          model: PUBLICATION_EMBEDDING_MODEL,
        }, { onConflict: "publication_id" });
      }
    } else {
      queryText = Array.isArray(interests) ? interests.join(" ") : String(interests || "");
      if (!queryText.trim()) throw new Error("publication_id or interests is required");
    }

    let recommendations: any[] = [];

    try {
      const queryEmbedding = await generateEmbedding(queryText);
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
    console.error("Publication recommendations failed:", error);
    return new Response(JSON.stringify({ error: "Recommendations are temporarily unavailable. Please try again later." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
