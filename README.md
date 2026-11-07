# RMRDC Digital Library — Production Scaffold

This package gives you a Netlify-hosted digital library frontend backed by Supabase for:

- publication search and filtering
- cover-card bookshelf with eight shelf rows per page and responsive pagination
- publication detail + flipbook-style reader
- analytics counters for views and downloads
- role-based admin upload page
- institutional styling you can brand further for RMRDC

## Folder structure

- `index.html` — public library homepage
- `viewer.html` — publication reader page
- `admin/` — staff login and upload area
- `css/styles.css` — site styles
- `js/` — application scripts
- `supabase/setup.sql` — database schema and security policies
- `netlify.toml` — Netlify deployment config

## Before you deploy

You need:

1. a GitHub account
2. a Supabase account
3. a Netlify account

---

## Step 1 — Create a GitHub repository

1. Unzip this project.
2. Create a new GitHub repository, for example `rmrdc-digital-library`.
3. Upload all files from the unzipped folder to the repository root.

Important: `index.html` must stay at the top level.

---

## Step 2 — Create your Supabase project

1. In Supabase, create a new project.
2. Wait until the database is ready.
3. Open **SQL Editor**.
4. Copy everything from `supabase/setup.sql` and run it.
5. Run `sql/SUPABASE_PUBLICATION_UPLOAD_UPGRADE.sql` to add the full publication upload schema and Storage permissions. This is required for existing projects too.
6. Run `sql/SUPABASE_PUBLICATION_RAG_UPGRADE.sql` to add page-vector storage, hybrid retrieval, indexing status, and the publication profile fields to existing deployments.

This creates:

- `profiles`
- `publications`
- `view_events`
- `download_events`
- `publications_with_stats`
- role-based security rules

## Publication AI Auto Fill

Deploy the staff-only profile generator after setting both the Gemini and Hugging Face keys as Supabase Edge Function secrets. Autofill retrieves the most relevant excerpts for each field with MiniLM, then asks Gemini to write only what those excerpts support:

```powershell
supabase secrets set GEMINI_API_KEY="REPLACE_WITH_GEMINI_API_KEY" GEMINI_MODEL="gemini-2.5-flash" HUGGINGFACE_API_KEY="REPLACE_WITH_HUGGINGFACE_TOKEN"
supabase secrets set CORS_ALLOWED_ORIGINS="https://rmrdc-cas.netlify.app,http://localhost:5500,http://127.0.0.1:5500,http://localhost:5501,http://127.0.0.1:5501"
supabase functions deploy generate-publication-profile
```

The Auto Fill action extracts text from sampled pages across the PDF, including its opening and closing pages. It retrieves field-specific evidence before asking Gemini for the abstract and research profile; unsupported fields remain empty. Scanned PDFs can still upload and be OCR-indexed when the OCR worker is configured, but require searchable text for pre-upload autofill. API keys stay server-side.

## Publication RAG Assistant

The publication assistant combines the canonical publication/Research Intelligence record, page-level chunks, PostgreSQL full-text matching, and 384-dimensional `sentence-transformers/all-MiniLM-L6-v2` embeddings. Gemini Flash generates the final evidence-grounded answer and citations. The embeddings and Gemini keys are only used by Supabase Edge Functions.

Configure these Supabase Edge Function secrets:

- `HUGGINGFACE_API_KEY` for MiniLM embeddings. The hosted endpoint has provider quotas; it is not unlimited free compute.
- `EMBEDDING_MODEL` optionally overrides the default MiniLM model. Do not change it without re-embedding all records and matching the database vector dimension.
- `PADDLEOCR_SERVICE_URL` and `PADDLEOCR_WORKER_SECRET` for the existing private OCR worker.
- `SUPABASE_STORAGE_HOST` for the worker's allowed Supabase Storage hostname.
- `GEMINI_API_KEY` and optionally `GEMINI_MODEL` for grounded answer generation.
- `CORS_ALLOWED_ORIGINS` including local development and deployed site origins.

Deploy the assistant and indexing functions:

```powershell
supabase functions deploy ai-librarian
supabase functions deploy index-publication
supabase functions deploy recommend-publications
supabase functions deploy generate-publication-profile
```

