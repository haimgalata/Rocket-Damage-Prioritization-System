"""Priority service layer — wraps priority_logic and builds score explanations."""

import os
from server.src.core.priority_logic import get_final_priority_score


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

    damage_label = "כבד" if classification == "Heavy" else "קל"
    severity = "קריטי" if final_score >= 7.5 else "גבוה" if final_score >= 5.0 else "בינוני"
    density  = int(gis_features.get("population_density", 0))
    assessment_note = "מומלץ הערכה מבנית מיידית." if classification == "Heavy" else "תיקון רגיל מתאים לנזק מסוג זה."

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

    damage_label = "כבד" if classification == "Heavy" else "קל"
    severity = "קריטי" if final_score >= 7.5 else "גבוה" if final_score >= 5.0 else "בינוני"
    density  = int(gis_features.get("population_density", 0))

    system_prompt = (
        "אתה אנליסט חירום עירוני מקצועי במערכת PrioritAI, המתעדפת שיקום מבנים שנפגעו בישראל. "
        "תפקידך לכתוב הסבר תמציתי, מקצועי ומבוסס-נתונים על מדוע קיבל הבניין את ציון העדיפות שקיבל."
        "\n\n"
        "כללים מחייבים:\n"
        "- התבסס אך ורק על הנתונים שסופקו בהודעת המשתמש. אל תמציא, תניח או תהלוצין על מרחקים, "
        "נתוני אוכלוסיה או פרטי נזק שלא ניתנו.\n"
        '- אם מתקן (בית חולים, בית ספר וכד\') מופיע כ"לא נמצא בטווח 15 ק"מ", התייחס אליו כאל נעדר מחישוב הקרבה.\n'
        "- כתוב 3-4 משפטים לכל היותר. היה ישיר ומקצועי.\n"
        "- אל תשתמש בנקודות קליעה או כותרות — פרוזה בלבד.\n"
        "- סיים עם ציון העדיפות הסופי ורמת החומרה שלו.\n"
        "- כתוב בעברית תקנית, ברורה ומתאימה להנהלת חירום."
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
            model="llama3-8b-8192",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_message},
            ],
            temperature=0.3,
            max_tokens=256,
        )
        return response.choices[0].message.content.strip()
    except Exception:
        return build_explanation(classification, damage_score, gis_features, final_score, multiplier)
