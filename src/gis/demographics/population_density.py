import requests


def building_density_online(lat: float, lon: float, radius_m: int = 500) -> int:
    """
    Returns number of buildings within radius (meters).
    Uses OpenStreetMap Overpass API.
    """

    overpass_url = "https://overpass-api.de/api/interpreter"

    query = f"""
    [out:json][timeout:25];
    (
      way["building"](around:{radius_m},{lat},{lon});
      relation["building"](around:{radius_m},{lat},{lon});
    );
    out body;
    """

    try:
        response = requests.post(overpass_url, data=query, timeout=30)
        response.raise_for_status()
        data = response.json()

        buildings_count = len(data.get("elements", []))

        print(
            f"[DEBUG] Found {buildings_count} buildings "
            f"within {radius_m}m"
        )

        return buildings_count

    except Exception as e:
        print(f"[ERROR] Overpass request failed: {e}")
        return 0
