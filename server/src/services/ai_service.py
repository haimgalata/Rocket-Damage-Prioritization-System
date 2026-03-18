"""
AI service layer — thin wrapper over :mod:`server.src.core.ai_logic`.

Provides a single, stable entry point for image classification so that
API route handlers are decoupled from the core Keras inference logic.
Swapping or extending the underlying model only requires changes here
and in :mod:`server.src.core.ai_logic`, not in route handlers.
"""

from server.src.core.ai_logic import classify_damage_image


def run_classification(image_bytes: bytes) -> dict:
    """Classify a damage image and return a structured result dictionary.

    Delegates directly to
    :func:`~server.src.core.ai_logic.classify_damage_image`, which
    handles lazy model loading, image preprocessing, and CNN inference.

    Args:
        image_bytes (bytes): Raw bytes of the uploaded image file.
            Supported formats: JPEG, PNG, WebP, and any format readable
            by ``PIL.Image.open``.  An empty byte string (``b""``)
            triggers the fallback path inside the core function.

    Returns:
        dict: Classification result with the following keys:

            - ``"classification"`` (str): Damage level label —
              ``"Light"`` or ``"Heavy"``.
            - ``"damage_score"`` (int): Numeric damage score —
              ``3`` for Light, ``7`` for Heavy.
            - ``"confidence"`` (float): Model confidence in [0, 1].
              Values below 0.5 map to ``"Light"``; at or above to
              ``"Heavy"``.
            - ``"fallback"`` (bool): ``True`` when the model was
              unavailable and a default score was returned; ``False``
              on successful inference.
    """
    return classify_damage_image(image_bytes)