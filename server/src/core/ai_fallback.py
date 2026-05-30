"""Client-side fallback when the ML microservice is unreachable."""

from __future__ import annotations

import logging
import random

logger = logging.getLogger(__name__)

def fallback_classification_result() -> dict:
    """Return a random classification across 3 classes when ML inference is unavailable."""
    roll = random.random()
    if roll < 0.40:
        label, score = "Heavy", 7
    elif roll < 0.65:
        label, score = "Medium", 5
    else:
        label, score = "Light", 3
    logger.warning("[AI Inference] Fallback active — returning %s (%s)", label, score)
    return {
        "classification": label,
        "damage_score": score,
        "confidence": 0.0,
        "fallback": True,
    }
