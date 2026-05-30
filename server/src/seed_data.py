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

    # ── Tel Aviv (org-1) ──────────────────────────────────────────────────────
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
        imageFilename="tel_aviv_heavy_1.png",
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
        imageFilename="tel_aviv_heavy_2.png",
        tags=["gas-leak", "heritage", "residential"],
        status="in_progress", createdAt_offset_days=0,
    ),
    dict(
        name="פגיעה בינונית בבניין מסחרי בנווה צדק",
        description=(
            "פגיעת רסיס ישירה בקומה ב' של בניין מסחרי-מגורים בן 4 קומות בנווה צדק. "
            "שני קירות פנימיים נושאי עומס ניזוקו; תקרת הקומה מציגה סדקי משיכה. "
            "הקומות 3-4 פונו עד להשלמת הערכה מבנית. "
            "הגישה לאורך רחוב רוקח מוגבלת חלקית. מבנים סמוכים לא ניזוקו."
        ),
        lat=32.0570, lon=34.7580,
        organizationId="org-1", createdBy="user-op-1",
        damageClassification="Medium", damageScore=5,
        imageFilename="tel_aviv_medium_1.jpg",
        tags=["structural", "mixed-use", "evacuation"],
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
        imageFilename="tel_aviv_light_1.webp",
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
        imageFilename="tel_aviv_light_2.jpeg",
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
        status="in_progress", createdAt_offset_days=0,
    ),

    # ── South (org-2) ─────────────────────────────────────────────────────────
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
        imageFilename="south_heavy_2.png",
        tags=["industrial", "hazmat", "structural"],
        status="in_progress", createdAt_offset_days=0,
    ),
    dict(
        name="נזק בינוני לבניין מגורים בשדרות",
        description=(
            "טיל פגע ישירות בקומה שלישית של בניין מגורים בן 5 קומות בשדרות. "
            "קיר חיצוני מזרחי נפרץ ברוחב 5 מ'; שני חדרים אינם ראויים למגורים. "
            "שלד הבניין יציב אך מצריך הערכה מבנית. 14 דיירים פונו. "
            "גישה בכביש 34 פנויה. בית חולים ברזילי במרחק 1.8 ק\"מ."
        ),
        lat=31.5240, lon=34.6010,
        organizationId="org-2", createdBy="user-admin-2",
        damageClassification="Medium", damageScore=5,
        imageFilename="south_medium_1.png",
        tags=["residential", "structural", "evacuation"],
        status="in_progress", createdAt_offset_days=-1,
    ),
    dict(
        name="פגיעה בינונית בבית ספר תיכון בקריית גת",
        description=(
            "פגיעה ישירה באגף המעבדות של בית ספר תיכון בקריית גת. "
            "קיר הצד המזרחי התמוטט חלקית; ריצוף שתי כיתות ניזוק. "
            "שאר הבניין תקין. המוסד נסגר לשבועיים לצורך תיקון. "
            "חצר החנייה נחסמה על ידי הריסות. אין נפגעים — בית הספר פונה לפני הפגיעה."
        ),
        lat=31.6070, lon=34.7700,
        organizationId="org-2", createdBy="user-admin-2",
        damageClassification="Medium", damageScore=5,
        imageFilename="south_medium_2.png",
        tags=["school", "structural", "debris"],
        status="in_progress", createdAt_offset_days=0,
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
        name="נזק קל למרכז קהילתי בנתיבות",
        description=(
            "שרפרל מטיל מיורט פגע בגג רעף של מרכז קהילתי בנתיבות. "
            "12 רעפים הוסרו; מספר צינורות ניקוז נפגמו. "
            "חדירת מים קלה לאולם הכניסה. אין נזק מבני. "
            "המרכז שב לפעילות לאחר 24 שעות. אין נפגעים."
        ),
        lat=31.4230, lon=34.5910,
        organizationId="org-2", createdBy="user-admin-2",
        damageClassification="Light", damageScore=3,
        imageFilename="south_light_2.jpeg",
        tags=["community", "roof", "shrapnel"],
        status="completed", createdAt_offset_days=-4,
    ),
    dict(
        name="נזק קל לבית ספר יסודי בערד",
        description=(
            "גל הדף מטיל מיורט שבר חלונות ב-4 כיתות בבית ספר יסודי בערד. "
            "דלתות מתכת עיוותו קלות ואינן נסגרות כהלכה. "
            "אין נזק מבני. בית הספר שב לפעילות לאחר החלפת חלונות. "
            "אין נפגעים — בית הספר פונה לפני הפגיעה."
        ),
        lat=31.2550, lon=35.2120,
        organizationId="org-2", createdBy="user-admin-2",
        damageClassification="Light", damageScore=3,
        imageFilename="south_light_3.webp",
        tags=["school", "windows", "shrapnel"],
        status="completed", createdAt_offset_days=-3,
    ),

    # ── Jerusalem (org-3) ─────────────────────────────────────────────────────
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
        imageFilename="jerusalem_heavy_2.png",
        tags=["residential", "high-rise", "structural", "evacuation"],
        status="in_progress", createdAt_offset_days=0,
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
        imageFilename="jerusalem_heavy_3.png",
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
        imageFilename="jerusalem_heavy_4.png",
        tags=["residential", "gas-leak", "suburban", "evacuation"],
        status="in_progress", createdAt_offset_days=0,
    ),
    dict(
        name="פגיעה בינונית בבניין מגורים בקטמון",
        description=(
            "פגיעת רסיס ישירה בקומות 4-5 של בניין מגורים בן 6 קומות בשכונת קטמון. "
            "שני קירות חיצוניים נפגעו; שלד הבניין מציג סדקי משיכה בעמודי קומה ד'. "
            "10 דיירים פונו. קווי חשמל נותקו לשתי קומות. "
            "בית חולים שערי צדק במרחק 2.1 ק\"מ. גישה ברחוב בית לחם פנויה."
        ),
        lat=31.7620, lon=35.2150,
        organizationId="org-3", createdBy="user-admin-3",
        damageClassification="Medium", damageScore=5,
        imageFilename="jerusalem_medium_1.png",
        tags=["residential", "structural", "evacuation"],
        status="in_progress", createdAt_offset_days=0,
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
        imageFilename="jerusalem_light_1.jpeg",
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
        imageFilename="jerusalem_light_2.png",
        tags=["hospital-perimeter", "shrapnel", "vehicles"],
        status="completed", createdAt_offset_days=-3,
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
