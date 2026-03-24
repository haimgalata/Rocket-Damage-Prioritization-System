import pytest
from fastapi.testclient import TestClient
from server.src.main import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "online"


def test_analyze_endpoint_structure():
    """POST /analyze requires authentication."""
    payload = {"lat": 32.0853, "lon": 34.7818}
    files = {"image": ("test.jpg", b"fakeimagecontent", "image/jpeg")}

    unauth = client.post("/analyze", data=payload, files=files)
    assert unauth.status_code == 401

    login = client.post(
        "/auth/login",
        json={"email": "haimgalata@gmail.com", "password": "1234"},
    )
    if login.status_code != 200:
        pytest.skip("Database or seed not available for auth")
    token = login.json().get("access_token")
    assert token

    response = client.post(
        "/analyze",
        data=payload,
        files=files,
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert "priority" in data
    assert "final_score" in data["priority"]
    assert "gis_features" in data["analysis_details"]


def test_events_list_and_detail_authenticated():
    """GET /events and GET /events/{id} must not 500 (DetachedInstanceError on principal)."""
    login = client.post(
        "/auth/login",
        json={"email": "haimgalata@gmail.com", "password": "1234"},
    )
    if login.status_code != 200:
        pytest.skip("Database or seed not available for auth")
    token = login.json().get("access_token")
    assert token
    headers = {"Authorization": f"Bearer {token}"}

    list_resp = client.get("/events", headers=headers)
    assert list_resp.status_code == 200
    events = list_resp.json()
    assert isinstance(events, list)

    if events:
        eid = events[0]["id"]
        detail = client.get(f"/events/{eid}", headers=headers)
        assert detail.status_code == 200
        payload = detail.json()
        assert payload.get("id") == eid
    else:
        missing = client.get("/events/999999999", headers=headers)
        assert missing.status_code != 500


if __name__ == "__main__":
    pytest.main([__file__])
