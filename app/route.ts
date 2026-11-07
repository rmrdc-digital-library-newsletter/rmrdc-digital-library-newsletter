import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function renderHome() {
  const filename = path.join(process.cwd(), "legacy-pages", "index.html");
  try {
    const html = await readFile(filename, "utf8");
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, no-store, max-age=0, must-revalidate",
        "X-Page-Rendering": "netlify-server"
      }
    });
  } catch {
    return new Response("Page unavailable", { status: 500 });
  }
}

export const GET = renderHome;
export const HEAD = renderHome;