The admin publication list shows indexing status and supports retrying failed records. Uploads validate the PDF signature and size, save the original to Supabase Storage, and open it in the PDF flipbook viewer. The upload flow then waits for indexing and reports whether page-level evidence was indexed; OCR or model outages do not roll back the saved publication, and failed records can be retried from Manage Publications. PDF indexing requires the OCR worker to be reachable from Supabase; HTML eBook indexing reads HTML files from the existing `documents` bucket. External eBook URLs are intentionally not fetched by the indexer.

## Paystack payments for paid publications

Run `supabase/payments-setup.sql` in the Supabase SQL Editor. It creates a private purchase ledger; payment records are accessible only to Supabase Edge Functions using the service-role key. Paid PDFs must be uploaded as private files using the `paid-documents` bucket, with their storage path saved in `publications.pdf_path`.

In Paystack **Test Mode**, copy the Test Secret Key from **Settings → API Keys & Webhooks** and store it as a Supabase Edge Function secret. Do not put the secret key in frontend code, commit it, or send it in chat. Keep any existing `SITE_URL` secret unchanged. `PAYSTACK_CALLBACK_URL` optionally overrides the payment-return page; for local testing set it to `http://localhost:3000/viewer.html` (or port 3001). If it is omitted, the function uses the existing `SITE_URL` and appends `/viewer.html`.

```powershell
supabase secrets set PAYSTACK_SECRET_KEY="sk_test_REPLACE_WITH_YOUR_TEST_SECRET" PAYSTACK_CALLBACK_URL="http://localhost:3000/viewer.html"
supabase secrets set CORS_ALLOWED_ORIGINS="https://YOUR-LIBRARY-DOMAIN,http://localhost:3000,http://localhost:3001"
supabase functions deploy paystack-initialize
supabase functions deploy paystack-verify
```

Keep the production site URL in `SITE_URL`, because other Edge Functions may rely on it. The checkout charges the publication's configured price in NGN. Paystack verifies the transaction server-side against the expected amount, currency and buyer email; only then does the viewer receive a 15-minute signed URL for the private PDF. Test with Paystack test credentials before switching the Edge Function secret to a live secret key.

## Publication email notifications

Run `supabase/email-setup.sql` in the Supabase SQL Editor. It creates and upgrades the subscriber preferences and notification log schema used by the upload alert function. Then configure a Resend API key and a sender address on a verified Resend domain, and deploy the function:

```powershell
supabase secrets set RESEND_API_KEY="re_..." NOTIFICATION_FROM_EMAIL="RMRDC Digital Library <alerts@your-verified-domain>" SITE_URL="https://rmrdc-cas.netlify.app"
supabase secrets set CORS_ALLOWED_ORIGINS="https://rmrdc-cas.netlify.app,http://localhost:5500,http://127.0.0.1:5500,http://localhost:5501,http://127.0.0.1:5501"
supabase secrets set CAS_CAMPAIGN_CRON_SECRET="USE-A-LONG-RANDOM-VALUE"
supabase functions deploy send-publication-email
```

Supabase supplies `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions. New public registrations are added to the subscriber list from their selected interests and email-alert preference, including when email confirmation is enabled. In **Admin → Subscribers**, administrators can view the full list and enable or disable publication-email delivery for each person. An alert is sent only when the subscriber has opted in, admin delivery is enabled, the subscriber is active, and at least one selected research area matches the publication. The Alert Notifications area also includes a newsletter composer: send to all eligible subscribers, filter by research area, or choose individual recipients; preview and test the message; then send now or schedule it. Campaigns are stored in a durable queue, retried on provider failures, and include unsubscribe links. After upload, the admin page reports email and WhatsApp delivery counts and surfaces delivery errors. WhatsApp alerts additionally require `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, and an approved `WHATSAPP_TEMPLATE_NAME` template. A successful function response confirms provider acceptance, not inbox placement.

Deploy the campaign and unsubscribe functions alongside the publication alert function:

```powershell
supabase functions deploy send-cas-email-campaigns
supabase functions deploy cas-email-unsubscribe
supabase functions deploy resend-cas-email-webhook
supabase functions deploy send-publication-email
supabase functions deploy create-research-user
```

