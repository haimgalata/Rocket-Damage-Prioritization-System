"""Priority service layer — wraps priority_logic and builds score explanations."""

import logging
import os

from server.src.core.priority_logic import get_final_priority_score

logger = logging.getLogger(__name__)


def compute_priority(damage_score: int, gis_features: dict) -> tuple[float, float]:
    """Compute the final priority score and raw geographic multiplier."""
    return get_final_priority_score(damage_score, gis_features)


def build_explanation(
    classification: str,
    damage_score: int,
    gis_features: dict,
    final_score: float,
    multiplier: float,
) -> str:
    """Generate a human-readable Hebrew explanation of the priority score (static fallback)."""

    def fmt_m(v: float) -> str:
        if v < 0:
            return 'לא נמצא בטווח 15 ק"מ'
        return f'{v / 1000:.1f} ק"מ' if v >= 1000 else f"{int(v)} מ'"

    if classification == "Heavy":
        damage_label = "כבד"
        assessment_note = "מומלץ הערכה מבנית מיידית."
    elif classification == "Medium":
        damage_label = "בינוני"
        assessment_note = "נדרשת הערכה מבנית לפני חידוש הפעילות."
    else:
        damage_label = "קל"
        assessment_note = "תיקון רגיל מתאים לנזק מסוג זה."
    severity = "קריטי" if final_score >= 7.5 else "גבוה" if final_score >= 5.0 else "בינוני"
    density  = int(gis_features.get("population_density", 0))

    return (
        f"זוהה נזק {damage_label} על ידי מודל ראייה ממוחשבת. "
        f"המאפיינים המבניים עקביים עם דפוסי נזק {damage_label} — {assessment_note} "
        f"הקשר גיאוגרפי: "
        f"בית חולים קרוב {fmt_m(gis_features.get('dist_hospital_m', -1))}, "
        f"בית ספר קרוב {fmt_m(gis_features.get('dist_school_m', -1))}, "
        f"כביש קרוב {fmt_m(gis_features.get('dist_roads_m', -1))}, "
        f"אתר אסטרטגי קרוב {fmt_m(gis_features.get('dist_military_base_m', -1))}, "
        f'צפיפות אוכלוסין {density:,} נפש/קמ"ר. '
        f"מכפיל גיאוגרפי: ×{multiplier:.2f}. "
        f"ציון עדיפות סופי: {final_score:.1f}/10 (עדיפות {severity}). "
        f"נוסחת ניקוד: נזק({damage_score}) × מכפיל_גיאוגרפי({multiplier:.2f}) = {final_score:.1f}."
    )


def build_llm_explanation(
    classification: str,
    damage_score: int,
    gis_features: dict,
    final_score: float,
    multiplier: float,
) -> str:
    """Generate a dynamic, LLM-powered explanation using Groq.

    Falls back to the static build_explanation() if the API key is missing
    or if the Groq call fails for any reason.
    """
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key:
        return build_explanation(classification, damage_score, gis_features, final_score, multiplier)

    def fmt_m(v: float) -> str:
        if v < 0:
            return 'לא נמצא בטווח 15 ק"מ'
        return f'{v / 1000:.1f} ק"מ' if v >= 1000 else f"{int(v)} מ'"

    if classification == "Heavy":
        damage_label = "כבד"
    elif classification == "Medium":
        damage_label = "בינוני"
    else:
        damage_label = "קל"
    severity = "קריטי" if final_score >= 7.5 else "גבוה" if final_score >= 5.0 else "בינוני"
    density  = int(gis_features.get("population_density", 0))

    system_prompt = (
        "אתה אנליסט חירום עירוני במערכת PrioritAI.\n\n"

        "המטרה שלך היא להסביר בצורה קצרה וברורה "
        "מה הגורמים המרכזיים שהשפיעו על ציון העדיפות של המבנה.\n\n"

        "כללים:\n"
        "- כתוב 2-3 משפטים בלבד\n"
        "- השתמש בעברית פשוטה, ברורה ומקצועית\n"
        "- התמקד בגורמים שהעלו או הורידו את העדיפות\n"
        "- אל תשתמש בשפה גבוהה, בירוקרטית או חוזרת על עצמה\n"
        "- אל תמציא מידע שלא סופק\n"
        '- אם מתקן מופיע כ"לא נמצא בטווח 15 ק"מ", התעלם ממנו\n'
        "- סיים עם ציון העדיפות הסופי ורמת העדיפות\n"
    )

    user_message = (
        f"נתוני הערכת נזק לבניין:\n"
        f"- סיווג נזק (ראייה ממוחשבת): {damage_label} (ציון {damage_score}/10)\n"
        f"- בית חולים קרוב: {fmt_m(gis_features.get('dist_hospital_m', -1))}\n"
        f"- בית ספר קרוב: {fmt_m(gis_features.get('dist_school_m', -1))}\n"
        f"- כביש קרוב: {fmt_m(gis_features.get('dist_roads_m', -1))}\n"
        f"- אתר אסטרטגי קרוב: {fmt_m(gis_features.get('dist_military_base_m', -1))}\n"
        f'- צפיפות אוכלוסין: {density:,} נפש/קמ"ר\n'
        f"- מכפיל גיאוגרפי: ×{multiplier:.2f}\n"
        f"- ציון עדיפות סופי: {final_score:.1f}/10 (חומרה: {severity})\n"
        f"\n"
        f"הסבר מדוע קיבל הבניין ציון עדיפות {severity} על סמך הנתונים לעיל בלבד."
    )

    try:
        from groq import Groq  # imported lazily so the app starts without groq installed

        client = Groq(api_key=api_key)
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_message},
            ],
            temperature=0.15,
            max_tokens=350,
            timeout=15,
        )
        if not response.choices:
            logger.warning("[LLM] Groq returned empty choices list; using static fallback")
            return build_explanation(classification, damage_score, gis_features, final_score, multiplier)
        content = response.choices[0].message.content
        if not content:
            logger.warning("[LLM] Groq returned empty content; using static fallback")
            return build_explanation(classification, damage_score, gis_features, final_score, multiplier)
        return content.strip()
    except Exception as exc:
        logger.warning("[LLM] Groq call failed (%s: %s); using static fallback", type(exc).__name__, exc)
        return build_explanation(classification, damage_score, gis_features, final_score, multiplier)
