"""
AI service layer — thin wrapper over server.src.core.ai_logic.
"""

from server.src.core.ai_logic import classify_damage_image


def run_classification(image_bytes: bytes) -> dict:
    """Classify a damage image and return a structured result dictionary.

    Returns:
        dict with keys: classification, damage_score, confidence, fallback.
    """
    return classify_damage_image(image_bytes)
