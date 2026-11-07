import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = { params: Promise<{ path: string[] }> };

async function renderPage(_request: Request, context: RouteContext) {
  const { path: segments } = await context.params;
  let cleanSegments: string[];
  try {
    cleanSegments = segments.map((segment) => decodeURIComponent(segment));
  } catch {
    return new Response("Not found", { status: 404 });
  }

  if (cleanSegments.some((segment) => segment === "." || segment === ".." || segment.includes("\\") || segment.includes("\0"))) {
    return new Response("Not found", { status: 404 });
  }

  const relativePath = cleanSegments.join("/");
  const candidates = relativePath.endsWith(".html")
    ? [relativePath]
    : [`${relativePath}.html`, `${relativePath}/index.html`];
  const templateRoot = path.resolve(process.cwd(), "legacy-pages");

  for (const candidate of candidates) {
    const filename = path.resolve(templateRoot, candidate);
    if (!filename.startsWith(`${templateRoot}${path.sep}`)) continue;

    try {
      const html = await readFile(filename, "utf8");
      return new Response(html, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "private, no-store, max-age=0, must-revalidate",
          "X-Page-Rendering": "netlify-server"
        }
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        return new Response("Page unavailable", { status: 500 });
      }
    }
  }

  return new Response("Not found", { status: 404 });
}

export const GET = renderPage;
export const HEAD = renderPage;
