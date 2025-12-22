# routes/products.py
from fastapi import APIRouter, Query, HTTPException
from typing import Optional, Dict
from services.product_service import search_products_structured, search_products_natural

router = APIRouter(prefix="/products", tags=["Products"])

# 1) Structured search (UI / programmatic)
@router.get("/search")
async def products_search(
    q: Optional[str] = Query(None, description="Free-text search"),
    brand: Optional[str] = Query(None),
    material: Optional[str] = Query(None),
    color: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    price: Optional[str] = Query(None, description="e.g., [0 TO 500] or 0-500 or >=100"),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    sort: Optional[str] = Query(None, description="price_asc|price_desc|name_asc|name_desc|brand_asc"),
):
    filters: Dict[str, str] = {}
    if brand: filters["brand"] = brand
    if material: filters["material"] = material
    if color: filters["color"] = color
    if category: filters["category"] = category
    if price: filters["price"] = price

    try:
        result = await search_products_structured(q, filters, page, pageSize, sort)
        if result.get("numFound", 0) == 0:
            raise HTTPException(status_code=404, detail="No products found")
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 2) Voice/NL search (safe, no account prompts)
@router.post("/query")
async def products_query(payload: dict):
    """
    Body: { "query": "natural language sentence", "page": 1, "pageSize": 20, "sort": "price_asc" }
    """
    text = (payload or {}).get("query", "") or ""
    page = int((payload or {}).get("page", 1))
    pageSize = int((payload or {}).get("pageSize", 20))
    sort = (payload or {}).get("sort")

    if not text.strip():
        raise HTTPException(status_code=400, detail="query is required")

    try:
        result = await search_products_natural(text, page=page, pageSize=pageSize, sort=sort)
        if result.get("numFound", 0) == 0:
            raise HTTPException(status_code=404, detail="No products found")
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
