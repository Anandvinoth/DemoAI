# routes/product_voice.py
from fastapi import APIRouter, HTTPException
from typing import Dict, Any
from services.product_service import search_products_natural
from services.product_filter_parser import normalize_filters_from_frontend
from nlu_engine import NLU
import re

router = APIRouter(prefix="/products", tags=["Products (Voice)"])
_nlu = NLU()


def _entities_to_strings(entities: dict) -> list:
    """Flatten entity dict for Angular telemetry."""
    result = []
    for k, v in entities.items():
        if v is None or k.startswith("account"):
            continue
        result.append(f"{k}:{v}")
    if not result:
        result.append("raw_query")
    return result

def flatten_filters(filters: Dict[str, Any]) -> Dict[str, str]:
    flat = {}
    for k, v in filters.items():
        if isinstance(v, list):
            if len(v) > 0:
                flat[k] = v[0]
        else:
            flat[k] = v
    return flat

def normalize_price_filter(val: str) -> str | None:
    v = val.lower()

    if re.search(r"(less than|under|below)\s+(\d+)", v):
        num = re.findall(r"\d+", v)[0]
        return f"[0 TO {num}]"

    if re.search(r"(greater than|above|over)\s+(\d+)", v):
        num = re.findall(r"\d+", v)[0]
        return f"[{num} TO 999999]"

    if "between" in v:
        nums = re.findall(r"\d+", v)
        if len(nums) == 2:
            return f"[{nums[0]} TO {nums[1]}]"

    # already structured
    if re.match(r"\[\d+\s+TO\s+\d+\]", v.upper()):
        return v.upper()

    return None

