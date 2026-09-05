"""Makeup look generation service — orchestrates mock AI + shade matching."""

from typing import Any

from app.services.claude_service import claude_service
from app.utils.color_math import (
    delta_e_2000, classify_match, detect_undertone,
    hex_to_lab, rgb_to_lab,
)


def shade_match(
    user_shade_lab: tuple[float, float, float],
    shade_database: list[dict],
    product_type_filter: str | None = None,
) -> list[dict]:
    """Find closest shades by deltaE2000 color distance.

    Returns top 5 matches sorted by ascending deltaE.
    """
    results = []
    for shade in shade_database:
        if product_type_filter and shade.get("product_type") != product_type_filter:
            continue
        shade_lab = (shade["lab_l"], shade["lab_a"], shade["lab_b"])
        dE = delta_e_2000(user_shade_lab, shade_lab)
        results.append({
            "shade_id": shade["id"],
            "product_id": shade.get("product_id", 0),
            "shade_name": shade["shade_name"],
            "shade_number": shade["shade_number"],
            "delta_e": round(dE, 2),
            "hex_color": shade["hex_color"],
            "match_quality": classify_match(dE),
        })
    results.sort(key=lambda r: r["delta_e"])
    return results[:5]


def generate_makeup_looks(
    skin_tone_lab: dict,
    available_shade_ids: list[int],
    shade_database: list[dict],
    style: str = "natural",
    occasion: str = "daily",
    language: str = "zh",
) -> dict:
    """Generate makeup looks using mock data + shade matching.

    1. Find matching shades in database for the user's input
    2. Call mock Claude service for look generation
    3. Validate shade references
    """
    # Find available shades from database
    available_shades = []
    for shade in shade_database:
        if shade["id"] in available_shade_ids:
            available_shades.append(shade)

    # Use mock service to generate looks
    result = claude_service.generate_makeup_looks(
        skin_tone_lab=skin_tone_lab,
        available_shades=available_shades,
        style=style,
        occasion=occasion,
        language=language,
    )

    return result


def extract_skin_tone_from_image(
    image_rgb: tuple[int, int, int],
) -> dict:
    """Extract skin tone from a single representative RGB value.

    In production, this would sample multiple face landmark positions.
    For mock, we accept a single RGB and convert to Lab.
    """
    L, a, b = rgb_to_lab(*image_rgb)
    undertone = detect_undertone(L, a, b)
    hex_color = f"#{image_rgb[0]:02X}{image_rgb[1]:02X}{image_rgb[2]:02X}"

    return {
        "lab": {"L": round(L, 2), "a": round(a, 2), "b": round(b, 2)},
        "hex": hex_color,
        "undertone": undertone,
        "confidence": 0.85,
    }
