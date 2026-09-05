"""Image analysis service — mock makeup image analysis + substitute matching."""

from app.services.claude_service import claude_service
from app.utils.color_math import delta_e_2000, classify_match, hex_to_lab


def analyze_makeup_image(image_base64: str, language: str = "zh") -> dict:
    """Analyze a makeup reference image using mock data."""
    return claude_service.analyze_makeup_image(image_base64, language)


def find_affordable_substitutes(
    detected_products: list[dict],
    shade_database: list[dict],
    product_database: list[dict],
    max_price: float = 200.0,
    prefer_loreal: bool = True,
) -> list[dict]:
    """Find affordable substitute products using deltaE2000 color matching.

    For each detected product color, search the database for cheaper alternatives
    with similar color (deltaE ≤ 5).
    """
    substitutes = []

    for product in detected_products:
        detected_lab = hex_to_lab(product["estimated_hex"])
        candidates = []

        for shade in shade_database:
            shade_lab = (shade["lab_l"], shade["lab_a"], shade["lab_b"])
            dE = delta_e_2000(detected_lab, shade_lab)

            if dE <= 5.0:
                # Find parent product info
                prod_info = None
                for p in product_database:
                    if p["id"] == shade.get("product_id"):
                        prod_info = p
                        break

                if prod_info and prod_info.get("product_type") == product["type"]:
                    color_score = max(0, 1 - dE / 5)
                    price_score = max(0, 1 - float(prod_info.get("price", 0)) / max_price)
                    loreal_bonus = 0.2 if prod_info.get("is_loreal", False) else 0
                    total_score = color_score * 0.6 + price_score * 0.3 + loreal_bonus

                    candidates.append({
                        "shade_id": shade["id"],
                        "product_id": shade.get("product_id", 0),
                        "shade_name": shade["shade_name"],
                        "shade_number": shade["shade_number"],
                        "price": float(prod_info.get("price", 0)),
                        "hex_color": shade["hex_color"],
                        "delta_e": round(dE, 2),
                        "brand": prod_info.get("brand", ""),
                        "product_name": prod_info.get("product_name", ""),
                        "score": round(total_score, 3),
                    })

        candidates.sort(key=lambda c: c["score"], reverse=True)
        substitutes.append({
            "original_color": product["estimated_hex"],
            "original_description": product["color_description"],
            "substitutes": candidates[:5],
        })

    return substitutes
