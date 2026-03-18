"""
AI damage classification using the Keras CNN model.

This module is responsible for loading the PrioritAI Keras model from disk
and running inference on raw image bytes to classify structural damage as
either 'Light' or 'Heavy', producing a corresponding integer damage score.

Model location:  server/src/core/rocket_damage_model.keras
Input shape:     (1, 224, 224, 3)  — single RGB image, normalised to [0, 1]
Output shape:    (1, 1) sigmoid  OR  (1, 2) softmax, depending on architecture
Decision threshold: 0.5 (raw output > 0.5 → Heavy)
"""

import os
import io
import logging
import numpy as np

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Module-level singleton — the Keras model is loaded lazily on first call
# and cached here to avoid repeated disk I/O on subsequent requests.
# ---------------------------------------------------------------------------
_model = None
MODEL_PATH = os.path.join(os.path.dirname(__file__), "rocket_damage_model.keras")

# Expected spatial dimensions for the CNN input layer.
IMG_SIZE = (224, 224)


def _load_model():
    """Load the Keras model from disk and cache it in the module-level ``_model`` variable.

    Uses lazy initialisation: the model is read from ``MODEL_PATH`` only on
    the first call. Subsequent calls return the cached instance immediately.
    The function is deliberately fault-tolerant — if TensorFlow or the model
    file are unavailable it returns ``None`` and the caller falls back to a
    random classifier.

    Returns:
        tf.keras.Model | None: The loaded Keras model instance, or ``None``
            if the model could not be loaded (missing file, import error, etc.).
    """
    global _model
    if _model is not None:
        return _model

    try:
        import tensorflow as tf
        logger.info(f"Loading Keras model from: {MODEL_PATH}")
        _model = tf.keras.models.load_model(MODEL_PATH)
        logger.info("Model loaded successfully.")
        return _model
    except Exception as e:
        logger.error(f"Failed to load Keras model: {e}")
        return None


def classify_damage_image(image_bytes: bytes) -> dict:
    """Classify the severity of structural damage from a raw image.

    Orchestrates the full inference pipeline:

    1. Loads (or retrieves from cache) the Keras CNN model.
    2. Decodes ``image_bytes`` into a PIL RGB image.
    3. Resizes the image to ``IMG_SIZE`` (224 × 224 pixels).
    4. Normalises pixel values to the [0, 1] range (``/ 255.0``).
    5. Adds a batch dimension → shape ``(1, 224, 224, 3)``.
    6. Runs ``model.predict()`` in silent mode (``verbose=0``).
    7. Interprets the output:
       - Single-neuron sigmoid output  → ``predictions[0][0]``
       - Two-neuron softmax output     → ``predictions[0][1]`` (positive class)
    8. Applies the binary decision threshold (> 0.5 → Heavy).

    If the model is unavailable or inference raises any exception, the
    function falls back to a random classification (60 % Heavy) and sets
    ``"fallback": True`` in the returned dictionary.

    Args:
        image_bytes (bytes): Raw binary content of an image file (JPEG, PNG,
            WebP, etc.). May be an empty ``bytes`` object (``b""``) when no
            photo was attached to the request; in that case the fallback path
            is triggered automatically via the ``model is None`` guard.

    Returns:
        dict: A dictionary with the following keys:

            - ``"classification"`` (str): ``"Light"`` or ``"Heavy"``.
            - ``"damage_score"`` (int): ``3`` for Light, ``7`` for Heavy.
            - ``"confidence"`` (float): Model confidence in [0, 1].
              Set to ``0.0`` when the fallback path is used.
            - ``"fallback"`` (bool): ``True`` if the model was unavailable
              or inference failed; ``False`` on a successful forward pass.

    Example::

        result = classify_damage_image(open("damage.jpg", "rb").read())
        # {"classification": "Heavy", "damage_score": 7,
        #  "confidence": 0.872, "fallback": False}
    """
    model = _load_model()

    # ------------------------------------------------------------------
    # Fallback path — model unavailable (missing file / TF not installed)
    # ------------------------------------------------------------------
    if model is None:
        logger.warning("Model unavailable — using fallback random classification.")
        import random
        is_heavy = random.random() > 0.4
        return {
            "classification": "Heavy" if is_heavy else "Light",
            "damage_score": 7 if is_heavy else 3,
            "confidence": 0.0,
            "fallback": True,
        }

    try:
        from PIL import Image
        import tensorflow as tf

        # ── Step 1: Decode raw bytes → PIL RGB image ───────────────────
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")

        # ── Step 2: Resize to the CNN's expected spatial dimensions ────
        img = img.resize(IMG_SIZE)

        # ── Step 3: Normalise and add batch dimension ───────────────────
        # Shape after expand_dims: (1, 224, 224, 3)
        arr = np.array(img, dtype=np.float32) / 255.0
        arr = np.expand_dims(arr, axis=0)

        # ── Step 4: Run inference ───────────────────────────────────────
        predictions = model.predict(arr, verbose=0)

        # Handle both sigmoid (shape (1,1)) and softmax (shape (1,2)) heads
        raw = float(predictions[0][0]) if predictions.shape[-1] == 1 else float(predictions[0][1])

        # ── Step 5: Binary decision + confidence derivation ─────────────
        is_heavy = raw > 0.5
        confidence = raw if is_heavy else 1.0 - raw

        return {
            "classification": "Heavy" if is_heavy else "Light",
            "damage_score": 7 if is_heavy else 3,
            "confidence": round(confidence, 3),
            "fallback": False,
        }

    except Exception as e:
        logger.error(f"Inference failed: {e}")
        # Fallback on inference error
        import random
        is_heavy = random.random() > 0.4
        return {
            "classification": "Heavy" if is_heavy else "Light",
            "damage_score": 7 if is_heavy else 3,
            "confidence": 0.0,
            "fallback": True,
        }