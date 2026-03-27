"""AI damage classification using the Keras CNN model.

Model output: Softmax [P(Heavy), P(Light)] — Index 0 → "Heavy" (score 7), Index 1 → "Light" (score 3).
"""

import io
import logging
import os
import random

import numpy as np

logger = logging.getLogger(__name__)

MODEL_PATH = os.path.join(os.path.dirname(__file__), "rocket_damage_model.keras")
IMG_SIZE = (224, 224)

CLASS_MAP: dict[int, tuple[str, int]] = {
    0: ("Heavy", 7),
    1: ("Light", 3),
}

_model = None


def preload_model():
    """Load the Keras model from disk and cache it in the module-level singleton."""
    global _model
    if _model is not None:
        return _model

    try:
        import tensorflow as tf
        logger.info(f"Loading Keras model from: {MODEL_PATH}")
        _model = tf.keras.models.load_model(MODEL_PATH)
        logger.info("Model loaded. Running XLA warmup predict...")
        dummy = np.zeros((1, 224, 224, 3), dtype=np.float32)
        _model.predict(dummy, verbose=0)
        logger.info("Warmup complete — model ready for fast inference.")
        return _model
    except Exception as exc:
        logger.error(f"Failed to load Keras model: {exc}")
        return None


_load_model = preload_model


def _fallback_result() -> dict:
    """Return a random classification (60 % Heavy) when the model is unavailable."""
    is_heavy = random.random() < 0.6
    label, score = CLASS_MAP[0] if is_heavy else CLASS_MAP[1]
    logger.warning(f"[AI Inference] Fallback active — returning {label} ({score})")
    return {
        "classification": label,
        "damage_score": score,
        "confidence": 0.0,
        "fallback": True,
    }


def classify_damage_image(image_bytes: bytes) -> dict:
    """Classify structural damage from raw image bytes.

    Returns dict with keys: classification, damage_score, confidence, fallback.
    """
    if not image_bytes:
        return _fallback_result()

    model = preload_model()
    if model is None:
        return _fallback_result()

    try:
        from PIL import Image

        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img = img.resize(IMG_SIZE)
        arr = np.array(img, dtype=np.float32) / 255.0
        arr = np.expand_dims(arr, axis=0)

        predictions = model.predict(arr, verbose=0)

        idx = int(np.argmax(predictions[0]))
        label, score = CLASS_MAP[idx]
        confidence = round(float(predictions[0][idx]), 3)

        logger.info(
            f"[AI Inference] Raw: {predictions[0].tolist()} | "
            f"Winner: Index {idx} ({label}) | Score: {score}"
        )

        return {
            "classification": label,
            "damage_score": score,
            "confidence": confidence,
            "fallback": False,
        }

    except Exception as exc:
        logger.error(f"[AI Inference] Inference failed: {exc}")
        return _fallback_result()
