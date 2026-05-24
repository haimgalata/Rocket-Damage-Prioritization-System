"""Tests for the LLM explanation layer in priority_service.

Covers build_explanation (static) and build_llm_explanation (Groq-backed with
static fallback). All Groq API calls are mocked — no real network traffic.
"""

import sys
from types import ModuleType
from unittest.mock import MagicMock, patch

import pytest

from server.src.services.priority_service import build_explanation, build_llm_explanation


# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------

GIS_FEATURES = {
    "dist_hospital_m": 800,
    "dist_school_m": 400,
    "dist_roads_m": 150,
    "dist_military_base_m": 12000,
    "population_density": 8500,
}

GIS_MISSING = {}  # all keys absent — tests default / -1 path


def _mock_groq_module(content: str | None = "הסבר LLM מדומה") -> tuple[ModuleType, MagicMock]:
    """Return (mock_groq_module, mock_create) with pre-wired response content."""
    mock_choice = MagicMock()
    mock_choice.message.content = content
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]

    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = mock_response

    mock_groq = ModuleType("groq")
    mock_groq.Groq = MagicMock(return_value=mock_client)

    return mock_groq, mock_client.chat.completions.create


# ---------------------------------------------------------------------------
# build_explanation (static fallback) tests
# ---------------------------------------------------------------------------

class TestBuildExplanation:
    def test_heavy_classification_label(self):
        result = build_explanation("Heavy", 7, GIS_FEATURES, 8.5, 1.21)
        assert "כבד" in result

    def test_light_classification_label(self):
        result = build_explanation("Light", 3, GIS_FEATURES, 3.5, 1.17)
        assert "קל" in result

    def test_heavy_triggers_structural_assessment_note(self):
        result = build_explanation("Heavy", 7, GIS_FEATURES, 8.5, 1.21)
        assert "הערכה מבנית מיידית" in result

    def test_light_triggers_regular_repair_note(self):
        result = build_explanation("Light", 3, GIS_FEATURES, 3.5, 1.17)
        assert "תיקון רגיל" in result

    def test_final_score_appears_in_output(self):
        result = build_explanation("Heavy", 7, GIS_FEATURES, 8.5, 1.21)
        assert "8.5" in result

    def test_multiplier_appears_in_output(self):
        result = build_explanation("Heavy", 7, GIS_FEATURES, 8.5, 1.21)
        assert "1.21" in result

    def test_severity_critical_when_score_gte_7_5(self):
        result = build_explanation("Heavy", 7, GIS_FEATURES, 7.5, 1.07)
        assert "קריטי" in result

    def test_severity_high_between_5_and_7_5(self):
        result = build_explanation("Light", 5, GIS_FEATURES, 6.0, 1.20)
        assert "גבוה" in result

    def test_severity_medium_below_5(self):
        result = build_explanation("Light", 3, GIS_FEATURES, 3.5, 1.17)
        assert "בינוני" in result

    def test_distance_meters_format_for_short_distance(self):
        features = {**GIS_FEATURES, "dist_hospital_m": 350}
        result = build_explanation("Heavy", 7, features, 8.0, 1.14)
        assert "350 מ'" in result

    def test_distance_km_format_for_long_distance(self):
        features = {**GIS_FEATURES, "dist_hospital_m": 2500}
        result = build_explanation("Heavy", 7, features, 8.0, 1.14)
        assert "2.5 ק" in result

    def test_out_of_range_distance_shows_not_found(self):
        features = {**GIS_FEATURES, "dist_military_base_m": -1}
        result = build_explanation("Heavy", 7, features, 8.0, 1.14)
        assert "לא נמצא" in result

    def test_missing_gis_features_uses_defaults(self):
        result = build_explanation("Light", 3, GIS_MISSING, 3.0, 1.0)
        assert isinstance(result, str)
        assert len(result) > 0


# ---------------------------------------------------------------------------
# build_llm_explanation — no API key → static fallback
# ---------------------------------------------------------------------------

class TestLLMNoKey:
    def test_missing_env_var_falls_back_to_static(self, monkeypatch):
        monkeypatch.delenv("GROQ_API_KEY", raising=False)
        result = build_llm_explanation("Heavy", 7, GIS_FEATURES, 8.5, 1.21)
        assert "כבד" in result

    def test_empty_env_var_falls_back_to_static(self, monkeypatch):
        monkeypatch.setenv("GROQ_API_KEY", "")
        result = build_llm_explanation("Heavy", 7, GIS_FEATURES, 8.5, 1.21)
        assert "כבד" in result

    def test_whitespace_only_key_falls_back_to_static(self, monkeypatch):
        monkeypatch.setenv("GROQ_API_KEY", "   ")
        result = build_llm_explanation("Heavy", 7, GIS_FEATURES, 8.5, 1.21)
        assert "כבד" in result


# ---------------------------------------------------------------------------
# build_llm_explanation — successful Groq response
# ---------------------------------------------------------------------------

