"""Keras CNN damage classification with APS conformal prediction."""

from __future__ import annotations

import io
import json
import logging
import os

import numpy as np

logger = logging.getLogger(__name__)

# ── Model path ────────────────────────────────────────────────────────────────
MODEL_PATH = os.environ.get(
    "MODEL_PATH",
    os.path.join(os.path.dirname(__file__), "..", "model", "rocket_damage_resnet50_v2.keras"),
)
MODEL_PATH = os.path.abspath(MODEL_PATH)

# ── Conformal threshold path ──────────────────────────────────────────────────
Q_HAT_PATH = os.environ.get(
    "Q_HAT_PATH",
    os.path.join(os.path.dirname(__file__), "..", "model", "q_hat.json"),
)
Q_HAT_PATH = os.path.abspath(Q_HAT_PATH)

IMG_SIZE = (224, 224)

# Class ordering confirmed by APS calibration notebook (CLASS_NAMES = ["light", "medium", "heavy"]):
#   model output index 0 → Light, 1 → Medium, 2 → Heavy
CLASS_MAP: dict[int, tuple[str, int]] = {
    0: ("Light", 3),
    1: ("Medium", 5),
    2: ("Heavy", 7),
}
CLASS_NAMES: list[str] = [CLASS_MAP[i][0] for i in sorted(CLASS_MAP.keys())]
# → ["Light", "Medium", "Heavy"]

_model = None
_q_hat: float | None = None


def _load_q_hat() -> float | None:
    """Load APS threshold from q_hat.json. Returns None if file is absent."""
    if not os.path.isfile(Q_HAT_PATH):
        logger.warning(
            "q_hat.json not found at %s — APS conformal prediction disabled.", Q_HAT_PATH
        )
        return None
    with open(Q_HAT_PATH) as f:
        payload = json.load(f)
    value = float(payload["q_hat"])
    logger.info(
        "Loaded APS threshold: q_hat=%.6f (alpha=%s, n_calibration=%s)",
        value,
        payload.get("alpha"),
        payload.get("n_calibration"),
    )
    return value


def preload_model():
    """Load Keras model and APS conformal threshold from disk."""
    global _model, _q_hat
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

    _q_hat = _load_q_hat()
    return _model


def _preprocess(img) -> np.ndarray:
    """
    Preprocessing identical to the APS calibration notebook (Cell 10).
    Uses ResNet50's preprocess_input (caffe convention: subtracts ImageNet
    channel means, converts RGB→BGR). Input must be in [0, 255] range.
    Do NOT divide by 255 before calling this.
    """
    from tensorflow.keras.applications.resnet50 import preprocess_input
    arr = np.array(img, dtype=np.float32)  # pixel values in [0, 255]
    return preprocess_input(arr)


def predict_conformal_aps(
    probs: np.ndarray,
    q_hat: float,
    class_names: list[str],
) -> list[str]:
    """
    APS (Adaptive Prediction Sets) inference — exact port of notebook Cell 16.

    Sort classes by probability descending, accumulate cumulative probability,
    add classes until cumulative_prob >= q_hat.
    """
    sorted_indices = np.argsort(probs)[::-1]
    prediction_set: list[str] = []
    cumulative_prob = 0.0

    for idx in sorted_indices:
        prediction_set.append(class_names[int(idx)])
        cumulative_prob += float(probs[idx])
        if cumulative_prob >= q_hat:
            break

    return prediction_set


def classify_damage_image(image_bytes: bytes) -> dict:
    """Return classification dict or raise on inference failure."""
    from PIL import Image

    model = preload_model()
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = img.resize(IMG_SIZE)
    arr = _preprocess(img)
    arr = np.expand_dims(arr, axis=0)
    predictions = model.predict(arr, verbose=0)
    probs = predictions[0]

    idx = int(np.argmax(probs))
    label, score = CLASS_MAP[idx]
    confidence = round(float(probs[idx]), 3)

    if _q_hat is not None:
        prediction_set = predict_conformal_aps(probs, _q_hat, CLASS_NAMES)
    else:
        prediction_set = [label]

    logger.info(
        "[AI Inference] Raw: %s | Winner: %s (%s) | Score: %s | Set: %s | Uncertain: %s",
        [round(p, 4) for p in probs.tolist()],
        idx,
        label,
        score,
        prediction_set,
        len(prediction_set) > 1,
    )
    return {
        "classification": label,
        "damage_score": score,
        "confidence": confidence,
        "prediction_set": prediction_set,
        "uncertain": len(prediction_set) > 1,
        "fallback": False,
    }
