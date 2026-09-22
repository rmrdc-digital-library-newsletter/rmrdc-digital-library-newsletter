# RMRDC PaddleOCR-VL service

This is the self-hosted document reader. It processes PDFs already stored by RMRDC; investors never send files to this service.

## Local CPU setup

```powershell
py -m venv .venv-paddleocr
.\.venv-paddleocr\Scripts\Activate.ps1
py -m pip install -r document-intelligence/requirements.txt
$env:PADDLEOCR_WORKER_SECRET = '<long-random-secret>'
py -m uvicorn document-intelligence.app:app --host 127.0.0.1 --port 8090
```

PaddleOCR-VL downloads its model on first use. For a GPU deployment, follow the official PaddleOCR-VL Docker/Compose instructions and set `PADDLEOCR_DEVICE` appropriately. The worker API is intended to be reachable only by the Supabase processing service or a private backend network.

## Contract

`POST /process` requires `X-Worker-Secret` and accepts a short-lived repository URL, document ID, technology ID, source filename, and optional SHA-256 hash. It returns page-numbered Markdown, structured JSON, and source metadata. It does not expose local paths or accept an investor-facing upload.
