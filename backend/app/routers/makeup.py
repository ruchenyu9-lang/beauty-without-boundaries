"""Feature 1: Smart Makeup Generation with Shade Matching."""

from fastapi import APIRouter

from app.main import get_products_db, get_shades_db
from app.services.makeup_generator import shade_match, generate_makeup_looks, extract_skin_tone_from_image
from app.utils.color_math import hex_to_lab

router = APIRouter()


@router.post("/scan-face")
def scan_face(body: dict):
    """Extract skin tone from a face image (mock: accept hex or RGB)."""
    # Accept {"hex": "#D4A574"} or {"r": 212, "g": 165, "b": 116} or empty (default)
    if "hex" in body and body["hex"]:
        hex_color = body["hex"].lstrip("#")
        r = int(hex_color[0:2], 16)
        g = int(hex_color[2:4], 16)
        b = int(hex_color[4:6], 16)
        rgb = (r, g, b)
    elif "r" in body:
        rgb = (body["r"], body["g"], body["b"])
    else:
        # Default: medium warm skin tone
        rgb = (212, 165, 116)

    return extract_skin_tone_from_image(rgb)


@router.post("/shade-match")
def shade_match_endpoint(body: dict):
    """Find closest shades in the database by deltaE2000."""
    skin_tone_lab = body.get("skin_tone_lab", {"L": 65.2, "a": 12.3, "b": 18.5})
    shade_numbers = body.get("shade_numbers", [])
    product_type_filter = body.get("product_type_filter")

    shades_db = get_shades_db()
    products_db = get_products_db()

    # Find shades matching user's input shade numbers
    user_shade_lab = (skin_tone_lab["L"], skin_tone_lab["a"], skin_tone_lab["b"])

    # Also match by specific shade numbers the user entered
    matched_by_number = []
    for sn in shade_numbers:
        for s in shades_db:
            if s["shade_number"].lower() == sn.lower():
                entry = dict(s)
                for p in products_db:
                    if p["id"] == s["product_id"]:
                        entry.update({"brand": p["brand"], "product_name": p["product_name"], "product_type": p["product_type"], "price": p["price"]})
                        break
                matched_by_number.append(entry)

    # Color proximity matches
    color_matches = shade_match(user_shade_lab, shades_db, product_type_filter)
    for m in color_matches:
        for p in products_db:
            if p["id"] == m.get("product_id", 0):
                m["brand"] = p["brand"]
                m["product_name"] = p["product_name"]
                m["product_type"] = p["product_type"]
                m["price"] = p["price"]
                break

    return {
        "matched_by_number": matched_by_number,
        "color_matches": color_matches,
    }


@router.post("/generate-looks")
def generate_looks(body: dict):
    """Generate makeup looks using mock data."""
    skin_tone_lab = body.get("skin_tone_lab", {"L": 65.2, "a": 12.3, "b": 18.5})
    available_shade_ids = body.get("available_shade_ids", [4, 14, 18])
    style = body.get("style", "natural")
    occasion = body.get("occasion", "daily")
    language = body.get("language", "zh")

    shades_db = get_shades_db()
    products_db = get_products_db()

    result = generate_makeup_looks(
        skin_tone_lab=skin_tone_lab,
        available_shade_ids=available_shade_ids,
        shade_database=shades_db,
        style=style,
        occasion=occasion,
        language=language,
    )

    # Enrich shade references with product info
    for look in result.get("looks", []):
        enriched_steps = []
        for step in look.get("steps", []):
            step_entry = dict(step)
            for s in shades_db:
                if s["shade_number"] == step.get("shade_number"):
                    step_entry["hex_color"] = s["hex_color"]
                    step_entry["shade_name"] = s["shade_name"]
                    for p in products_db:
                        if p["id"] == s["product_id"]:
                            step_entry["brand"] = p["brand"]
                            step_entry["product_name"] = p["product_name"]
                            break
                    break
            enriched_steps.append(step_entry)
        look["steps"] = enriched_steps

    return result


@router.post("/render-overlay-data")
def render_overlay_data(body: dict):
    """Map region_colors to face mesh landmark indices for client rendering."""

    REGION_LANDMARK_MAP = {
        "forehead": [10, 151, 108, 109, 337, 338, 67, 69, 104, 297, 299, 333],
        "nose": [1, 2, 3, 4, 5, 6, 19, 20, 94, 141, 168],
        "left_cheek": [116, 117, 118, 119, 120, 121, 122, 123, 187, 205, 206, 207],
        "right_cheek": [345, 346, 347, 348, 349, 350, 351, 352, 411, 425, 426, 427],
        "upper_lid": [159, 160, 161, 162, 31, 223, 224, 225, 113, 386, 387, 388, 389, 263, 443, 444, 445, 342],
        "lower_lid": [144, 145, 146, 147, 111, 24, 23, 22, 26, 373, 374, 375, 376, 340, 254, 253, 252, 256],
        "crease": [70, 63, 105, 66, 107, 55, 65, 52, 53, 56, 300, 293, 334, 296, 336, 285, 295, 282, 283, 286],
        "lips_upper": [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291],
        "lips_lower": [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308],
        "chin": [152, 377, 148, 376, 379, 373, 374, 150],
        "cheekbone": [116, 117, 345, 346, 347, 411],
    }

    REGION_OPACITY = {
        "forehead": 0.3, "nose": 0.3, "left_cheek": 0.4, "right_cheek": 0.4,
        "upper_lid": 0.6, "lower_lid": 0.5, "crease": 0.6,
        "lips_upper": 0.85, "lips_lower": 0.85,
        "chin": 0.3, "cheekbone": 0.4,
    }

    region_colors = body.get("region_colors", {})
    overlay_map = {}

    for region, color_hex in region_colors.items():
        region_key = region.lower().replace(" ", "_")
        if region_key in REGION_LANDMARK_MAP:
            overlay_map[region_key] = {
                "landmarks": REGION_LANDMARK_MAP[region_key],
                "color": color_hex,
                "opacity": REGION_OPACITY.get(region_key, 0.5),
            }

    return {"overlay_map": overlay_map}
