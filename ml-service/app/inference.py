"""Keras CNN damage classification — ported from PrioritAI backend ai_logic."""

from __future__ import annotations

import io
import logging
import os

import numpy as np

logger = logging.getLogger(__name__)

MODEL_PATH = os.environ.get(
    "MODEL_PATH",
    os.path.join(os.path.dirname(__file__), "..", "model", "rocket_damage_model.keras"),
)
MODEL_PATH = os.path.abspath(MODEL_PATH)
IMG_SIZE = (224, 224)

CLASS_MAP: dict[int, tuple[str, int]] = {
    0: ("Heavy", 7),
    1: ("Light", 3),
}

_model = None


def preload_model():
    """Load Keras model from disk and run one warmup predict."""
    global _model
    if _model is not None:
        return _model

    import tensorflow as tf

    logger.info("Loading Keras model from: %s", MODEL_PATH)
    if not os.path.isfile(MODEL_PATH):
        raise FileNotFoundError(f"Model file not found: {MODEL_PATH}")
    _model = tf.keras.models.load_model(MODEL_PATH)
    logger.info("Model loaded; warmup predict...")
    dummy = np.zeros((1, 224, 224, 3), dtype=np.float32)
    _model.predict(dummy, verbose=0)
    logger.info("Warmup complete.")
    return _model


def classify_damage_image(image_bytes: bytes) -> dict:
    """Return classification dict or raise on inference failure."""
    from PIL import Image

    model = preload_model()
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = img.resize(IMG_SIZE)
    arr = np.array(img, dtype=np.float32) / 255.0
    arr = np.expand_dims(arr, axis=0)
    predictions = model.predict(arr, verbose=0)
    idx = int(np.argmax(predictions[0]))
    label, score = CLASS_MAP[idx]
    confidence = round(float(predictions[0][idx]), 3)
    logger.info(
        "[AI Inference] Raw: %s | Winner: %s (%s) | Score: %s",
        predictions[0].tolist(),
        idx,
        label,
        score,
    )
    return {
        "classification": label,
        "damage_score": score,
        "confidence": confidence,
        "fallback": False,
    }
