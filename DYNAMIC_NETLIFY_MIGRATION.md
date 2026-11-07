# Dynamic page delivery on Netlify

The site now uses Next.js with Netlify's Next.js adapter. HTML page templates live in `legacy-pages/`; requests to `/`, `.html` URLs, and extensionless page URLs are handled by Next.js route handlers and returned from Netlify's server runtime with `Cache-Control: no-store`. CSS, JavaScript, images, and other browser assets live in `public/` and remain cacheable.

## Deploy

1. Set the Netlify base directory to this project directory.
2. Set the build command to `npm run build` and the publish directory to `.next` (also declared in `netlify.toml`).
3. Install from `package.json` with `npm install` or the site's configured package manager, then deploy.
4. Keep the Supabase publishable/anon key in the existing browser configuration. Never put a Supabase service-role key in `public/` or client JavaScript.

## What is dynamic now

- Page requests go through Next.js on Netlify instead of being served directly from the static publish directory.
- Each page response is generated at request time from its retained HTML template and is not cached by Netlify or the service worker.
- Existing browser-side Supabase queries and authentication continue to run after page load.

The existing pages have not yet been rewritten as React Server Components, and authenticated Supabase records are still loaded in the browser. Personalizing the initial HTML from server-side Supabase data requires the next migration step: move auth sessions to secure cookies, use `@supabase/ssr`, and convert the data-heavy routes to server components or server actions. This keeps the current upload and portal behavior intact during the hosting change.
