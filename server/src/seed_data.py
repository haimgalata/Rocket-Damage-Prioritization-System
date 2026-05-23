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
        name="פגיעה במרכז דיזנגוף",
        description=(
            "פגיעה ישירה של טיל בחזית הצפונית של קניון מרכז דיזנגוף. "
            "עמודי שלד בקומות 2-4 מציגים סדקי גזירה גלויים. חזית הזכוכית קרסה לאורך 30 מטר. "
            "מספר קווי תשתית נותקו. האזור צפוף מאוד; פינוי בתהליך."
        ),
        lat=32.0785, lon=34.7740,
        organizationId="org-1", createdBy="user-op-1",
        damageClassification="Heavy", damageScore=7,
        imageFilename="tel_aviv_heavy_1.jpg",
        tags=["structural", "evacuation", "commercial"],
        status="in_progress", createdAt_offset_days=-1,
    ),
    dict(
        name="קריסת מבנה בשדרות רוטשילד",
        description=(
            "מגדל מגורים בשדרות רוטשילד ספג מכה קרובה שגרמה לקריסה חלקית של גרם המדרגות המזרחי. "
            "שלוש קומות עליונות פגומות. דליפת גז זוהתה בקומת הקרקע. "
            "האזור המסחרי נגיש — כלי חירום בשטח. המבנה רשום כמורשת."
        ),
        lat=32.0627, lon=34.7739,
        organizationId="org-1", createdBy="user-op-1",
        damageClassification="Heavy", damageScore=7,
        imageFilename="tel_aviv_heavy_2.jpg",
        tags=["gas-leak", "heritage", "residential"],
        status="pending", createdAt_offset_days=0,
    ),
    dict(
        name="שריפה במחסן נמל יפו",
        description=(
            "פגיעת טיל הצתה מחסן בחוף נמל יפו. "
            "האש התפשטה לשתי יחידות אחסון סמוכות המכילות חומרים דליקים. "
            "פעילות הנמל הושעתה. כבאות וצוות חומ\"ס פרוסים. "
            "מבנים היסטוריים של העיר העתיקה בטווח 200 מ' בסיכון לנזק חום."
        ),
        lat=32.0530, lon=34.7510,
        organizationId="org-1", createdBy="user-op-1",
        damageClassification="Heavy", damageScore=7,
        imageFilename="tel_aviv_heavy_3.jpg",
        tags=["fire", "hazmat", "port", "heritage"],
        status="in_progress", createdAt_offset_days=-2,
    ),
    dict(
        name="נזק גג בבית מלאכה פלורנטין",
        description=(
            "רסיס טיל נחת על גג שטוח של בית מלאכה דו-קומתי בשכונת פלורנטין. "
            "קרום הגג ניקב; סדקים מבניים קלים בקיר הגדר. אין נפגעים. "
            "אספקת חשמל הופסקה ל-12 יחידות בבניין. האזור נגיש בכבישים ראשיים."
        ),
        lat=32.0555, lon=34.7660,
        organizationId="org-1", createdBy="user-op-1",
        damageClassification="Light", damageScore=3,
        imageFilename="tel_aviv_light_1.jpg",
        tags=["roof", "power-outage"],
        status="completed", createdAt_offset_days=-3,
    ),
    dict(
        name="שרפרל ברמת אביב — מגורים",
        description=(
            "שרפרל מטיל מיורט פוזר בחצר מגורים ברמת אביב. "
            "נזק קל לחזית שלושה בנייני מגורים — סדקים בטיח וחלונות שבורים. "
            "לא זוהה סיכון מבני. הדיירים הורשו לשוב לאחר בדיקת בטיחות ראשונית."
        ),
        lat=32.1100, lon=34.8050,
        organizationId="org-1", createdBy="user-op-1",
        damageClassification="Light", damageScore=3,
        imageFilename="tel_aviv_light_2.jpg",
        tags=["shrapnel", "residential", "windows"],
        status="completed", createdAt_offset_days=-4,
    ),
    dict(
        name="פגיעה בתשתית פארק הירקון",
        description=(
            "טיל פגע בשטח פתוח בפארק הירקון ליד מתקני הספורט. "
            "צינורות השקיה נפרצו; ארון חשמל המשרת את מגרשי הטניס הושמד. "
            "אין נפגעים. שבילים וגשרון אחד מציגים בורות שטח. "
            "הפארק נסגר זמנית לציבור."
        ),
        lat=32.0982, lon=34.7962,
        organizationId="org-1", createdBy="user-op-1",
        damageClassification="Light", damageScore=3,
        imageFilename="tel_aviv_light_3.jpg",
        tags=["infrastructure", "park", "electrical"],
        status="pending", createdAt_offset_days=0,
    ),
    dict(
        name="פגיעה בתחנה המרכזית באר שבע",
        description=(
            "פגיעה ישירה בסיפון העליון של התחנה המרכזית באר שבע. "
            "מצע הבטון המזוין מעל טרמינל 3 קרס חלקית. הריסות כבדות על הרציפים. "
            "מים וחשמל נותקו לאגף הצפוני. "
            "בית חולים במרחק 1.2 ק\"מ — כבישי גישה חסומים חלקית על ידי הריסות."
        ),
        lat=31.2432, lon=34.7925,
        organizationId="org-2", createdBy="user-admin-2",
        damageClassification="Heavy", damageScore=7,
        imageFilename="south_heavy_1.jpg",
        tags=["transport", "structural", "debris"],
        status="in_progress", createdAt_offset_days=-1,
    ),
    dict(
        name="פגיעה באזור התעשייה דימונה",
        description=(
            "טיל פגע בגדר ההיקף של אזור התעשייה בדימונה. "
            "שתי יחידות מפעל ספגו נזק מבני כבד — קריסת גג ביחידה ב'. "
            "קרבת אחסון כימי מחייבת הערכת חומ\"ס לפני כניסה. "
            "גישה בכביש דרומי זמינה; גישה צפונית חסומה."
        ),
        lat=31.0676, lon=35.0333,
        organizationId="org-2", createdBy="user-admin-2",
        damageClassification="Heavy", damageScore=7,
        imageFilename="south_heavy_2.jpg",
        tags=["industrial", "hazmat", "structural"],
        status="pending", createdAt_offset_days=0,
    ),
    dict(
        name="פגיעה ברובע המגורים קיבוץ ניר עוז",
        description=(
            "מספר פגיעות טיל ברובע המגורים של קיבוץ ניר עוז. "
            "ארבעה בתים ספגו פגיעות ישירות עם קריסת גג וקירות. "
            "חדר האוכל הקהילתי הושמד חלקית. קהילה של כ-400 תושבים פונתה. "
            "גישה בכביש 232 פנויה. בית החולים הקרוב בשדרות (8 ק\"מ)."
        ),
        lat=31.3667, lon=34.4333,
        organizationId="org-2", createdBy="user-admin-2",
        damageClassification="Heavy", damageScore=7,
        imageFilename="south_heavy_3.jpg",
        tags=["residential", "evacuation", "kibbutz"],
        status="in_progress", createdAt_offset_days=-2,
    ),
    dict(
        name="נזק להיקף בית ספר באופקים",
        description=(
            "טיל נחת בחצר בית ספר יסודי באופקים. "
            "חומת ההיקף נהרסה לאורך 15 מ'; שתי כיתות ניידות עם חורי שרפרל. "
            "אין נפגעים — בית הספר פונה לפני הפגיעה. המבנה הראשי תקין. "
            "תיקונים מוערכים ב-2-3 ימים."
        ),
        lat=31.3193, lon=34.6222,
        organizationId="org-2", createdBy="user-admin-2",
        damageClassification="Light", damageScore=3,
        imageFilename="south_light_1.jpg",
        tags=["school", "shrapnel", "perimeter"],
        status="completed", createdAt_offset_days=-3,
    ),
    dict(
        name="גדר היקף קיבוץ רביבים",
        description=(
            "טיל פגע בהיקף החקלאי של קיבוץ רביבים בנגב המרכזי. "
            "קו הגדר נהרס לאורך 80 מ'; תחנת משאבות השקיה נפגעה. "
            "אין נפגעים. קיבוץ קטן (~350 תושבים) באזור מדברי מבודד. "
            "כביש סלול קרוב 4 ק\"מ; בית חולים קרוב מעל 40 ק\"מ (באר שבע)."
        ),
        lat=31.0000, lon=34.8833,
        organizationId="org-2", createdBy="user-admin-2",
        damageClassification="Light", damageScore=3,
        imageFilename="south_isolated_light_1.jpg",
        tags=["isolated", "agricultural", "fence"],
        status="pending", createdAt_offset_days=0,
    ),
    dict(
        name="פגיעה במרכז המבקרים מצפה רמון",
        description=(
            "טיל פגע בחניון מרכז המבקרים מכתש רמון במצפה רמון. "
            "פני האספלט נפגעו; רכב אחד הושמד. חזית הזכוכית של מרכז המבקרים נסדקה. "
            "מיקום מרוחק — 25 ק\"מ מבית החולים הקרוב בירוחם. "
            "צפיפות אוכלוסין כמעט אפס. גישה בכביש 40 בלבד."
        ),
        lat=30.6100, lon=34.8010,
        organizationId="org-2", createdBy="user-admin-2",
        damageClassification="Light", damageScore=3,
        imageFilename="south_isolated_light_2.jpg",
        tags=["isolated", "tourism", "remote"],
        status="completed", createdAt_offset_days=-5,
    ),
    dict(
        name="נזק לתחנת המחקר שדה בוקר",
        description=(
            "שרפרל מטיל מיורט פגע בחממת מחקר בקמפוס שדה בוקר "
            "(מחקר מדבר של אוניברסיטת בן גוריון). "
            "שלושה לוחות חממה הושמדו; גידולים ניסיוניים אבדו. "
            "תשתית מינימלית — אין כבישים במרחק 3 ק\"מ, בית חולים קרוב 35 ק\"מ. "
            "הצוות פונה בשלום."
        ),
        lat=30.8517, lon=34.7861,
        organizationId="org-2", createdBy="user-admin-2",
        damageClassification="Light", damageScore=3,
        imageFilename="south_isolated_light_3.jpg",
        tags=["isolated", "academic", "greenhouse", "remote"],
        status="pending", createdAt_offset_days=-1,
    ),
    dict(
        name="פגיעה ישירה בשוק מחנה יהודה",
        description=(
            "טיל פגע בקטע המקורה של שוק מחנה יהודה בשעות הבוקר. "
            "גג ברזל על 40 דוכנים קרס. שני עמודי תמך נשברו. "
            "השוק בלב ירושלים המערבית — שכונה צפופה מאוד. "
            "בית חולים הדסה עין כרם במרחק 4 ק\"מ. כבישי גישה ראשיים חסומים חלקית."
        ),
        lat=31.7845, lon=35.2133,
        organizationId="org-3", createdBy="user-admin-3",
        damageClassification="Heavy", damageScore=7,
        imageFilename="jerusalem_heavy_1.jpg",
        tags=["market", "structural", "collapse", "urban"],
        status="in_progress", createdAt_offset_days=-1,
    ),
    dict(
        name="מגדל מגורים גבעת שאול",
        description=(
            "טיל פגע בקומות 8-10 של מגדל מגורים בן 14 קומות בגבעת שאול. "
            "שלוש קומות ספגו פגיעה מבנית; פרצה בקיר חיצוני בחזית המזרחית. "
            "המבנה פונה — 120 דיירים עקורים. בית חולים שערי צדק במרחק 2 ק\"מ. "
            "גישה בכביש בגין פנויה."
        ),
        lat=31.7950, lon=35.1872,
        organizationId="org-3", createdBy="user-admin-3",
        damageClassification="Heavy", damageScore=7,
        imageFilename="jerusalem_heavy_2.jpg",
        tags=["residential", "high-rise", "structural", "evacuation"],
        status="pending", createdAt_offset_days=0,
    ),
    dict(
        name="קריסת מבנה תעשייתי בתלפיות",
        description=(
            "פגיעת טיל כבדה על מבנה תעשייתי בן 3 קומות באזור התעשייה תלפיות. "
            "קריסה מוחלטת של גג הקומה העליונה; קירות הקומה השנייה כשלו חלקית. "
            "תחנת חשמל משנית המשרתת את האזור הושמדה — 800 יחידות ללא חשמל. "
            "בית חולים קרוב 3 ק\"מ. גישה טובה בכביש חברון."
        ),
        lat=31.7483, lon=35.2236,
        organizationId="org-3", createdBy="user-admin-3",
        damageClassification="Heavy", damageScore=7,
        imageFilename="jerusalem_heavy_3.jpg",
        tags=["industrial", "power-outage", "structural", "collapse"],
        status="in_progress", createdAt_offset_days=-2,
    ),
    dict(
        name="פגיעה במגדל הצפוני פסגת זאב",
        description=(
            "טיל פגע ברובע מגורים בפרבר הצפוני פסגת זאב. "
            "קומות 3-5 של מבנה בן 7 קומות מציגות סדיקת קירות חמורה וקריסה חלקית של רצפות. "
            "אספקת גז נותקה לכל הרובע. כ-60 דיירים פונו. "
            "בית חולים הר הצופים 6 ק\"מ; גישה בכביש 60 זמינה."
        ),
        lat=31.8391, lon=35.2369,
        organizationId="org-3", createdBy="user-admin-3",
        damageClassification="Heavy", damageScore=7,
        imageFilename="jerusalem_heavy_4.jpg",
        tags=["residential", "gas-leak", "suburban", "evacuation"],
        status="pending", createdAt_offset_days=0,
    ),
    dict(
        name="נזק לגדר גינה במושבה הגרמנית",
        description=(
            "רסיס טיל הרס גדר גינה ומחסה רכב בשכונת המושבה הגרמנית. "
            "שרפרל גרם לנזק שטחי לחזית סמוכה. "
            "אין סיכון מבני למבנה. רכב חנוי אחד הושמד. "
            "רחוב עמק רפאים נותר נגיש."
        ),
        lat=31.7624, lon=35.2181,
        organizationId="org-3", createdBy="user-admin-3",
        damageClassification="Light", damageScore=3,
        imageFilename="jerusalem_light_1.jpg",
        tags=["residential", "shrapnel", "low-severity"],
        status="completed", createdAt_offset_days=-4,
    ),
    dict(
        name="היקף הדסה הר הצופים",
        description=(
            "שרפרל מטיל מיורט פגע בחניון החיצוני של קמפוס בית החולים הדסה הר הצופים. "
            "חמישה כלי רכב ניזוקו; גדר ההיקף נפרצה. "
            "פעילות בית החולים לא הושפעה — מבנים פנימיים תקינים. "
            "קמפוס האוניברסיטה העברית בסמוך. גישה לדרכים פתוחה לחלוטין."
        ),
        lat=31.7936, lon=35.2453,
        organizationId="org-3", createdBy="user-admin-3",
        damageClassification="Light", damageScore=3,
        imageFilename="jerusalem_light_2.jpg",
        tags=["hospital-perimeter", "shrapnel", "vehicles"],
        status="completed", createdAt_offset_days=-3,
    ),
    dict(
        name="פיזור שרפרל — רמות מגורים",
        description=(
            "הריסות טיל מיורט פוזרו ברחוב מגורים ברמות אלון. "
            "חלונות ומעקות מרפסות ב-6 דירות ניזוקו. "
            "יחידה אחת בקומת הקרקע ספגה חדירת קיר קלה. "
            "אין נפגעים. תשתיות תקינות. גישה ראשית בשדרות גולדה מאיר זמינה."
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
    return {"org-1": "תל אביב", "org-2": "דרום", "org-3": "ירושלים"}.get(org_id, "ישראל")


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
        seed_key = f"prioritai-seed-{i:02d}"
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
            explanation = "זוהה נזק — נתוני GIS אינם זמינים. מתבסס על ציון נזק בסיסי."

        event = {
            "id":                   _make_id(),
            "seedKey":              seed_key,
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
