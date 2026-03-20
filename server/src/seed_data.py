"""Seed Data Script — PrioritAI.

Generates 20 realistic damage events, runs them through the GIS + priority pipeline,
and writes results to server/seed_events.json.

Usage (from repo root):
    python -m server.src.seed_data
"""

import json
import logging
import os
import uuid
from datetime import datetime, timedelta

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

from server.src.services.gis.demographics.population_density import preload_population_data
from server.src.services.gis_service import get_gis_features
from server.src.services.priority_service import compute_priority, build_explanation

_REPO_ROOT   = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SEED_JSON    = os.path.join(_REPO_ROOT, "server", "seed_events.json")

_RAW_EVENTS = [

    dict(
        name="Dizengoff Center Strike",
        description=(
            "Direct rocket impact on the northern facade of Dizengoff Center shopping mall. "
            "Structural columns on floors 2–4 show visible shear cracks. Glass facade "
            "collapsed across a 30-metre section. Multiple utility lines severed. "
            "Surrounding area heavily populated; evacuation in progress."
        ),
        lat=32.0785, lon=34.7740,
        organizationId="org-1", createdBy="user-op-1",
        damageClassification="Heavy", damageScore=7,
        imageFilename="tel_aviv_heavy_1.jpg",
        tags=["structural", "evacuation", "commercial"],
        status="in_progress", createdAt_offset_days=-1,
    ),
    dict(
        name="Rothschild Boulevard Building Collapse",
        description=(
            "Residential tower on Rothschild Blvd sustained a near-miss that caused partial "
            "collapse of the eastern stairwell. Three upper floors compromised. Gas leak "
            "detected on ground floor. Boutique district highly accessible — emergency "
            "vehicles on scene. Building is a registered heritage structure."
        ),
        lat=32.0627, lon=34.7739,
        organizationId="org-1", createdBy="user-op-2",
        damageClassification="Heavy", damageScore=7,
        imageFilename="tel_aviv_heavy_2.jpg",
        tags=["gas-leak", "heritage", "residential"],
        status="pending", createdAt_offset_days=0,
    ),
    dict(
        name="Jaffa Port Warehouse Fire",
        description=(
            "Rocket strike ignited a warehouse on the Jaffa Port waterfront. "
            "Fire has spread to two adjacent storage units containing flammable materials. "
            "Port operations suspended. Fire brigade and hazmat team deployed. "
            "Historic old city structures within 200 m at risk of thermal damage."
        ),
        lat=32.0530, lon=34.7510,
        organizationId="org-1", createdBy="user-op-1",
        damageClassification="Heavy", damageScore=7,
        imageFilename="tel_aviv_heavy_3.jpg",
        tags=["fire", "hazmat", "port", "heritage"],
        status="in_progress", createdAt_offset_days=-2,
    ),
    dict(
        name="Florentin Workshop Roof Damage",
        description=(
            "Rocket fragment landed on the flat roof of a two-story artisan workshop in "
            "Florentin neighbourhood. Roof membrane punctured; minor structural cracks on "
            "parapet wall. No injuries. Power supply interrupted for 12 units in the block. "
            "Area accessible via main roads."
        ),
        lat=32.0555, lon=34.7660,
        organizationId="org-1", createdBy="user-op-2",
        damageClassification="Light", damageScore=3,
        imageFilename="tel_aviv_light_1.jpg",
        tags=["roof", "power-outage"],
        status="completed", createdAt_offset_days=-3,
    ),
    dict(
        name="Ramat Aviv Residential Shrapnel",
        description=(
            "Shrapnel from an intercepted rocket scattered across a residential courtyard "
            "in Ramat Aviv. Light facade damage on three apartment buildings — cracked "
            "plaster and broken windows. No structural risk identified. Residents allowed "
            "to return after initial safety check."
        ),
        lat=32.1100, lon=34.8050,
        organizationId="org-1", createdBy="user-op-1",
        damageClassification="Light", damageScore=3,
        imageFilename="tel_aviv_light_2.jpg",
        tags=["shrapnel", "residential", "windows"],
        status="completed", createdAt_offset_days=-4,
    ),
    dict(
        name="HaYarkon Park Infrastructure Hit",
        description=(
            "Rocket struck an open area in HaYarkon Park near the sports facilities. "
            "Irrigation pipes ruptured; electrical box serving the tennis courts destroyed. "
            "No casualties. Footpaths and one footbridge show surface cratering. "
            "Park temporarily closed to the public."
        ),
        lat=32.0982, lon=34.7962,
        organizationId="org-1", createdBy="user-op-2",
        damageClassification="Light", damageScore=3,
        imageFilename="tel_aviv_light_3.jpg",
        tags=["infrastructure", "park", "electrical"],
        status="pending", createdAt_offset_days=0,
    ),
    dict(
        name="Beer Sheva Central Bus Station Impact",
        description=(
            "Direct hit on the upper deck of Beer Sheva Central Bus Station. "
            "Reinforced concrete slab over terminal 3 partially collapsed. "
            "Heavy debris on platforms. Water and power severed for the northern wing. "
            "Hospital 1.2 km away — access roads partially blocked by debris."
        ),
        lat=31.2432, lon=34.7925,
        organizationId="org-2", createdBy="user-admin-2",
        damageClassification="Heavy", damageScore=7,
        imageFilename="south_heavy_1.jpg",
        tags=["transport", "structural", "debris"],
        status="in_progress", createdAt_offset_days=-1,
    ),
    dict(
        name="Dimona Industrial Zone Strike",
        description=(
            "Rocket impacted the perimeter fence of the Dimona industrial zone. "
            "Two factory units sustained heavy structural damage — roof collapse on unit B. "
            "Chemical storage proximity requires hazmat assessment before access. "
            "Road access from south available; northern approach blocked."
        ),
        lat=31.0676, lon=35.0333,
        organizationId="org-2", createdBy="user-admin-2",
        damageClassification="Heavy", damageScore=7,
        imageFilename="south_heavy_2.jpg",
        tags=["industrial", "hazmat", "structural"],
        status="pending", createdAt_offset_days=0,
    ),
    dict(
        name="Kibbutz Nir Oz Residential Block",
        description=(
            "Multiple rocket hits on the residential quarter of Kibbutz Nir Oz. "
            "Four homes suffered direct impacts with roof and wall collapse. "
            "Communal dining hall partially destroyed. Community of ~400 residents evacuated. "
            "Access via Route 232 is clear. Nearest hospital in Sderot (8 km)."
        ),
        lat=31.3667, lon=34.4333,
        organizationId="org-2", createdBy="user-admin-2",
        damageClassification="Heavy", damageScore=7,
        imageFilename="south_heavy_3.jpg",
        tags=["residential", "evacuation", "kibbutz"],
        status="in_progress", createdAt_offset_days=-2,
    ),
    dict(
        name="Ofakim School Perimeter Damage",
        description=(
            "Rocket landed in the schoolyard of an elementary school in Ofakim. "
            "Perimeter wall destroyed over 15 m; two portable classrooms have shrapnel holes. "
            "No injuries — school was evacuated before impact. Main structure intact. "
            "Repairs estimated at 2–3 days."
        ),
        lat=31.3193, lon=34.6222,
        organizationId="org-2", createdBy="user-admin-2",
        damageClassification="Light", damageScore=3,
        imageFilename="south_light_1.jpg",
        tags=["school", "shrapnel", "perimeter"],
        status="completed", createdAt_offset_days=-3,
    ),
    dict(
        name="Kibbutz Revivim Perimeter Fence",
        description=(
            "Rocket struck the agricultural perimeter of Kibbutz Revivim in the central Negev. "
            "Fence line destroyed over 80 m; irrigation pump station damaged. "
            "No injuries. Kibbutz is a small community (~350 residents) in an isolated desert area. "
            "Nearest paved road 4 km; nearest hospital over 40 km (Beer Sheva)."
        ),
        lat=31.0000, lon=34.8833,
        organizationId="org-2", createdBy="user-admin-2",
        damageClassification="Light", damageScore=3,
        imageFilename="south_isolated_light_1.jpg",
        tags=["isolated", "agricultural", "fence"],
        status="pending", createdAt_offset_days=0,
    ),
    dict(
        name="Mitzpe Ramon Visitor Center Strike",
        description=(
            "Rocket impacted the parking area of the Mitzpe Ramon Ramon Crater visitor center. "
            "Asphalt surface cratered; one vehicle destroyed. Visitor center glass facade cracked. "
            "Remote location — 25 km from nearest hospital in Yeruham. "
            "Population density near zero. Access via Route 40 only."
        ),
        lat=30.6100, lon=34.8010,
        organizationId="org-2", createdBy="user-admin-2",
        damageClassification="Light", damageScore=3,
        imageFilename="south_isolated_light_2.jpg",
        tags=["isolated", "tourism", "remote"],
        status="completed", createdAt_offset_days=-5,
    ),
    dict(
        name="Sde Boker Research Station Damage",
        description=(
            "Shrapnel from intercepted rocket damaged a research greenhouse at the Sde Boker "
            "academic campus (Ben-Gurion University desert research). "
            "Three greenhouse panels destroyed; experimental crops lost. "
            "Minimal infrastructure — no roads within 3 km, nearest hospital 35 km away. "
            "Staff evacuated safely."
        ),
        lat=30.8517, lon=34.7861,
        organizationId="org-2", createdBy="user-admin-2",
        damageClassification="Light", damageScore=3,
        imageFilename="south_isolated_light_3.jpg",
        tags=["isolated", "academic", "greenhouse", "remote"],
        status="pending", createdAt_offset_days=-1,
    ),
    dict(
        name="Mahane Yehuda Market Direct Hit",
        description=(
            "Rocket impacted the covered section of Mahane Yehuda market during morning hours. "
            "Iron roof over 40 stalls collapsed. Two support columns fractured. "
            "Market is in the heart of West Jerusalem — densely populated neighbourhood. "
            "Hadassah Ein Kerem hospital 4 km away. Main access roads partially blocked."
        ),
        lat=31.7845, lon=35.2133,
        organizationId="org-3", createdBy="user-admin-3",
        damageClassification="Heavy", damageScore=7,
        imageFilename="jerusalem_heavy_1.jpg",
        tags=["market", "structural", "collapse", "urban"],
        status="in_progress", createdAt_offset_days=-1,
    ),
    dict(
        name="Givat Shaul Apartment Tower",
        description=(
            "Rocket struck floors 8–10 of a 14-storey apartment tower in Givat Shaul. "
            "Three floors structurally compromised; exterior wall breach on eastern face. "
            "Building evacuated — 120 residents displaced. Shaare Zedek hospital 2 km away. "
            "Access via Begin Highway clear."
        ),
        lat=31.7950, lon=35.1872,
        organizationId="org-3", createdBy="user-admin-3",
        damageClassification="Heavy", damageScore=7,
        imageFilename="jerusalem_heavy_2.jpg",
        tags=["residential", "high-rise", "structural", "evacuation"],
        status="pending", createdAt_offset_days=0,
    ),
    dict(
        name="Talpiot Industrial Building Collapse",
        description=(
            "Heavy rocket hit on a 3-storey industrial building in Talpiot industrial zone. "
            "Complete roof collapse on top floor; walls of second floor partially failed. "
            "Electrical substation serving the zone destroyed — 800 units without power. "
            "Nearest hospital 3 km. Good road access via Hebron Road."
        ),
        lat=31.7483, lon=35.2236,
        organizationId="org-3", createdBy="user-admin-3",
        damageClassification="Heavy", damageScore=7,
        imageFilename="jerusalem_heavy_3.jpg",
        tags=["industrial", "power-outage", "structural", "collapse"],
        status="in_progress", createdAt_offset_days=-2,
    ),
    dict(
        name="Pisgat Ze'ev Northern Tower Strike",
        description=(
            "Rocket impacted a residential block in Pisgat Ze'ev northern suburb. "
            "Floors 3–5 of a 7-storey building show severe wall cracking and partial floor "
            "collapse. Gas supply severed for entire block. ~60 residents evacuated. "
            "French Hill hospital 6 km; access via Route 60 available."
        ),
        lat=31.8391, lon=35.2369,
        organizationId="org-3", createdBy="user-admin-3",
        damageClassification="Heavy", damageScore=7,
        imageFilename="jerusalem_heavy_4.jpg",
        tags=["residential", "gas-leak", "suburban", "evacuation"],
        status="pending", createdAt_offset_days=0,
    ),
    dict(
        name="German Colony Garden Wall Damage",
        description=(
            "Rocket fragment destroyed a garden wall and vehicle carport in the German Colony "
            "neighbourhood. Shrapnel caused surface damage to nearby facade. "
            "No structural risk to the building. One parked car destroyed. "
            "Emek Refaim street remains accessible."
        ),
        lat=31.7624, lon=35.2181,
        organizationId="org-3", createdBy="user-admin-3",
        damageClassification="Light", damageScore=3,
        imageFilename="jerusalem_light_1.jpg",
        tags=["residential", "shrapnel", "low-severity"],
        status="completed", createdAt_offset_days=-4,
    ),
    dict(
        name="Hadassah Mount Scopus Perimeter",
        description=(
            "Shrapnel from intercepted missile struck the outer parking area of Hadassah "
            "Mount Scopus hospital campus. Five vehicles damaged; perimeter fence breached. "
            "Hospital operations unaffected — internal structures intact. "
            "Hebrew University campus nearby. Road access fully open."
        ),
        lat=31.7936, lon=35.2453,
        organizationId="org-3", createdBy="user-admin-3",
        damageClassification="Light", damageScore=3,
        imageFilename="jerusalem_light_2.jpg",
        tags=["hospital-perimeter", "shrapnel", "vehicles"],
        status="completed", createdAt_offset_days=-3,
    ),
    dict(
        name="Ramot Residential Shrapnel Scatter",
        description=(
            "Intercepted rocket debris scattered across a residential street in Ramot Allon. "
            "Windows and balcony railings on 6 apartments damaged. One ground-floor unit "
            "sustained minor wall penetration. No injuries. Infrastructure intact. "
            "Main road access via Golda Meir Boulevard available."
        ),
        lat=31.8289, lon=35.1946,
        organizationId="org-3", createdBy="user-admin-3",
        damageClassification="Light", damageScore=3,
        imageFilename="jerusalem_light_3.jpg",
        tags=["residential", "shrapnel", "windows"],
        status="pending", createdAt_offset_days=-1,
    ),
]

