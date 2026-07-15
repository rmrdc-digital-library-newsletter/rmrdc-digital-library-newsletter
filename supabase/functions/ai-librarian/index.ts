import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

function buildContext(context: any): string {
  const pubs = context.publication_metadata || [];
  const chunks = context.publication_chunks || [];

  let text = "";

  for (const pub of pubs) {
    text += `

TITLE:
${pub.title ?? ""}

AUTHORS:
${pub.authors ?? ""}

YEAR:
${pub.year ?? ""}

ABSTRACT:
${pub.abstract ?? ""}

`;
  }

  for (const chunk of chunks) {
    text += `

PAGE ${chunk.page_number ?? ""}

${chunk.content ?? ""}

`;
  }

  // FIXED: Removed the low slice constraint (0, 18000) so Gemini can ingest the full document context.
  return text;
}

function fallbackAnswer(question: string, context: any) {
  const chunks = context.publication_chunks || [];
  const pubs = context.publication_metadata || [];

  if (!chunks.length && !pubs.length) {
    return "I could not find matching information in the indexed publications yet. Try a keyword from the title, author, raw material, ISBN, DOI, or abstract.";
  }

  const parts: string[] = [];

  if (pubs.length) {
    parts.push("I found these related publication records:");
    for (const pub of pubs.slice(0, 3)) {
      parts.push(`• ${pub.title || "Untitled"}${pub.authors ? ` by ${pub.authors}` : ""}${pub.year ? ` (${pub.year})` : ""}${pub.isbn ? `. ISBN: ${pub.isbn}` : ""}${pub.doi ? `. DOI: ${pub.doi}` : ""}`);
      if (pub.abstract) {
        parts.push(`  Summary: ${String(pub.abstract).slice(0, 450)}${String(pub.abstract).length > 450 ? "..." : ""}`);
      }
    }
  }

  if (chunks.length) {
    parts.push("Relevant extracted text:");
    for (const chunk of chunks.slice(0, 3)) {
      parts.push(`• Page ${chunk.page_number || "N/A"}: ${String(chunk.content || "").slice(0, 500)}${String(chunk.content || "").length > 500 ? "..." : ""}`);
    }
  }

  parts.push("This fallback answer is based on available database context.");
  return parts.join("\n\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const question = String(body.question || "").trim();
    const publicationId = body.publication_id || body.publicationId || null;

    if (!question) {
      return new Response(JSON.stringify({ answer: "Please enter a question.", context: {} }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    const serviceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
      Deno.env.get("SERVICE_ROLE_KEY");

    if (!serviceRoleKey) {
      return new Response(
        JSON.stringify({
          answer: "AI Librarian is not fully configured. Missing Supabase service role key.",
          error: "Missing SERVICE_ROLE_KEY",
          context: {},
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");

    if (!supabaseUrl) {
      return new Response(
        JSON.stringify({
          answer: "AI Librarian is not fully configured. Missing SUPABASE_URL.",
          error: "Missing SUPABASE_URL",
          context: {},
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const words = question
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.replace(/[^a-z0-9]/g, ""))
      .filter((w) => w.length > 2);

    console.log('AI-Librarian search terms:', words.slice(0, 12));

    const q = words[0] || question.slice(0, 30);
    const ilike = `%${q}%`;

    let chunks: any[] = [];
    let pubs: any[] = [];

    try {
      let chunkQuery = supabase
        .from("publication_chunks")
        .select("publication_id,page_number,chunk_index,content")
        .ilike("content", ilike)
        .limit(30);

      if (publicationId) chunkQuery = chunkQuery.eq("publication_id", publicationId);

      const { data, error } = await chunkQuery;
      if (!error && data) chunks = data;
      if (error) console.error("publication_chunks error:", error);
      console.log('publication_chunks fetched:', Array.isArray(chunks) ? chunks.length : 0, 'sample:', chunks && chunks[0] ? String(chunks[0].content || '').slice(0,160) : 'none');
    } catch (e) {
      console.error("publication_chunks exception:", e);
    }

    try {
      let pubQuery = supabase
        .from("publications_with_stats")
        .select("id,title,authors,type,year,abstract,research_areas,isbn,doi,citation,view_count,download_count,avg_rating,pdf_url,ebook_url,publication_format")
        .limit(15);

      if (publicationId) {
        pubQuery = pubQuery.eq("id", publicationId);
      } else {
        pubQuery = pubQuery.or(`title.ilike.${ilike},authors.ilike.${ilike},abstract.ilike.${ilike},type.ilike.${ilike}`);
      }

      const { data, error } = await pubQuery;
      if (!error && data) pubs = data;
      if (error) console.error("publications_with_stats error:", error);
      console.log('publications_with_stats fetched:', Array.isArray(pubs) ? pubs.length : 0, 'sample title:', pubs && pubs[0] ? pubs[0].title : 'none');
    } catch (e) {
      console.error("publications_with_stats exception:", e);
    }

    const context = {
      publication_chunks: chunks,
      publication_metadata: pubs,
    };

    // UPDATED: Now looks for GEMINI_API_KEY from Google AI Studio instead of Hugging Face
    const geminiKey = Deno.env.get("GEMINI_API_KEY");

    if (!geminiKey) {
      return new Response(
        JSON.stringify({
          answer: fallbackAnswer(question, context),
          context,
          warning: "Missing GEMINI_API_KEY. Returned database fallback answer.",
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Default to the fast and free gemini-2.0-flash model
    const model = Deno.env.get("GEMINI_MODEL") || "gemini-2.0-flash";

    // UPDATED: Standardized prompt to explicitly enforce your Markdown structure
    const prompt = `
You are the AI Librarian for the RMRDC Current Awareness Service.
Your responsibility is to help researchers, students, policymakers and industry professionals quickly understand publications.
Always answer in clear academic English.

If the user asks for a summary, you MUST structure your response cleanly using these exact Markdown headers:

### Summary
[Write a natural summary in your own words. Never copy long paragraphs directly.]

### Key Details
1. **Main Topic**: [Insert description]
2. **Purpose of the Publication**: [Insert description]
3. **Methodology**: [Insert methodology details or explicitly state "Not mentioned in publication"]
4. **Major Findings**: [Insert description]
5. **Conclusions**: [Insert description]
6. **Recommendations**: [Insert description]

If the user asks another question, answer using the publication.
If the publication does not contain enough information, clearly state that and then provide general knowledge separately.

Publication Context
${buildContext(context)}

Question
${question}

Answer:
`;

    try {
      console.log('Sending prompt to Gemini API. Context sizes:', { chunks: (context.publication_chunks || []).length, pubs: (context.publication_metadata || []).length });
      
      // UPDATED: HTTP fetch payload directly mapped to Google Gemini API architectures
      const response = await fetch(`https://googleapis.com{model}:generateContent?key=${geminiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1000 // Higher token space for your formatted summary blocks
          }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Gemini API error:", errorText);

        return new Response(
          JSON.stringify({
            answer: fallbackAnswer(question, context),
            context,
            warning: `Gemini API failed. ${errorText}`,
          }),
          { status: 200, headers: corsHeaders }
        );
      }

      const result = await response.json();
      
      // Parse Gemini response structure
      const answer = result?.candidates?.[0]?.content?.parts?.[0]?.text || "";

      return new Response(
        JSON.stringify({
          answer: answer || fallbackAnswer(question, context),
          context,
        }),
        { status: 200, headers: corsHeaders }
      );

    } catch (apiError: any) {
      console.error("Gemini API connection exception:", apiError);
      return new Response(
        JSON.stringify({
          answer: fallbackAnswer(question, context),
          context,
          warning: `Gemini Exception: ${apiError.message || apiError}`,
        }),
        { status: 200, headers: corsHeaders }
      );
    }

  } catch (globalError: any) {
    console.error("Global runtime error:", globalError);
    return new Response(
      JSON.stringify({
        answer: "A critical runtime error occurred within the Edge Function.",
        error: globalError.message || String(globalError),
        context: {},
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
