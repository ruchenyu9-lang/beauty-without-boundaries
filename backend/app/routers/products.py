"""Product catalog endpoints."""

from fastapi import APIRouter

from app.main import get_products_db, get_shades_db

router = APIRouter()


@router.get("/types")
def list_product_types():
    products = get_products_db()
    types = sorted(set(p["product_type"] for p in products))
    return {"types": types}


@router.get("/brands")
def list_brands():
    products = get_products_db()
    brands = sorted(set(p["brand"] for p in products))
    return {"brands": brands}


@router.get("/")
def list_products(product_type: str | None = None):
    products = get_products_db()
    if product_type:
        products = [p for p in products if p["product_type"] == product_type]
    return {"products": products, "total": len(products)}


@router.get("/shades")
def list_shades(product_id: int | None = None, product_type: str | None = None):
    shades = get_shades_db()
    products = get_products_db()
    if product_id:
        shades = [s for s in shades if s["product_id"] == product_id]
    if product_type:
        matching_ids = {p["id"] for p in products if p["product_type"] == product_type}
        shades = [s for s in shades if s["product_id"] in matching_ids]
    # Enrich with product info
    result = []
    for s in shades:
        entry = dict(s)
        for p in products:
            if p["id"] == s["product_id"]:
                entry["brand"] = p["brand"]
                entry["product_name"] = p["product_name"]
                entry["product_type"] = p["product_type"]
                entry["price"] = p["price"]
                entry["is_loreal"] = p["is_loreal"]
                break
        result.append(entry)
    return {"shades": result, "total": len(result)}


@router.get("/search-shade")
def search_shade(q: str = "", limit: int = 10):
    """Search shades by shade number or name (autocomplete)."""
    shades = get_shades_db()
    products = get_products_db()
    q_lower = q.lower()
    matches = []
    for s in shades:
        if q_lower in s["shade_number"].lower() or q_lower in s["shade_name"].lower():
            entry = dict(s)
            for p in products:
                if p["id"] == s["product_id"]:
                    entry["brand"] = p["brand"]
                    entry["product_name"] = p["product_name"]
                    entry["product_type"] = p["product_type"]
                    entry["price"] = p["price"]
                    break
            matches.append(entry)
    return {"matches": matches[:limit]}
