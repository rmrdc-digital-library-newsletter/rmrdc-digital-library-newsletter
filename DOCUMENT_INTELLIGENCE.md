# RMRDC Document Intelligence

## Architecture

`RMRDC PDF repository -> PaddleOCR-VL -> page JSON/Markdown -> Supabase chunks -> access-filtered retrieval -> Gemini Flash -> profile fields, summaries, and investor answers`

The repository is a static frontend with Supabase Edge Functions. PaddleOCR-VL therefore runs as a separate private Python service; it is never loaded in browser JavaScript and no investor upload route was added.

## Files

- `document-intelligence/app.py`: self-hosted PaddleOCR-VL worker.
- `document-intelligence/requirements.txt`: Python runtime dependencies.
- `document-intelligence/Dockerfile`: container entrypoint.
- `sql/SUPABASE_PADDLEOCR_VL_DOCUMENT_INTELLIGENCE.sql`: document, chunk, insight, job, RLS, and retrieval RPC schema.
- `supabase/functions/process-technology-document/index.ts`: staff-authenticated orchestration, signed repository URL, OCR persistence, Gemini field mapping, retry/error status.
- `supabase/functions/sync-technology-documents/index.ts`: staff-authenticated Storage hash synchronization and automatic processing of new/changed registered documents.
- `supabase/functions/technology-ai/index.ts`: investor technology chat with authorization before retrieval and Gemini context construction.
- `js/technology-ai.js`: one profile-level Ask AI action; it does not expose secrets.
- `admin/js/document-intelligence.js`: staff process/retry table.

## Configuration

1. Run the SQL migration in Supabase.
2. Start the worker from the repository root:

```powershell
py -m venv .venv-paddleocr
.\.venv-paddleocr\Scripts\Activate.ps1
py -m pip install -r document-intelligence/requirements.txt
$env:PADDLEOCR_WORKER_SECRET = '<long-random-secret>'
py -m uvicorn document-intelligence.app:app --host 127.0.0.1 --port 8090
```

3. Configure Supabase Edge Function secrets:

- `PADDLEOCR_SERVICE_URL`: private URL for the worker.
- `PADDLEOCR_WORKER_SECRET`: same secret as the worker.
- `SUPABASE_STORAGE_HOST`: Supabase project hostname accepted by the worker, for example `phfvgkcnvwetxlgigsfx.supabase.co`.
- `DOCUMENT_PROCESSING_INTERNAL_SECRET`: private Edge Function-to-Edge Function secret used by the sync function.
- `CORS_ALLOWED_ORIGINS`: comma-separated deployed frontend origins plus local development origins.
- `GEMINI_API_KEY`: existing server-side Gemini key.
- `GEMINI_MODEL`: existing model override, default `gemini-2.5-flash`.

4. Deploy `process-technology-document`, `sync-technology-documents`, and `technology-ai` with the existing Supabase deployment process.

PaddleOCR-VL downloads its model on first use. GPU deployments should use the official PaddleOCR-VL Docker/Compose deployment; CPU is supported but slower.

## Docker CPU commands

Run these commands from the repository root, not from inside `document-intelligence`:

```powershell
docker build -f document-intelligence/Dockerfile -t rmrdc-paddleocr-vl .
docker run --rm -p 8090:8090 `
	-e PADDLEOCR_WORKER_SECRET="replace-with-a-long-random-secret" `
	-e SUPABASE_STORAGE_HOST="phfvgkcnvwetxlgigsfx.supabase.co" `
	-e PADDLEOCR_DEVICE="cpu" `
	-e PADDLEOCR_MAX_DOWNLOAD_BYTES="104857600" `
	rmrdc-paddleocr-vl
```

The first `/health` request initializes the OCR pipeline and may download the model. A successful HTTP response with `ready: true` confirms model initialization, not just that FastAPI is listening.

## Document registration

Existing PDFs remain in the current RMRDC storage repository. Staff register each repository object in `technology_documents` with its private storage bucket/path, technology ID, filename, and `access_tier` (`demo`, `subscriber`, or `staff`) from the Technology Opportunities admin page. The `sync-technology-documents` function creates a short-lived signed URL, hashes the private PDF, skips completed records with the same hash, and invokes processing for new or changed files. Missing Storage objects are marked `missing`; historical chunks and insights are retained but excluded from current retrieval by the processing state. Run sync from a protected scheduler or the staff admin action; no investor upload route exists.

The sync downloads registered PDFs to calculate hashes. This is intentionally simple and may become expensive for large repositories.

## Authorization

The retrieval RPC checks the authenticated user before returning chunks. Demo chunks are available to authenticated demo users; subscriber/staff chunks require the existing active subscription or staff role. The Edge Function uses the user's bearer token for retrieval and never sends unauthorized chunks to Gemini.

## Tests

- Worker health: `GET http://127.0.0.1:8090/health`.
- OCR smoke test: process a normal, scanned, multi-page, table, and complex-layout PDF through the staff admin action.
- Verify `technology_documents.status` becomes `completed`, `failed`, or `empty` and that retry creates a new processing job.
- Ask the profile AI for TRL/raw materials/process and verify returned filename/page citations.
- Repeat as a demo user and subscriber; confirm restricted chunks are absent from the Gemini request context.
- Re-run an unchanged document and verify the same storage hash is reused rather than creating duplicate document records.