class TestLLMSuccess:
    def test_returns_llm_content_on_success(self, monkeypatch):
        monkeypatch.setenv("GROQ_API_KEY", "test-key")
        mock_groq, _ = _mock_groq_module("הסבר מקצועי מהמודל")

        with patch.dict(sys.modules, {"groq": mock_groq}):
            result = build_llm_explanation("Heavy", 7, GIS_FEATURES, 8.5, 1.21)

        assert result == "הסבר מקצועי מהמודל"

    def test_strips_surrounding_whitespace(self, monkeypatch):
        monkeypatch.setenv("GROQ_API_KEY", "test-key")
        mock_groq, _ = _mock_groq_module("  הסבר עם רווחים  ")

        with patch.dict(sys.modules, {"groq": mock_groq}):
            result = build_llm_explanation("Heavy", 7, GIS_FEATURES, 8.5, 1.21)

        assert result == "הסבר עם רווחים"

    def test_uses_correct_model_name(self, monkeypatch):
        monkeypatch.setenv("GROQ_API_KEY", "test-key")
        mock_groq, mock_create = _mock_groq_module("ok")

        with patch.dict(sys.modules, {"groq": mock_groq}):
            build_llm_explanation("Heavy", 7, GIS_FEATURES, 8.5, 1.21)

        call_kwargs = mock_create.call_args.kwargs
        assert call_kwargs["model"] == "llama-3.3-70b-versatile"

    def test_passes_timeout(self, monkeypatch):
        monkeypatch.setenv("GROQ_API_KEY", "test-key")
        mock_groq, mock_create = _mock_groq_module("ok")

        with patch.dict(sys.modules, {"groq": mock_groq}):
            build_llm_explanation("Heavy", 7, GIS_FEATURES, 8.5, 1.21)

        call_kwargs = mock_create.call_args.kwargs
        assert "timeout" in call_kwargs
        assert call_kwargs["timeout"] > 0

    def test_sends_system_and_user_messages(self, monkeypatch):
        monkeypatch.setenv("GROQ_API_KEY", "test-key")
        mock_groq, mock_create = _mock_groq_module("ok")

        with patch.dict(sys.modules, {"groq": mock_groq}):
            build_llm_explanation("Heavy", 7, GIS_FEATURES, 8.5, 1.21)

        messages = mock_create.call_args.kwargs["messages"]
        roles = [m["role"] for m in messages]
        assert "system" in roles
        assert "user" in roles

    def test_groq_client_receives_api_key(self, monkeypatch):
        monkeypatch.setenv("GROQ_API_KEY", "real-secret-key")
        mock_groq, _ = _mock_groq_module("ok")

        with patch.dict(sys.modules, {"groq": mock_groq}):
            build_llm_explanation("Heavy", 7, GIS_FEATURES, 8.5, 1.21)

        mock_groq.Groq.assert_called_once_with(api_key="real-secret-key")


# ---------------------------------------------------------------------------
# build_llm_explanation — API failure → static fallback
# ---------------------------------------------------------------------------

class TestLLMFallback:
    def test_api_exception_falls_back_to_static(self, monkeypatch):
        monkeypatch.setenv("GROQ_API_KEY", "test-key")
        mock_groq = ModuleType("groq")
        mock_client = MagicMock()
        mock_client.chat.completions.create.side_effect = RuntimeError("connection refused")
        mock_groq.Groq = MagicMock(return_value=mock_client)

        with patch.dict(sys.modules, {"groq": mock_groq}):
            result = build_llm_explanation("Heavy", 7, GIS_FEATURES, 8.5, 1.21)

        assert "כבד" in result

    def test_empty_choices_list_falls_back_to_static(self, monkeypatch):
        monkeypatch.setenv("GROQ_API_KEY", "test-key")
        mock_response = MagicMock()
        mock_response.choices = []
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = mock_response
        mock_groq = ModuleType("groq")
        mock_groq.Groq = MagicMock(return_value=mock_client)

        with patch.dict(sys.modules, {"groq": mock_groq}):
            result = build_llm_explanation("Light", 3, GIS_FEATURES, 3.5, 1.17)

        assert "קל" in result

    def test_none_content_falls_back_to_static(self, monkeypatch):
        monkeypatch.setenv("GROQ_API_KEY", "test-key")
        mock_groq, _ = _mock_groq_module(content=None)

        with patch.dict(sys.modules, {"groq": mock_groq}):
            result = build_llm_explanation("Light", 3, GIS_FEATURES, 3.5, 1.17)

        assert "קל" in result

    def test_empty_string_content_falls_back_to_static(self, monkeypatch):
        monkeypatch.setenv("GROQ_API_KEY", "test-key")
        mock_groq, _ = _mock_groq_module(content="")

        with patch.dict(sys.modules, {"groq": mock_groq}):
            result = build_llm_explanation("Light", 3, GIS_FEATURES, 3.5, 1.17)

        assert "קל" in result

    def test_groq_import_error_falls_back_to_static(self, monkeypatch):
        """Groq package not installed should not crash — falls back silently."""
        monkeypatch.setenv("GROQ_API_KEY", "test-key")

        with patch.dict(sys.modules, {"groq": None}):
            result = build_llm_explanation("Heavy", 7, GIS_FEATURES, 8.5, 1.21)

        assert "כבד" in result

    def test_fallback_result_is_non_empty_string(self, monkeypatch):
        monkeypatch.setenv("GROQ_API_KEY", "test-key")
        mock_groq = ModuleType("groq")
        mock_groq.Groq = MagicMock(side_effect=Exception("auth error"))

        with patch.dict(sys.modules, {"groq": mock_groq}):
            result = build_llm_explanation("Heavy", 7, GIS_MISSING, 8.5, 1.21)

        assert isinstance(result, str)
        assert len(result) > 0