@router.post("/query")
async def products_query(payload: dict):
    """
    Product voice/natural query handler with robust price & browse intent handling.
    """
    text: str = (payload or {}).get("query", "") or ""
    if not text.strip():
        raise HTTPException(status_code=400, detail="query is required")

    filters_from_frontend: Dict[str, Any] = (payload or {}).get("filters", {}) or {}
    page = int((payload or {}).get("page", 1))
    pageSize = int((payload or {}).get("pageSize", 20))
    sort = (payload or {}).get("sort")

    try:
        # 1️⃣ Run NLU preprocessing + intent model
        normalized = _nlu.normalize_text(text)
        intent, conf = _nlu.classify_intent(normalized)
        entities = _nlu.extract_entities(normalized)
        lower_text = text.lower().strip()

        print(f"[INTENT MODEL] → {intent} ({conf:.2f})  Entities: {entities}")

        solr_query = "*:*"
        facet_filters: Dict[str, Any] = {}

        # 2 Explicit frontend filters from Angular / Swagger
        if filters_from_frontend:
            print(f"[DEBUG - {__name__}] Using explicit frontend filters → {filters_from_frontend}")

            clean_filters: Dict[str, Any] = {}

            for key, val in filters_from_frontend.items():
                if isinstance(val, list) and val:
                    val = val[0]

                # 🔥 CRITICAL FIX: price must stay structured
                if key == "price":
                    price_range = normalize_price_filter(val)
                    if price_range:
                        clean_filters["price"] = price_range
                    continue

                # normal facets go through existing normalizer
                clean_filters[key] = val

            # 🔒 Preserve price before normalization
            price_filter = clean_filters.pop("price", None)

            # normalize non-price facets only
            clean_filters = normalize_filters_from_frontend(clean_filters)

            # restore price safely
            if price_filter:
                clean_filters["price"] = price_filter

            print(f"[DEBUG - {__name__}] Normalized frontend filters → {clean_filters}")

            solr_query = text if text.strip() else "*:*"

            result = await search_products_natural(
                query_text=solr_query,
                page=page,
                pageSize=pageSize,
                sort=sort,
                filters=clean_filters,
            )

            if result.get("numFound", 0) == 0:
                raise HTTPException(status_code=404, detail="No products found")

            return {
                "input": text,
                "normalized": normalized,
                "intent": "facet_filter",
                "confidence": conf,
                "entities": [f"{k}:{v}" for k, v in clean_filters.items()],
                "solr_query": solr_query,
                "numFound": result.get("numFound"),
                "products": result.get("products"),
                "facets": result.get("facets"),
                "page": result.get("page"),
                "pageSize": result.get("pageSize"),
                "totalPages": result.get("totalPages"),
            }

        # 3️⃣ Handle “browse all products” / “back to products”
        if re.search(r"\b(all\s+products?|show\s+products?|list\s+products?|back\s+to\s+products?|go\s+back\s+to\s+products?)\b", lower_text):
            intent = "browse_all"
            solr_query = "*:*"
            print("[INTENT] → browse_all")

        # 4️⃣ 🔹 Force override for any price-related phrase
        #     This ensures "show products under 50" doesn't fall into browse_all
        if re.search(r"\b(under|below|less\s+than|above|greater\s+than|between)\b", lower_text):
            number_match = re.findall(r"\d+", lower_text)
            if re.search(r"\bunder|below|less\s+than\b", lower_text):
                num = number_match[0] if number_match else "0"
                facet_filters["price"] = f"[0 TO {num}]"
                intent = "search_by_price_max"
                print(f"[INTENT] → override: price below {facet_filters}")
            elif re.search(r"\babove|greater\s+than|over\b", lower_text):
                num = number_match[0] if number_match else "0"
                facet_filters["price"] = f"[{num} TO 999999]"
                intent = "search_by_price_min"
                print(f"[INTENT] → override: price above {facet_filters}")
            elif re.search(r"\bbetween\s+(\d+)\s+(?:and|to)\s+(\d+)", lower_text):
                lo, hi = re.findall(r"\d+", lower_text)[:2]
                facet_filters["price"] = f"[{lo} TO {hi}]"
                intent = "search_by_price_between"
                print(f"[INTENT] → override: price between {facet_filters}")
            solr_query = "*:*"

        # 5️⃣ Model-driven or entity-based filters
        elif intent.startswith("search_by_"):
            field = intent.replace("search_by_", "")
            if field in entities:
                facet_filters[field] = entities[field]
            solr_query = "*:*"
            print(f"[INTENT] → {intent} facet_filters={facet_filters}")

        elif any(k in entities for k in ["brand", "material", "color", "category", "price"]):
            for k in ["brand", "material", "color", "category", "price"]:
                if k in entities:
                    facet_filters[k] = entities[k]
            intent = "facet_filter"
            solr_query = "*:*"
            print(f"[INTENT] → facet_filter {facet_filters}")

        # 6️⃣ Fallback text search
        elif intent not in ("browse_all", "search_by_all_products"):
            clean_text = text.strip().replace('"', '')
#            solr_query = f'search_text:"{clean_text}"'
#            intent = "text_search"
            # ⭐ If the NLU extracted "*:*" => treat as full browse
            if entities.get("search_text") == "*:*" or clean_text in ["*:*", "all products"]:
                solr_query = "*:*"
                intent = "browse_all"
            else:
                solr_query = f'search_text:"{clean_text}"'
                intent = "text_search"
            print(f"[INTENT] → text_search {solr_query}")

        # 7️⃣ Execute Solr query
        facet_filters = flatten_filters(facet_filters)
        
        result = await search_products_natural(
            query_text=solr_query,
            page=page,
            pageSize=pageSize,
            sort=sort,
            filters=facet_filters,
        )

        if result.get("numFound", 0) == 0:
            raise HTTPException(status_code=404, detail="No products found")

        return {
            "input": text,
            "normalized": normalized,
            "intent": intent,
            "confidence": conf,
            "entities": [f"{k}:{v}" for k, v in {**facet_filters, **entities}.items()],
            "solr_query": solr_query,
            "numFound": result.get("numFound"),
            "products": result.get("products"),
            "facets": result.get("facets"),
            "page": result.get("page"),
            "pageSize": result.get("pageSize"),
            "totalPages": result.get("totalPages"),
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
