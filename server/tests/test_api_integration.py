import pytest
from fastapi.testclient import TestClient
from server.src.main import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "online"


def test_analyze_endpoint_structure():
    # שליחת בקשת POST עם נתונים דאמי
    payload = {"lat": 32.0853, "lon": 34.7818}
    # נדמה שליחת קובץ תמונה
    files = {"image": ("test.jpg", b"fakeimagecontent", "image/jpeg")}

    response = client.post("/analyze", data=payload, files=files)

    assert response.status_code == 200
    data = response.json()
    assert "priority" in data
    assert "final_score" in data["priority"]
    assert "gis_features" in data["analysis_details"]


if __name__ == "__main__":
    pytest.main([__file__])