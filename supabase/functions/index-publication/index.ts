import { createClient } from "npm:@supabase/supabase-js@2";
import { generateEmbedding, generateEmbeddings, PUBLICATION_EMBEDDING_MODEL } from "../_shared/publication-embedding.ts";

const allowedOrigins = (Deno.env.get("CORS_ALLOWED_ORIGINS") || "https://rmrdc-cas.netlify.app,http://localhost:5500,http://127.0.0.1:5500,http://localhost:5501,http://127.0.0.1:5501")
  .split(",").map(origin => origin.trim()).filter(Boolean);
const chunkSize = Math.max(600, Number(Deno.env.get("RAG_CHUNK_CHARS") || 1800));
const chunkOverlap = Math.min(chunkSize - 100, Math.max(0, Number(Deno.env.get("RAG_CHUNK_OVERLAP_CHARS") || 250)));

function headers(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.includes(origin) ? origin : "null",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: headers(req) });
}

function cleanText(value: string) {
  return String(value || "")
    .replace(/\u00ad/g, "")
    .replace(/([A-Za-z])-\s*\n\s*([a-z])/g, "$1$2")
    .replace(/[\t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function chunksForPage(text: string, pageNumber: number | null, sourceName: string, section = "") {
  const clean = cleanText(text);
  if (!clean) return [];
  const output: Array<Record<string, unknown>> = [];
  let start = 0;
  let index = 0;

  while (start < clean.length) {
    let end = Math.min(clean.length, start + chunkSize);
    if (end < clean.length) {
      const boundary = Math.max(
        clean.lastIndexOf("\n", end),
        clean.lastIndexOf(". ", end),
        clean.lastIndexOf("; ", end)
      );
      if (boundary > start + Math.floor(chunkSize * 0.55)) end = boundary + 1;
    }
    const content = clean.slice(start, end).trim();
    if (content.length > 40) {
      output.push({
        page_number: pageNumber,
        chunk_index: index++,
        content,
        source_name: sourceName,
        section: section || null,
        token_count: Math.ceil(content.length / 4)
      });
    }
    if (end >= clean.length) break;
    start = Math.max(start + 1, end - chunkOverlap);
  }
  return output;
}

function removeRepeatedPageLines(pages: Array<{ page_number?: number; content?: string }>) {
  const counts = new Map<string, number>();
  const pageLines = pages.map(page => String(page.content || "").split(/\r?\n/).map(line => line.trim()).filter(Boolean));
  for (const lines of pageLines) {
    const seen = new Set(lines.filter(line => line.length < 140));
    for (const line of seen) counts.set(line, (counts.get(line) || 0) + 1);
  }
  const repeatThreshold = Math.max(3, Math.ceil(pages.length * 0.6));
  return pages.map((page, index) => ({
    page_number: Number(page.page_number) || index + 1,
    content: pageLines[index]
      .filter(line => !(line.length < 140 && (counts.get(line) || 0) >= repeatThreshold))
      .join("\n")
  }));
}

function decodeHtml(text: string) {
  return text
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

function htmlToText(html: string) {
  const text = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg)[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<(br|\/p|\/div|\/h[1-6]|\/li|\/section|\/article|\/tr)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return cleanText(decodeHtml(text));
}

function profileText(publication: Record<string, any>) {
  const fields: Array<[string, unknown]> = [
    ["Title", publication.title], ["Authors", publication.authors], ["Publication type", publication.type],
    ["Year", publication.year], ["ISBN", publication.isbn], ["DOI", publication.doi],
    ["Abstract", publication.abstract], ["Research areas", publication.research_areas],
    ["Why this research matters", publication.research_significance], ["Key findings", publication.key_findings],
    ["Methodology", publication.methodology], ["Data and research resources", publication.data_resources],
    ["Research gaps", publication.research_gaps], ["Research implications", publication.research_implications],
    ["Study context and geography", publication.context_geography], ["Keywords", publication.keywords],
    ["Limitations", publication.limitations], ["Recommended for", publication.recommended_for]
  ];
  return fields.map(([label, value]) => {
    const normalized = Array.isArray(value) ? value.join(", ") : String(value ?? "").trim();
    return normalized ? `${label}: ${normalized}` : "";
  }).filter(Boolean).join("\n").slice(0, 20000);
}

async function embedChunks(chunks: Array<Record<string, any>>) {
  const batchSize = 16;
  for (let start = 0; start < chunks.length; start += batchSize) {
    const batch = chunks.slice(start, start + batchSize);
    const vectors = await generateEmbeddings(batch.map(chunk => chunk.content));
    batch.forEach((chunk, index) => { chunk.embedding = JSON.stringify(vectors[index]); });
  }
}

function publicObjectPath(publicUrl: string, projectUrl: string) {
  const url = new URL(publicUrl);
  if (url.host !== new URL(projectUrl).host) throw new Error("Publication PDF URL is not in the configured Supabase project.");
  const marker = "/storage/v1/object/public/";
  const markerIndex = url.pathname.indexOf(marker);
  if (markerIndex < 0) throw new Error("Publication PDF URL is not a public Supabase Storage object.");
  const remainder = decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
  const slashIndex = remainder.indexOf("/");
  if (slashIndex < 1) throw new Error("Publication PDF URL does not contain a storage path.");
  return { bucket: remainder.slice(0, slashIndex), path: remainder.slice(slashIndex + 1) };
}

async function listHtmlObjects(admin: ReturnType<typeof createClient>, prefix: string, depth = 0): Promise<Array<{ path: string; name: string }>> {
  if (depth > 6) return [];
  const { data, error } = await admin.storage.from("documents").list(prefix.replace(/\/$/, ""), { limit: 1000, offset: 0 });
  if (error) throw new Error(`Could not list HTML eBook files: ${error.message}`);
  const objects: Array<{ path: string; name: string }> = [];
  for (const item of data || []) {
    const path = `${prefix.replace(/\/$/, "")}/${item.name}`;
    if (item.id === null && !item.metadata) {
      objects.push(...await listHtmlObjects(admin, path, depth + 1));
    } else if (/\.html?$/i.test(item.name)) {
      objects.push({ path, name: item.name });
      if (objects.length > 300) throw new Error("HTML eBook contains more than 300 HTML files; split or simplify it before indexing.");
    }
  }
  return objects;
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: headers(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed." }, 405);

  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json(req, { error: "Authentication required." }, 401);
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return json(req, { error: "Indexing service is not configured." }, 503);

  const userDb = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user }, error: authError } = await userDb.auth.getUser(token);
  if (authError || !user) return json(req, { error: "Authentication required." }, 401);
  const { data: staff, error: roleError } = await userDb.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (roleError || !["admin", "editor"].includes(staff?.role)) return json(req, { error: "Admin or editor access is required." }, 403);

  const body = await req.json().catch(() => ({}));
  const publicationId = String(body.publication_id || "");
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(publicationId)) return json(req, { error: "A valid publication_id is required." }, 400);

  const admin = createClient(url, serviceKey);
  const { data: publication, error: publicationError } = await admin.from("publications").select("*").eq("id", publicationId).maybeSingle();
  if (publicationError || !publication) return json(req, { error: "Publication not found." }, 404);
  const staleProcessingBefore = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: claim, error: claimError } = await admin
    .from("publication_indexing_status")
    .update({ status: "processing", started_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString() })
    .eq("publication_id", publicationId)
    .or(`status.neq.processing,started_at.lt.${staleProcessingBefore}`)
    .select("publication_id")
    .maybeSingle();
  if (claimError) return json(req, { error: "Could not claim this publication for indexing." }, 500);
  if (!claim) return json(req, { status: "processing", publication_id: publicationId, error: "This publication is already being indexed." }, 409);

  try {
    let chunks: Array<Record<string, any>> = [];
    if (publication.publication_format === "html" || publication.ebook_path || publication.ebook_url) {
      const prefix = String(publication.ebook_path || "").replace(/^\/+|\/+$/g, "");
      if (!prefix) throw new Error("This HTML eBook has no indexed Storage folder. Upload the eBook folder to index it; external URLs are not fetched for security.");
      const files = await listHtmlObjects(admin, prefix);
      if (!files.length) throw new Error("No HTML documents were found in the eBook Storage folder.");
      for (const file of files) {
        const { data: signed, error: signedError } = await admin.storage.from("documents").createSignedUrl(file.path, 600);
        if (signedError || !signed?.signedUrl) throw new Error(`Could not read HTML file ${file.name}.`);
        const response = await fetch(signed.signedUrl, { signal: AbortSignal.timeout(20000) });
        if (!response.ok) throw new Error(`Could not download HTML file ${file.name}.`);
        const html = await response.text();
        if (html.length > 4_000_000) continue;
        const text = htmlToText(html);
        chunks.push(...chunksForPage(text, null, file.name, file.name.replace(/\.html?$/i, "")));
      }
    } else {
      let sourceUrl = "";
      if (publication.pdf_path) {
        const { data: signed, error: signedError } = await admin.storage.from("paid-documents").createSignedUrl(publication.pdf_path, 600);
        if (signedError || !signed?.signedUrl) throw new Error("Could not create a temporary URL for the private PDF.");
        sourceUrl = signed.signedUrl;
      } else if (publication.pdf_url) {
        const location = publicObjectPath(publication.pdf_url, url);
        if (location.bucket !== "documents") throw new Error("The publication PDF is not stored in the documents bucket.");
        sourceUrl = publication.pdf_url;
      } else {
        throw new Error("No full PDF Storage path or URL is recorded for this publication.");
      }
      const serviceUrl = Deno.env.get("PADDLEOCR_SERVICE_URL");
      const workerSecret = Deno.env.get("PADDLEOCR_WORKER_SECRET");
      if (!serviceUrl || !workerSecret) throw new Error("PaddleOCR-VL worker is not configured for publication indexing.");
      const workerResponse = await fetch(`${serviceUrl.replace(/\/$/, "")}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Worker-Secret": workerSecret },
        body: JSON.stringify({ document_id: publicationId, source_url: sourceUrl, source_name: `${publication.title || "RMRDC publication"}.pdf` }),
        signal: AbortSignal.timeout(180000)
      });
      if (!workerResponse.ok) throw new Error(`PaddleOCR-VL failed (${workerResponse.status}).`);
      const extraction = await workerResponse.json();
      const pages = removeRepeatedPageLines(extraction.pages || []);
      pages.forEach(page => chunks.push(...chunksForPage(page.content, page.page_number, `${publication.title || "publication"}.pdf`)));
    }

    if (!chunks.length) throw new Error("No readable text was extracted from this publication.");
    const maxChunks = 3000;
    if (chunks.length > maxChunks) throw new Error(`Publication produced ${chunks.length} chunks; limit is ${maxChunks}. Reduce the PDF page limit or chunk size.`);

    const profile = profileText(publication);
    if (!profile) throw new Error("The publication record has no searchable bibliographic or research-intelligence fields.");
    const profileEmbedding = await generateEmbedding(profile);
    await embedChunks(chunks);
    const digestText = `${publication.id}\n${profile}\n${chunks.map(chunk => chunk.content).join("\n")}`;
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(digestText));
    const sourceHash = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, "0")).join("");
    const { data: indexedCount, error: promoteError } = await admin.rpc("promote_publication_index", {
      p_publication_id: publicationId,
      p_chunks: chunks,
      p_profile_content: profile,
      p_profile_embedding: JSON.stringify(profileEmbedding),
      p_model: PUBLICATION_EMBEDDING_MODEL,
      p_source_hash: sourceHash
    });
    if (promoteError) throw new Error(`Could not commit the publication index: ${promoteError.message}`);
    return json(req, { status: "indexed", publication_id: publicationId, chunks: indexedCount, model: PUBLICATION_EMBEDDING_MODEL });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Publication indexing failed.";
    console.error("Publication indexing failed:", error);
    await admin.from("publication_indexing_status").upsert({
      publication_id: publicationId, status: "failed", last_error: message,
      updated_at: new Date().toISOString()
    });
    return json(req, { status: "failed", publication_id: publicationId, error: "Publication indexing failed. Please try again later." }, 502);
  }
});