_BASE_TIME = datetime.utcnow()


def _make_id() -> str:
    return f"seed-{uuid.uuid4().hex[:8]}"


def _iso(offset_days: int) -> str:
    dt = _BASE_TIME + timedelta(days=offset_days)
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def _city_for_org(org_id: str) -> str:
    return {"org-1": "Tel Aviv", "org-2": "South", "org-3": "Jerusalem"}.get(org_id, "Israel")


def run_seed() -> None:
    logger.info("═" * 60)
    logger.info("PrioritAI Seed Data Generator")
    logger.info("═" * 60)

    logger.info("Pre-loading CBS population data…")
    preload_population_data()
    logger.info("CBS data ready.\n")

    results: list[dict] = []
    total = len(_RAW_EVENTS)

    for i, raw in enumerate(_RAW_EVENTS, 1):
        lat  = raw["lat"]
        lon  = raw["lon"]
        name = raw["name"]
        logger.info(f"[{i:02d}/{total}] {name}  ({lat:.4f}, {lon:.4f})")

        try:
            gis  = get_gis_features(lat, lon)
            score, multiplier = compute_priority(raw["damageScore"], gis)
            explanation = build_explanation(
                raw["damageClassification"], raw["damageScore"], gis, score, multiplier
            )
            logger.info(
                f"          → score={score:.2f}  multiplier=×{multiplier:.2f}  "
                f"hospital={gis.get('dist_hospital_m', -1):.0f} m  "
                f"density={gis.get('population_density', 0):.0f}"
            )
        except Exception as exc:
            logger.warning(f"          GIS failed: {exc} — using defaults")
            gis = {
                "dist_hospital_m": -1, "dist_school_m": -1,
                "dist_military_base_m": -1, "dist_roads_m": -1,
                "population_density": 0,
            }
            score = float(raw["damageScore"])
            multiplier = 1.0
            explanation = (
                f"{raw['damageClassification']} damage detected. "
                f"GIS data unavailable — using base damage score."
            )

        event = {
            "id":                   _make_id(),
            "organizationId":       raw["organizationId"],
            "createdBy":            raw["createdBy"],
            "name":                 raw["name"],
            "description":          raw["description"],
            "location": {
                "lat":     lat,
                "lng":     lon,
                "address": raw.get("address", raw["name"]),
                "city":    _city_for_org(raw["organizationId"]),
            },
            "imageUrl":             f"/uploads/{raw['imageFilename']}",
            "damageClassification": raw["damageClassification"],
            "damageScore":          raw["damageScore"],
            "priorityScore":        round(score, 2),
            "gisDetails": {
                "distHospitalM":     gis.get("dist_hospital_m",      -1),
                "distSchoolM":       gis.get("dist_school_m",        -1),
                "distRoadM":         gis.get("dist_roads_m",         -1),
                "distStrategicM":    gis.get("dist_military_base_m", -1),
                "populationDensity": gis.get("population_density",    0),
                "geoMultiplier":     round(multiplier, 3),
            },
            "gisStatus":    "done",
            "status":       raw["status"].replace("_", " ").title().replace(" ", "_").lower()
                            if "_" not in raw["status"] else raw["status"],
            "hidden":       False,
            "llmExplanation": explanation,
            "aiModel":      "PrioritAI-v2.1",
            "tags":         raw.get("tags", []),
            "createdAt":    _iso(raw.get("createdAt_offset_days", 0)),
        }
        status_map = {"in_progress": "IN_PROGRESS", "pending": "IN_PROGRESS", "completed": "COMPLETED"}
        event["status"] = status_map.get(raw["status"], "IN_PROGRESS")

        results.append(event)

    logger.info(f"\nAll {total} events processed.")
    with open(SEED_JSON, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    logger.info(f"Written → {SEED_JSON}")
    logger.info("═" * 60)


if __name__ == "__main__":
    run_seed()
