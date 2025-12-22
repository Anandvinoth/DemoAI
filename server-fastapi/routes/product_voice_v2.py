# routes/product_voice_v2.py
from fastapi import APIRouter, Body, HTTPException
from nlu_engine import NLU
from services.product_service import search_products_natural
import re

router = APIRouter(prefix="/products", tags=["Products (Voice)"])
_nlu = NLU()

@router.post("/voice")
async def product_voice(payload: dict = Body(...)):
    """
    Voice-driven product search.
    Uses Solr *:* for 'show/get/list all products' requests,
    otherwise falls back to search_text query.
    """
    text = (payload or {}).get("query", "").strip()
    page = int((payload or {}).get("page", 1))
    pageSize = int((payload or {}).get("pageSize", 20))

    if not text:
        raise HTTPException(status_code=400, detail="Query text required")

    # --- Run NLU ---
    result = _nlu.infer(text)
    intent = result["intent"]
    entities = result["entities"]
    print(f"[INTENT MODEL] → {intent}  Entities: {entities}")

    # --- Detect "show me all products" or similar ---
    lower = text.lower().strip()

    # Match phrases like:
    # "show all products", "show me all the products", "list all items", "get me products"
    browse_all_pattern = re.compile(
        r"\b("
        r"(show|list|display|get|give|find|browse)\s+(me\s+)?(all\s+)?(the\s+)?(products?|items?)"
        r"|go\s+to\s+products?"
        r"|back\s+to\s+products?"
        r"|products?"
        r")\b"
    )


    if browse_all_pattern.search(lower):
        q = "*:*"
        print(f"[INTENT] → browse_all → Solr q={q}")
    else:
        q = f'search_text:"{text}"'

    # --- Extract any facet filters from entities ---
    filters = {k: v for k, v in entities.items() if k in ("brand", "material", "color", "category", "price")}

    # --- Query Solr ---
    solr_result = await search_products_natural(
        query_text=q,
        page=page,
        pageSize=pageSize,
        filters=filters,
    )

    num_found = solr_result.get("numFound", 0)
    if num_found == 0:
        raise HTTPException(status_code=404, detail="No products found")

    # --- Speech feedback for voice UI ---
    speech = f"Showing {min(pageSize, num_found)} of {num_found} products"
    if filters:
        speech += " filtered by " + ", ".join(f"{k}={v}" for k, v in filters.items())
    speech += "."

    return {
        "input": text,
        "intent": intent,
        "entities": entities,
        "solr_query": q,
        **solr_result,
        "speech": speech
    }
