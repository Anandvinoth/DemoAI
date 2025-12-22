# services/product_service.py
from typing import Dict, Optional
#from services.solr_service import search_products_with_facets
from services.product_solr_service import search_products_fuzzy
from nlu_engine import NLU
import re

_nlu = NLU()  # reuse shared model instance

# -------------------------------------------------------------
# Helper: map extracted NLU entities → Solr filters
# -------------------------------------------------------------
def _entities_to_filters(entities: Dict) -> Dict:
    """
    Map NLU entities to Solr filter fields for products.
    Ignores order/account-related ones.
    """
    filters: Dict[str, str] = {}
    for k in ("brand", "material", "color", "category", "price"):
        v = entities.get(k)
        if v:
            filters[k] = str(v)
    return filters


# -------------------------------------------------------------
# Structured query entrypoint (used internally)
# -------------------------------------------------------------
async def search_products_structured(
    q: Optional[str],
    filters: Optional[Dict[str, str]],
    page: int,
    pageSize: int,
    sort: Optional[str],
) -> Dict:
    return await search_products_with_facets(
        query_text=q,
        filters=filters or {},
        page=page,
        pageSize=pageSize,
        sort=sort,
    )


# -------------------------------------------------------------
# Voice / Natural-Language entrypoint
# -------------------------------------------------------------
async def search_products_natural(
    query_text: str,
    page: int = 1,
    pageSize: int = 20,
    sort: Optional[str] = None,
    filters: Optional[Dict[str, str]] = None,
) -> Dict:
    """
    Voice/NL entrypoint for products.
    Supports:
      - query_text: direct Solr query string (e.g., search_text:"angle grinder")
      - filters: facet filters like brand/material/color/category/price
    """
    filters = filters or {}

    # If query_text is blank, default to *:*
    q = query_text.strip() if query_text else "*:*"

    # Voice-based sort detection
    low = q.lower()
    if "sort by price" in low and ("asc" in low or "low to high" in low):
        sort = "price_asc"
    elif "sort by price" in low and ("desc" in low or "high to low" in low):
        sort = "price_desc"
    elif "sort by name" in low and "asc" in low:
        sort = "name_asc"
    elif "sort by name" in low and "desc" in low:
        sort = "name_desc"

    return await search_products_fuzzy(
        query_text=q,
        filters=filters,
        page=page,
        pageSize=pageSize,
        sort=sort,
    )


    return result
