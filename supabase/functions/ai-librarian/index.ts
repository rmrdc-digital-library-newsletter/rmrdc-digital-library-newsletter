import { createClient } from "https://deno.land";

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
    text += `\n\nTITLE:\n${pub.title ?? ""}\nAUTHORS:\n${pub.authors ?? ""}\nYEAR:\n${pub.year ?? ""}\nABSTRACT:\n${pub.abstract ?? ""}\n`;
  }
  for (const chunk of chunks) {
    text += `\n\nPAGE ${chunk.page_number ?? ""}\n${chunk.content ?? ""}\n`;
  }
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
      parts.push(`• ${pub.title || "Untitled"}${pub.authors ? ` by ${pub.authors}` : ""}${pub.year ? ` (${pub.year})` : ""}`);
    }
  }
  if (chunks.length) {
    parts.push("Relevant extracted text:");
    for (const chunk of chunks.slice(0, 3)) {
      parts.push(`• Page ${chunk.page_number || "N/A"}: ${String(chunk.content || "").slice(0, 300)}...`);
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

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");

    if (!serviceRoleKey || !supabaseUrl) {
      return new Response(JSON.stringify({ answer: "AI Librarian config missing.", context: {} }), { status: 200, headers: corsHeaders });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const cleaned = question
      .toLowerCase()
      .replace(/\b(i|want|books|book|on|show|me|find|what|is|the|a|an|for|of|in|to|and|can|you|summarize|please)\b/gi, "")
      .replace(/[^a-z0-9\s]/g, "")
      .trim();

    const targetWord = cleaned || question.slice(0, 30);
    const ilike = `%${targetWord}%`;

    let chunks: any[] = [];
    let pubs: any[] = [];

    try {
      let chunkQuery = supabase.from("publication_chunks").select("publication_id,page_number,chunk_index,content").ilike("content", ilike).limit(15);
      if (publicationId) chunkQuery = chunkQuery.eq("publication_id", publicationId);
      const { data } = await chunkQuery;
      if (data) chunks = data;
    } catch (e) { console.error(e); }

    try {
      let pubQuery = supabase.from("publications_with_stats").select("id,title,authors,type,year,abstract").limit(5);
      if (publicationId) {
        pubQuery = pubQuery.eq("id", publicationId);
      } else {
        pubQuery = pubQuery.or(`title.ilike.${ilike},authors.ilike.${ilike}`);
      }
      const { data } = await pubQuery;
      if (data) pubs = data;
    } catch (e) { console.error(e); }

    const context = { publication_chunks: chunks, publication_metadata: pubs };
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const model = Deno.env.get("GEMINI_MODEL") || "gemini-2.0-flash";

    if (!geminiKey) {
      return new Response(JSON.stringify({ answer: fallbackAnswer(question, context), context, warning: "Missing GEMINI_API_KEY." }), { status: 200, headers: corsHeaders });
    }

    const prompt = `
You are the AI Librarian for the RMRDC Current Awareness Service.
Your responsibility is to help researchers quickly understand publications.
Always answer in clear academic English.

You MUST structure your response cleanly using these exact Markdown headers:

### Summary
[Write a natural summary in your own words based on the provided text. Never copy long paragraphs directly.]

### Key Details
1. **Main Topic**: [Insert description]
2. **Purpose of the Publication**: [Insert description]
3. **Methodology**: [Insert methodology details or explicitly state "Not mentioned in publication"]
4. **Major Findings**: [Insert description]
5. **Conclusions**: [Insert description]
6. **Recommendations**: [Insert description]

If the publication context below does not contain enough information, clearly state that and then provide general knowledge separately under the appropriate sections.

Publication Context
${buildContext(context)}

Question
${question}

Answer:
`;

    try {
      console.log('Sending prompt to Gemini API. Context sizes:', { chunks: chunks.length, pubs: pubs.length });

      // FIXED: Corrected string template variables structure to create valid URL connections
      const apiUrl = `https://googleapis.com{model}:generateContent?key=${geminiKey}`;
      
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { 
            temperature: 0.2, 
            maxOutputTokens: 1240
          }
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Gemini Endpoint rejection context:", errText);
        return new Response(JSON.stringify({ answer: fallbackAnswer(question, context), context, warning: `API error: ${errText}` }), { status: 200, headers: corsHeaders });
      }

      const result = await response.json();
      
      let answer = "";
      if (result?.candidates?.?.[0]?.content?.parts?.?.[0]?.text) {
        answer = result.candidates[0].content.parts[0].text;
      } else if (result?.content?.parts?.?.[0]?.text) {
        answer = result.content.parts[0].text;
      }

      return new Response(JSON.stringify({ answer: answer || fallbackAnswer(question, context), context }), { status: 200, headers: corsHeaders });

    } catch (e: any) {
      console.error("Gemini API connection exception:", e);
      return new Response(JSON.stringify({ answer: fallbackAnswer(question, context), context, warning: e.message }), { status: 200, headers: corsHeaders });
    }
  } catch (globalError: any) {
    return new Response(JSON.stringify({ answer: "System error.", context: {} }), { status: 500, headers: corsHeaders });
  }
});
