# RMRDC Digital Library — Production Scaffold

This package gives you a Netlify-hosted digital library frontend backed by Supabase for:

- publication search and filtering
- cover-card gallery view
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

This creates:

- `profiles`
- `publications`
- `view_events`
- `download_events`
- `publications_with_stats`
- role-based security rules

---

## Step 3 — Create storage buckets

In Supabase Storage, create these buckets:

- `covers` → Public bucket
- `documents` → Public bucket

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
