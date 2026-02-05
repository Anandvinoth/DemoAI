# services/product_solr_service.py
import httpx
from attribute_loader import load_facet_values
from typing import Dict, Any, Optional, List
import re

SOLR_BASE = "https://localhost:8983/solr"
SOLR_AUTH = ("solr", "SolrRocks")
VERIFY_SSL = False

# Facet fields for products
PRODUCT_FACETS = ["brand", "material", "color", "category"]
FACET_CACHE = load_facet_values() or {}


def normalize_facet_value(field: str, value: str, facet_cache: dict) -> str:
    """
    Normalize UI / voice values like:
      PowerTools → Power Tools
      powertools → Power Tools
    using Solr facet cache as source of truth
    """
    if not value or field not in facet_cache:
        return value

    v_norm = value.lower().replace(" ", "")

    for candidate in facet_cache.get(field, []):
        if candidate.lower().replace(" ", "") == v_norm:
            return candidate  # canonical Solr value

    return value

def normalize_price(val: str) -> Optional[str]:
    v = str(val).lower()

    if re.search(r"(less than|under)\s+(\d+)", v):
        num = re.findall(r"\d+", v)[0]
        return f"[0 TO {num}]"

    if re.search(r"(greater than|above)\s+(\d+)", v):
        num = re.findall(r"\d+", v)[0]
        return f"[{num} TO 999999]"

    if "between" in v:
        nums = re.findall(r"\d+", v)
        if len(nums) == 2:
            return f"[{nums[0]} TO {nums[1]}]"

    if re.match(r"\[\d+\s+TO\s+\d+\]", v.upper()):
        return v.upper()

    return None


async def search_products_fuzzy(
    query_text: str,
    filters: Optional[Dict[str, Any]] = None,
    page: int = 1,
    pageSize: int = 20,
    sort: Optional[str] = None,
):
    """
    Product-only Solr search.
    Uses fuzzy matching: fq=search_text:"VALUE"
    Does NOT affect order UIs.
    """

    filters = filters or {}

    url = f"{SOLR_BASE}/products/select"

    start = (page - 1) * pageSize

    params = {
        "wt": "json",
        "start": start,
        "rows": pageSize,
        "defType": "edismax",
        "qf": "name^5 brand^4 category^3 material^2 color^2 description^1 search_text^1",
        "facet": "true",
        "facet.mincount": 1,
        "q.op": "OR",
        "q": query_text if query_text.strip() else "*:*"
    }

    # -----------------------------
    # 🔥 Build fuzzy filter queries
    # -----------------------------
    fqs = []

    fuzzy_fields = ["brand", "material", "color", "category"]

    for key, val in filters.items():

        # Angular always sends arrays → collapse
        if isinstance(val, list) and len(val) > 0:
            val = val[0]

        if not val:
            continue

        # 🔥 fuzzy matching using search_text copyField
        # if key in fuzzy_fields:
        #     term = str(val).strip()
        #     fqs.append(f'search_text:"{term}"')
        #     # print(f"[PRODUCT-FUZZY] fq=search_text:\"{term}\"")
        #     print(f"***** [{__name__}] fq=search_text:\"{term}\"")
        #
        #     continue

        if key in PRODUCT_FACETS:
            # canonical = normalize_facet_value(key, val, FACET_CACHE)
            # fqs.append(f'{key}:"{canonical}"')
            vals = val if isinstance(val, list) else [val]
            canonicals = [
                normalize_facet_value(key, v, FACET_CACHE)
                for v in vals if v
            ]

            if canonicals:
                fq = " OR ".join(f'{key}:"{c}"' for c in canonicals)
                fqs.append(f"({fq})")
            print(f"[PRODUCT-FACET] fq=({fq})")
            continue

        # Price filter remains structured
        if key == "price":
            # fqs.append(f"price:{val}")
            rng = normalize_price(val)
            if rng:
                fqs.append(f"price:{rng}")
            continue

        # Fallback literal filter
        fqs.append(f'{key}:"{val}"')

    if fqs:
        params["fq"] = fqs

    # Add facet fields
    for f in PRODUCT_FACETS:
        params.setdefault("facet.field", []).append(f)

    # Price buckets
    price_ranges = [
        "[0 TO 25]", "[25 TO 50]", "[50 TO 100]",
        "[100 TO 250]", "[250 TO 500]", "[500 TO 1000]",
        "[1000 TO 999999]"
    ]
    for r in price_ranges:
        params.setdefault("facet.query", []).append(f"price:{r}")

    # print("[SOLR-FUZZY] URL:", url)
    # print("[SOLR-FUZZY] Params:", params)
    print(f"[{__name__.upper().replace('_', '-')}] URL:", url)
    print(f"[{__name__.upper().replace('_', '-')}] Params:", params)

    async with httpx.AsyncClient(verify=VERIFY_SSL) as client:
        resp = await client.get(url, params=params, auth=SOLR_AUTH)
        resp.raise_for_status()
        data = resp.json()

    docs = data.get("response", {}).get("docs", [])
    num_found = data.get("response", {}).get("numFound", len(docs))

    # Facets
    raw_facets = data.get("facet_counts", {}).get("facet_fields", {})
    facets = {
        f: [{"name": raw_facets[f][i], "count": raw_facets[f][i+1]} for i in range(0, len(raw_facets[f]), 2)]
        for f in raw_facets
    }

    return {
        "numFound": num_found,
        "products": docs,
        "facets": facets,
        "page": page,
        "pageSize": pageSize,
        "totalPages": (num_found + pageSize - 1) // pageSize
    }
