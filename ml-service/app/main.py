"""PrioritAI ML service — TensorFlow inference only."""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Header, HTTPException, Request

from app.inference import classify_damage_image, preload_model

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _check_api_key(x_api_key: str | None) -> None:
    expected = os.environ.get("ML_SERVICE_API_KEY", "").strip()
    if not expected:
        return
    if not x_api_key or x_api_key.strip() != expected:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


@asynccontextmanager
async def lifespan(app: FastAPI):
    preload_model()
    yield


app = FastAPI(title="PrioritAI ML", version="1.0.0", lifespan=lifespan)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/predict")
async def predict(
    request: Request,
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
):
    _check_api_key(x_api_key)
    body = await request.body()
    if not body:
        raise HTTPException(status_code=400, detail="Empty request body")
    try:
        return classify_damage_image(body)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Inference failed: %s", exc)
        raise HTTPException(status_code=500, detail="Inference failed") from exc
