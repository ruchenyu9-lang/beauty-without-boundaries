"""Feature 4: Color Vision Accessibility."""

from fastapi import APIRouter

from app.services.claude_service import claude_service
from app.services.color_vision_service import (
    daltonize_pixel, daltonize_image_data, detect_color_blind_type,
    generate_custom_palette, ISHIHARA_PLATES,
)

router = APIRouter()


@router.post("/daltonize-image")
def daltonize_image(body: dict):
    """Apply Daltonize color enhancement to image pixel data."""
    pixels = body.get("pixels", [])  # List of [R, G, B] arrays
    cb_type = body.get("cb_type", "deuteranopia")

    if not pixels:
        return {"daltonized_pixels": [], "cb_type": cb_type}

    rgb_tuples = [(p[0], p[1], p[2]) for p in pixels]
    daltonized = daltonize_image_data(rgb_tuples, cb_type)
    daltonized_arrays = [[r, g, b] for r, g, b in daltonized]

    return {"daltonized_pixels": daltonized_arrays, "cb_type": cb_type}


@router.post("/daltonize-single")
def daltonize_single(body: dict):
    """Apply Daltonize to a single hex color."""
    hex_color = body.get("hex_color", "#C44569")
    cb_type = body.get("cb_type", "deuteranopia")

    hex_clean = hex_color.lstrip("#")
    r, g, b = int(hex_clean[0:2], 16), int(hex_clean[2:4], 16), int(hex_clean[4:6], 16)
    dr, dg, db = daltonize_pixel(r, g, b, cb_type)
    daltonized_hex = f"#{dr:02X}{dg:02X}{db:02X}"

    return {"original_hex": hex_color, "daltonized_hex": daltonized_hex, "cb_type": cb_type}


@router.post("/identify-product-color")
def identify_product_color(body: dict):
    """Identify colors in a product photo (mock)."""
    language = body.get("language", "zh")
    return claude_service.identify_product_color("", language)


@router.post("/detect-type")
def detect_cb_type(body: dict):
    """Evaluate Ishihara quiz answers to detect color blindness type."""
    quiz_answers = body.get("quiz_answers", [])
    return detect_color_blind_type(quiz_answers)


@router.get("/ishihara-plates")
def get_ishihara_plates():
    """Return Ishihara test plate data for the quiz UI."""
    return {"plates": ISHIHARA_PLATES, "total": len(ISHIHARA_PLATES)}


@router.post("/generate-palette")
def generate_palette(body: dict):
    """Generate a custom color palette based on user's color blindness type."""
    cb_type = body.get("cb_type", "deuteranopia")
    skin_tone_lab = body.get("skin_tone_lab", {"L": 65.2, "a": 12.3, "b": 18.5})

    from app.main import get_shades_db
    shades_db = get_shades_db()

    palette = generate_custom_palette(cb_type, skin_tone_lab, shades_db)
    return {"palette": palette, "cb_type": cb_type}
