"""Client-side fallback when the ML microservice is unreachable."""

from __future__ import annotations

import logging
import random

logger = logging.getLogger(__name__)

_CLASS_WEIGHT_HEAVY = 0.6


def fallback_classification_result() -> dict:
    """Return a random classification (60 % Heavy) when ML inference is unavailable."""
    is_heavy = random.random() < _CLASS_WEIGHT_HEAVY
    label, score = ("Heavy", 7) if is_heavy else ("Light", 3)
    logger.warning("[AI Inference] Fallback active — returning %s (%s)", label, score)
    return {
        "classification": label,
        "damage_score": score,
        "confidence": 0.0,
        "fallback": True,
    }
