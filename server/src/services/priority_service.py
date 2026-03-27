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
    """Generate a human-readable explanation of the priority score (static fallback)."""

    def fmt_m(v: float) -> str:
        if v < 0:
            return "not found within 15 km"
        return f"{v / 1000:.1f} km" if v >= 1000 else f"{int(v)} m"

    severity = "critical" if final_score >= 7.5 else "high" if final_score >= 5.0 else "moderate"
    density  = int(gis_features.get("population_density", 0))

    return (
        f"{classification} damage classification detected by vision AI model. "
        f"Structural characteristics are consistent with {classification.lower()} damage patterns — "
        f"{'immediate structural assessment recommended.' if classification == 'Heavy' else 'standard repair scheduling is appropriate.'} "
        f"Geographic context: "
        f"nearest hospital {fmt_m(gis_features.get('dist_hospital_m', -1))}, "
        f"nearest school {fmt_m(gis_features.get('dist_school_m', -1))}, "
        f"nearest road {fmt_m(gis_features.get('dist_roads_m', -1))}, "
        f"nearest strategic site {fmt_m(gis_features.get('dist_military_base_m', -1))}, "
        f"population density {density:,} persons/km². "
        f"Geographic multiplier: \u00d7{multiplier:.2f}. "
        f"Final priority score: {final_score:.1f}/10 ({severity} priority). "
        f"Score formula: damage({damage_score}) \u00d7 geo_multiplier({multiplier:.2f}) = {final_score:.1f}."
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
            return "not available within 15 km"
        return f"{v / 1000:.1f} km" if v >= 1000 else f"{int(v)} m"

    severity = "critical" if final_score >= 7.5 else "high" if final_score >= 5.0 else "moderate"
    density  = int(gis_features.get("population_density", 0))

    system_prompt = (
        "You are a professional urban emergency analyst for the PrioritAI system, "
        "which prioritizes rehabilitation of rocket-damaged buildings in Israel. "
        "Your role is to write a concise, objective, and humanitarian-focused explanation "
        "of why a building received its rehabilitation priority score. "
        "\n\n"
        "STRICT RULES:\n"
        "- Base your explanation ONLY on the data provided in the user message. "
        "Do NOT invent, assume, or hallucinate any geographic features, distances, "
        "population figures, or damage details that are not explicitly given.\n"
        "- If a facility (hospital, school, etc.) is listed as 'not available within 15 km', "
        "treat it as absent from the proximity calculation.\n"
        "- Write 3–5 sentences maximum. Be direct and professional.\n"
        "- Do not use bullet points or headers — output plain prose only.\n"
        "- Conclude with the final score and its severity level."
    )

    user_message = (
        f"Building damage assessment data:\n"
        f"- Damage classification (Computer Vision): {classification} (score {damage_score}/10)\n"
        f"- Nearest hospital: {fmt_m(gis_features.get('dist_hospital_m', -1))}\n"
        f"- Nearest school: {fmt_m(gis_features.get('dist_school_m', -1))}\n"
        f"- Nearest road: {fmt_m(gis_features.get('dist_roads_m', -1))}\n"
        f"- Nearest strategic site: {fmt_m(gis_features.get('dist_military_base_m', -1))}\n"
        f"- Population density: {density:,} persons/km²\n"
        f"- Geographic multiplier applied: ×{multiplier:.2f}\n"
        f"- Final priority score: {final_score:.1f}/10 (severity: {severity})\n"
        f"\n"
        f"Explain why this building received a {severity} priority score based solely on the data above."
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