For campaign delivery analytics, add a Resend webhook pointing to `https://YOUR-PROJECT.supabase.co/functions/v1/resend-cas-email-webhook`. Subscribe to `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`, `email.opened`, `email.clicked`, `email.failed`, and `email.suppressed`. Copy its signing secret from Resend and set it in Supabase with `supabase secrets set RESEND_WEBHOOK_SECRET="whsec_..."`. The endpoint verifies the Svix signature against the raw request and ignores duplicate event IDs.

Set `CAS_CAMPAIGN_FROM_EMAIL` to the campaign sender on your verified campaign domain (for example, `RMRDC CAS <newsletter@campaigns.your-domain>`). This keeps campaign-specific tracking configuration separate from other application emails.

Open and click events require tracking to be enabled for the sending domain in Resend's domain configuration. Configure and verify the tracking subdomain there before expecting engagement counts. Resend applies tracking settings at the sending-domain level; use a dedicated, verified campaign sending domain and set `CAS_CAMPAIGN_FROM_EMAIL="RMRDC CAS <newsletter@campaigns.your-domain>"` so campaign tracking does not change transactional email behavior. Open counts are approximate because mail privacy features can block or prefetch tracking pixels; delivered/opened/clicked totals count unique recipients, while each recipient row also shows event counts.

To process scheduled campaigns and drain large immediate sends, enable the Supabase `pg_cron`, `pg_net`, and Vault extensions. Set `CAS_CAMPAIGN_CRON_SECRET` in Edge Function secrets to a long random value. Store the same value, your project URL, and your Supabase anon/publishable key in Vault, then run `supabase/cas-email-scheduler.sql`:

```sql
select vault.create_secret('https://YOUR-PROJECT.supabase.co', 'cas_project_url');
select vault.create_secret('YOUR_SUPABASE_ANON_KEY', 'cas_publishable_key');
select vault.create_secret('YOUR_CAS_CAMPAIGN_CRON_SECRET', 'cas_campaign_cron_secret');
```

The scheduler processes due campaigns every minute. Run the updated `supabase/email-setup.sql` before deploying these functions, then publish the updated frontend to Netlify.

---

## Step 3 — Create storage buckets

The publication upload upgrade creates these buckets and staff upload policies:

- `covers` → Public bucket
- `documents` → Public bucket
- `paid-documents` → Private bucket

These names must match the values in `js/config.js`.

---

## Step 4 — Enable email authentication

1. Go to **Authentication** in Supabase.
2. Enable **Email** sign-in.
3. Create at least one user in **Authentication > Users**.
4. After the user is created, go to the `profiles` table and change that user's role:

- `admin` for full control
- `editor` for upload access
- `viewer` for read-only

You can update a role using SQL like this:

```sql
update public.profiles
set role = 'admin'
where id = 'YOUR_USER_UUID';
```

---

## Step 5 — Add your Supabase keys to the site

Open `js/config.js` and replace the placeholders:

```js
window.APP_CONFIG = {
  SUPABASE_URL: "https://YOUR-PROJECT.supabase.co",
  SUPABASE_ANON_KEY: "YOUR_SUPABASE_ANON_KEY",
  STORAGE_BUCKET_COVERS: "covers",
  STORAGE_BUCKET_DOCUMENTS: "documents"
};
```

Use the **Project URL** and **anon public key** from **Supabase > Settings > API**.

---

## Step 6 — Connect GitHub to Netlify

1. In Netlify, choose **Add new site**.
2. Select **Import an existing project**.
3. Connect GitHub and select your repository.
4. Build settings:
   - Build command: leave empty
   - Publish directory: `.`
5. Deploy.

After deployment, your site will have URLs similar to:

- `https://your-site.netlify.app/`
- `https://your-site.netlify.app/admin/`

---

## Step 7 — Sign in to the admin page

1. Open `/admin/`.
2. Sign in with your Supabase staff account.
3. Upload:
   - cover image
   - PDF document
   - title, authors, type, year, abstract

After upload:

- the cover appears on the homepage
- the viewer page loads the PDF in the flipbook area
- views and downloads begin counting automatically

---

## How analytics works

- opening a publication viewer inserts a row in `view_events`
- clicking download inserts a row in `download_events`
- counts are aggregated in `publications_with_stats`

These counters are visible on the homepage sort option and in the viewer sidebar.

---

## How roles work

