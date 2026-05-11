import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function safeJson(v: unknown, max = 16000) {
  return JSON.stringify(v, null, 2).slice(0, max);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { question } = await req.json();

    if (!question) {
      throw new Error("Question is required.");
    }

    const serviceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
      Deno.env.get("SERVICE_ROLE_KEY");

    if (!serviceRoleKey) {
      throw new Error("Missing Supabase service role key.");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceRoleKey
    );

    const hfKey = Deno.env.get("HUGGINGFACE_API_KEY");

    if (!hfKey) {
      throw new Error("Missing HUGGINGFACE_API_KEY secret.");
    }

    const model =
      Deno.env.get("HF_MODEL") ||
      "mistralai/Mistral-7B-Instruct-v0.3";

    const terms = String(question)
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);

    const q = terms[0] || String(question).slice(0, 30);

    const ilike = `%${q}%`;

    const { data: chunks, error: chunksError } = await supabase
      .from("publication_chunks")
      .select(`
        publication_id,
        page_number,
        chunk_index,
        content
      `)
      .ilike("content", ilike)
      .limit(12);

    if (chunksError) {
      console.error(chunksError);
    }

    const { data: pubs, error: pubsError } = await supabase
      .from("publications_with_stats")
      .select(`
        id,
        title,
        authors,
        type,
        year,
        abstract,
        research_areas,
        isbn,
        doi,
        citation,
        view_count,
        download_count,
        avg_rating
      `)
      .or(
        `title.ilike.${ilike},
         authors.ilike.${ilike},
         abstract.ilike.${ilike},
         type.ilike.${ilike}`
      )
      .limit(8);

    if (pubsError) {
      console.error(pubsError);
    }

    const context = {
      publication_chunks: chunks || [],
      publication_metadata: pubs || [],
    };

    const prompt = `
You are the RMRDC Current Awareness Service AI Librarian.

Use ONLY the retrieved publication context below.

If the answer is not in the context, clearly say so.

Give concise answers for users who do not want to read the full publication page by page.

Mention:
- publication title
- author/year
- page number
- DOI/ISBN
- important findings

RETRIEVED CONTEXT:
${safeJson(context)}

USER QUESTION:
${question}

ANSWER:
`;

    const response = await fetch(
      `https://api-inference.huggingface.co/models/${model}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${hfKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            max_new_tokens: 520,
            temperature: 0.2,
            return_full_text: false,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const result = await response.json();

    const answer = Array.isArray(result)
      ? result[0]?.generated_text
      : result?.generated_text || "No answer generated.";

    return new Response(
      JSON.stringify({
        answer,
        context,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: String(error?.message || error),
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});