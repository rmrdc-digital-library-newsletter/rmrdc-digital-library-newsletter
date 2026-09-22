"""Self-hosted PaddleOCR-VL document extraction service.

This service never accepts investor uploads. The Supabase processing function
passes a short-lived repository URL for an administrator-triggered job.
"""
from __future__ import annotations

import hashlib
import json
import os
import tempfile
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, HttpUrl

app = FastAPI(title="RMRDC PaddleOCR-VL", version="1.0.0")
_pipeline = None


class ProcessRequest(BaseModel):
    document_id: str
    technology_id: str | None = None
    source_url: HttpUrl
    source_name: str = "RMRDC document.pdf"
    source_hash: str | None = None


def pipeline():
    global _pipeline
    if _pipeline is None:
        from paddleocr import PaddleOCRVL
        _pipeline = PaddleOCRVL(device=os.getenv("PADDLEOCR_DEVICE", "cpu"))
    return _pipeline


def validate_source_url(source_url: HttpUrl) -> str:
    hostname = (urlparse(str(source_url)).hostname or '').lower()
    allowed = os.getenv('SUPABASE_STORAGE_HOST', '').lower().strip()
    if not allowed or hostname != allowed:
        raise HTTPException(status_code=400, detail='Source URL is not an approved Supabase Storage host')
    return hostname


def result_json(result: Any, output_dir: Path) -> dict[str, Any]:
    result.save_to_json(save_path=output_dir)
    files = sorted(output_dir.glob("*.json"))
    if files:
        return json.loads(files[-1].read_text(encoding="utf-8"))
    return {}


def result_markdown(result: Any, output_dir: Path) -> str:
    result.save_to_markdown(save_path=output_dir)
    files = sorted(output_dir.glob("*.md"))
    return files[-1].read_text(encoding="utf-8") if files else ""


def page_record(page_number: int, payload: dict[str, Any], markdown: str, filename: str) -> dict[str, Any]:
    text = markdown.strip()
    return {
        "page_number": page_number,
        "section": payload.get("parsing_res_list") or payload.get("layout_res_list") or [],
        "content": text,
        "structured": payload,
        "source": {"filename": filename, "page_number": page_number},
    }


@app.get("/health")
def health():
    try:
        pipeline()
        return {"ok": True, "ready": True, "service": "paddleocr-vl", "model": os.getenv("PADDLEOCR_MODEL", "PaddleOCR-VL")}
    except Exception as error:
        return {"ok": False, "ready": False, "service": "paddleocr-vl", "error": str(error)}


@app.post("/process")
async def process(request: ProcessRequest, x_worker_secret: str | None = Header(default=None)):
    expected = os.getenv("PADDLEOCR_WORKER_SECRET")
    if not expected or x_worker_secret != expected:
        raise HTTPException(status_code=401, detail="Invalid worker credentials")

    validate_source_url(request.source_url)
    max_pages = int(os.getenv("PADDLEOCR_MAX_PAGES", "100"))
    max_bytes = int(os.getenv("PADDLEOCR_MAX_DOWNLOAD_BYTES", str(100 * 1024 * 1024)))
    with tempfile.TemporaryDirectory(prefix="rmrdc-ocr-") as temp:
        root = Path(temp)
        pdf_path = root / "source.pdf"
        output_dir = root / "output"
        output_dir.mkdir()
        async with httpx.AsyncClient(timeout=httpx.Timeout(180, connect=15), follow_redirects=False) as client:
            response = await client.get(str(request.source_url))
            response.raise_for_status()
            content_length = int(response.headers.get('content-length') or 0)
            if content_length > max_bytes:
                raise HTTPException(status_code=413, detail='Document exceeds configured download limit')
            total = 0
            with pdf_path.open('wb') as output:
                async for chunk in response.aiter_bytes(1024 * 1024):
                    total += len(chunk)
                    if total > max_bytes:
                        raise HTTPException(status_code=413, detail='Document exceeds configured download limit')
                    output.write(chunk)

        digest = hashlib.sha256(pdf_path.read_bytes()).hexdigest()
        if request.source_hash and digest != request.source_hash:
            raise HTTPException(status_code=409, detail="Source hash changed while processing")

        pages = list(pipeline().predict(input=str(pdf_path)))
        if len(pages) > max_pages:
            raise HTTPException(status_code=413, detail="Document exceeds configured page limit")

        extracted: list[dict[str, Any]] = []
        for index, result in enumerate(pages, start=1):
            page_dir = output_dir / f"page-{index:04d}"
            page_dir.mkdir()
            payload = result_json(result, page_dir)
            markdown = result_markdown(result, page_dir)
            extracted.append(page_record(index, payload, markdown, request.source_name))

        return {
            "document_id": request.document_id,
            "technology_id": request.technology_id,
            "source_hash": digest,
            "page_count": len(extracted),
            "pages": extracted,
        }
