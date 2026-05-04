"""Tests for ML microservice HTTP client in ai_service."""

from unittest.mock import MagicMock, patch

import pytest

from server.src.services import ai_service


@pytest.fixture(autouse=True)
def restore_env(monkeypatch):
    monkeypatch.setenv("ML_SERVICE_URL", "http://ml-test.example")
    monkeypatch.setenv("ML_SERVICE_API_KEY", "")
    ai_service.ML_SERVICE_URL = "http://ml-test.example".rstrip("/")
    ai_service.ML_SERVICE_API_KEY = ""
    yield


def test_run_classification_empty_bytes():
    out = ai_service.run_classification(b"")
    assert out["fallback"] is True
    assert out["confidence"] == 0.0


def test_run_classification_empty_ml_url():
    prev = ai_service.ML_SERVICE_URL
    ai_service.ML_SERVICE_URL = ""
    try:
        out = ai_service.run_classification(b"not-empty")
    finally:
        ai_service.ML_SERVICE_URL = prev
    assert out["fallback"] is True
    assert out["confidence"] == 0.0


def test_run_classification_success():
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "classification": "Heavy",
        "damage_score": 7,
        "confidence": 0.91,
        "fallback": False,
    }
    with patch.object(ai_service.requests, "post", return_value=mock_resp) as post:
        out = ai_service.run_classification(b"jpeg-bytes-here")
    post.assert_called_once()
    args, kwargs = post.call_args
    assert args[0] == "http://ml-test.example/predict"
    assert kwargs["data"] == b"jpeg-bytes-here"
    assert kwargs["headers"]["Content-Type"] == "application/octet-stream"
    assert out == {
        "classification": "Heavy",
        "damage_score": 7,
        "confidence": 0.91,
        "fallback": False,
    }


def test_run_classification_retries_on_503():
    bad = MagicMock(status_code=503)
    good = MagicMock(status_code=200)
    good.json.return_value = {
        "classification": "Light",
        "damage_score": 3,
        "confidence": 0.8,
        "fallback": False,
    }
    with patch.object(ai_service.requests, "post", side_effect=[bad, good]) as post:
        out = ai_service.run_classification(b"x")
    assert post.call_count == 2
    assert out["damage_score"] == 3


def test_run_classification_fallback_on_error():
    with patch.object(ai_service.requests, "post", side_effect=ai_service.requests.exceptions.ConnectionError("down")):
        out = ai_service.run_classification(b"x")
    assert out["fallback"] is True


def test_run_classification_sends_api_key(monkeypatch):
    monkeypatch.setenv("ML_SERVICE_API_KEY", "secret-key")
    ai_service.ML_SERVICE_API_KEY = "secret-key"
    try:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "classification": "Light",
            "damage_score": 3,
            "confidence": 1.0,
            "fallback": False,
        }
        with patch.object(ai_service.requests, "post", return_value=mock_resp) as post:
            ai_service.run_classification(b"d")
        headers = post.call_args.kwargs["headers"]
        assert headers["X-API-Key"] == "secret-key"
    finally:
        ai_service.ML_SERVICE_API_KEY = ""
