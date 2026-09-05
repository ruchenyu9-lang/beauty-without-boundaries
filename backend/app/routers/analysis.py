"""Feature 2: Makeup Image Analysis + Affordable Substitute Matching."""

from fastapi import APIRouter

from app.services.image_analyzer import analyze_makeup_image, find_affordable_substitutes
from app.main import get_products_db, get_shades_db

router = APIRouter()


@router.post("/analyze-image")
def analyze_image(body: dict):
    """Analyze a makeup reference image (mock: returns pre-generated analysis)."""
    language = body.get("language", "zh")
    return analyze_makeup_image("", language)


@router.post("/find-substitutes")
def find_substitutes(body: dict):
    """Find affordable substitute products by deltaE2000 color matching."""
    detected_products = body.get("detected_products", [])
    max_price = body.get("max_price", 200.0)
    prefer_loreal = body.get("prefer_loreal", True)

    shades_db = get_shades_db()
    products_db = get_products_db()

    result = find_affordable_substitutes(
        detected_products=detected_products,
        shade_database=shades_db,
        product_database=products_db,
        max_price=max_price,
        prefer_loreal=prefer_loreal,
    )
    return {"substitutes": result}


@router.post("/generate-instructions")
def generate_instructions(body: dict):
    """Generate step-by-step makeup instructions (mock)."""
    # Return the mock analysis result which already includes step_instructions
    language = body.get("language", "zh")
    result = analyze_makeup_image("", language)
    return {"steps": result["step_instructions"]}