- `admin` — can upload and manage content, and can read profile rows
- `editor` — can upload and update publications
- `viewer` — cannot upload

The admin page checks the signed-in user's role before enabling upload inputs.

---

## Flipbook note

This package uses PDF.js to render pages and PageFlip to create a flipbook-style reading experience.

That means:

- it behaves like a book viewer
- it works with standard PDFs
- very large scanned PDFs may load more slowly

For very large files, encourage users to also use the direct PDF open button.

---

## Recommended next enhancements

1. edit and delete publications from the admin panel
2. cover image fallback generation
3. subject tags and keyword taxonomy
4. dashboard charts for analytics
5. custom domain like `library.rmrdc.gov.ng`

---

## Troubleshooting

### Nothing loads on the homepage
Check `js/config.js` and confirm your Supabase URL and anon key are correct.

### Admin login works but upload is disabled
Your user probably has `viewer` role. Update `profiles.role` to `admin` or `editor`.

### Covers or PDFs do not open
Check that your storage buckets are public and named exactly `covers` and `documents`.

### Netlify deploy works locally but not online
Confirm the repository root contains `index.html` and that Netlify publish directory is `.`


## RMRDC Research-to-Industry Intelligence Platform concept

This version reframes the original Digital Library/CAS site as a proposed **Research-to-Industry Intelligence Platform**. The digital library remains the evidence base, while the new interface introduces:

- Investor and industry information pathways
- Technology and research opportunity profiles
- Raw-material intelligence
- Sector intelligence briefs
- Example investor decision filters
- Research-to-industry matching concepts
- An AI-assisted research discovery layer

The platform is structured around validated institutional information requirements and is designed to connect RMRDC research evidence with industry, investment, raw-material and commercialization workflows. Investor preferences are captured as structured profile data so that matching and CAS/SDI delivery can be personalized.

### Portal dashboards
- `researcher-portal.html` — rich researcher workspace for technology submission, TRL, investor interest, engagement, analytics and deal-room workflows.
- `investor-portal.html` — rich investor/industry workspace for technology discovery, matching, market intelligence, saved opportunities, information requests and engagement.


## v3.0 Research-to-Industry Intelligence Upgrade

The v3 migration adds an additive research-to-industry workflow without replacing the v2.9 CAS/SDI foundation.

### New modules

- `technology-opportunity.html` — controlled public opportunity profile with premium-field locking.
- `investor-portal.html` — existing investor workspace retained and linked to the new workflow.
- `fabricator-portal.html` — engineering/fabrication capability profile and deployment pathway.
- `dealroom.html` — participant workspace for engagement through commercialisation.
- `admin/technology-opportunities.html` — RMRDC review, approval and investor-request workspace.
- `sql/SUPABASE_RESEARCH_TO_INDUSTRY_V3_UPGRADE.sql` — additive database migration.

### New database entities

`platform_subscriptions`, `technology_opportunities`, `investor_profiles_v2`, `investor_requests`, `technology_investor_submissions`, `fabricator_profiles_v2`, `fabrication_requests`, `dealrooms`, `dealroom_activities`, and `platform_notifications`.

### Access model

Basic discovery is public. Detailed technical, production, market, investment, regulatory and engagement fields are treated as controlled information. An active record in `platform_subscriptions` unlocks premium fields in the opportunity detail page.

For real payment processing, connect the subscription activation workflow to the organisation's selected payment provider. The supplied migration intentionally does not invent a payment provider or expose secret credentials.

### Recommended deployment order

1. Keep the existing v2.9 schema and working portals.
2. Run `sql/SUPABASE_RESEARCH_TO_INDUSTRY_V3_UPGRADE.sql`.
3. Verify RLS policies with test accounts for Admin, Editor, Researcher, Investor and Fabricator.
4. Create/approve technology opportunity records.
5. Activate subscriptions through the chosen billing workflow.
6. Test the complete pathway: Researcher → Technology → RMRDC Validation → Investor Match → Interest → Fabricator/Engineer → Dealroom → Commercialisation.

### Governance note

The migration makes RMRDC staff the approval boundary for investor-facing opportunities. Researchers can create/update their own opportunity records, but public discovery is restricted to `visibility='approved'`. Detailed commercial information should still be reviewed for confidentiality, IP and disclosure suitability before approval.
