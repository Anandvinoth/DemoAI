# services/solr_service.py
import httpx
import time
from typing import Dict, Any, List
import re

SOLR_BASE = "https://localhost:8983/solr"
VERIFY_SSL = False
SOLR_AUTH = ("solr", "SolrRocks")

# -----------------------------
# In-memory product cache (Phase B.1)
# -----------------------------
CACHE_TTL_SECONDS = 600  # 10 minutes
_PRODUCT_CACHE: Dict[str, Dict[str, Any]] = {}        # pid -> product doc
_PRODUCT_CACHE_TS: Dict[str, float] = {}              # pid -> last fetch epoch

def _now() -> float:
    return time.time()

# --- PRODUCTS: search with facets, sorting, pagination ---
from typing import List, Dict, Optional
import httpx

# --- PRODUCTS: search with facets, sorting, pagination ---
async def search_products_with_facets(
    query_text: Optional[str] = None,
    filters: Optional[Dict[str, str]] = None,
    page: int = 1,
    pageSize: int = 20,
    sort: Optional[str] = None,
    facet_fields: Optional[List[str]] = None,
    fq_extra: Optional[str] = None,   # ✅ NEW
) -> Dict:
    """
    Query Solr 'products' collection with:
      - edismax query over name/brand/material/color/category/description
      - filter queries (brand/material/color/category/price range)
      - facets (brand, material, color, category, price buckets)
      - pagination
      - sorting (price asc/desc, name asc/desc, brand asc)
      - fq_extra (search_text:"angle grinder" style exact phrase match)
    Returns { numFound, products, facets, page, pageSize, totalPages, hasPrev, hasNext }
    """
    facet_fields = facet_fields or ["brand", "material", "color", "category"]
    filters = filters or {}

    # Pagination guards
    if page < 1:
        page = 1
    if pageSize < 1:
        pageSize = 20
    if pageSize > 100:
        pageSize = 100
    start = (page - 1) * pageSize

    url = f"{SOLR_BASE}/products/select"

    # --- Build params ---
    params = {
        "wt": "json",
        "start": start,
        "rows": pageSize,
        "defType": "edismax",
        "qf": "name^5 brand^4 category^3 material^2 color^2 description^1 search_text^1",
        "facet": "true",
        "facet.mincount": 1,
        "q.op": "OR",
    }

    # --- Query text (default *:*) ---
    q = (query_text or "").strip()
    params["q"] = q if q else "*:*"

    # --- Filter queries ---
    fqs = []

    # ✅ Extra fq for phrase match using single copyField (search_text)
    if fq_extra and fq_extra.strip() != "*:*":
        phrase = fq_extra
        phrase = phrase.replace("name:", "").replace("search_text:", "")
        phrase = re.split(r"\s+OR\s+", phrase, flags=re.IGNORECASE)[0]
        phrase = phrase.replace('"', "").strip()
        if phrase:
            fqs.append(f'search_text:"{phrase}"')
            print(f'[DEBUG] Using fq_extra → search_text:"{phrase}"')

    # ✅ Multi-value facet filters (brand/material/color/category)
    for field in ["brand", "material", "color", "category"]:
        val = filters.get(field)
        if val:
            if isinstance(val, list):
                # Example: brand=["3M","Bosch","DeWalt"] → brand:("3M" OR "Bosch" OR "DeWalt")
                if len(val) == 1:
                    fqs.append(f'{field}:"{val[0]}"')
                else:
                    joined = " OR ".join([f'"{v}"' for v in val if v])
                    fqs.append(f'{field}:({joined})')
            elif isinstance(val, str) and val.strip():
                fqs.append(f'{field}:"{val.strip()}"')

    # ✅ Price range (e.g., [0 TO 500])
    price = filters.get("price")
    if price:
        rng = price.strip()
        if rng.startswith("[") and "TO" in rng:
            fqs.append(f"price:{rng}")
        elif "-" in rng:
            lo, hi = rng.split("-", 1)
            lo = lo.strip() or "0"
            hi = hi.strip() or "999999"
            fqs.append(f"price:[{lo} TO {hi}]")
        elif rng.startswith(">="):
            lo = rng[2:].strip()
            fqs.append(f"price:[{lo} TO 999999]")
        elif rng.startswith("<="):
            hi = rng[2:].strip()
            fqs.append(f"price:[0 TO {hi}]")

    if fqs:
        params["fq"] = fqs  # list supported by Solr

    # --- Facets ---
    for f in facet_fields:
        params.setdefault("facet.field", []).append(f)

    # --- Price facet buckets ---
    price_buckets = [
        "[0 TO 25]", "[25 TO 50]", "[50 TO 100]", "[100 TO 250]",
        "[250 TO 500]", "[500 TO 1000]", "[1000 TO 999999]"
    ]
    for bucket in price_buckets:
        params.setdefault("facet.query", []).append(f"price:{bucket}")

    # --- Sorting ---
    sort_map = {
        "price_asc": "price asc",
        "price_desc": "price desc",
        "name_asc": "name asc",
        "name_desc": "name desc",
        "brand_asc": "brand asc",
    }
    if sort and sort in sort_map:
        params["sort"] = sort_map[sort]

    # --- Optional debug log (optional; keep or comment) ---
    print(f"[SOLR] Query URL: {url}")
    print(f"[SOLR] Params: {params}")

    # --- HTTP call ---
    async with httpx.AsyncClient(verify=VERIFY_SSL) as client:
        resp = await client.get(url, params=params, auth=SOLR_AUTH)
        resp.raise_for_status()
        data = resp.json()

    # --- Parse response ---
    resp_obj = data.get("response", {})
    docs = [normalize_solr_doc(d) for d in resp_obj.get("docs", [])]
    num_found = resp_obj.get("numFound", len(docs))

    # --- Facet parsing ---
    facets = {}
    ff = data.get("facet_counts", {}).get("facet_fields", {})
    for field, arr in (ff or {}).items():
        facets[field] = [{"name": arr[i], "count": arr[i + 1]} for i in range(0, len(arr), 2)]

    fq_counts = data.get("facet_counts", {}).get("facet_queries", {})
    if fq_counts:
        price_counts = []
        for bucket in price_buckets:
            key = f"price:{bucket}"
            if key in fq_counts:
                price_counts.append({"range": bucket, "count": fq_counts[key]})
        facets["price"] = price_counts

    totalPages = (num_found + pageSize - 1) // pageSize

    return {
        "numFound": num_found,
        "products": docs,
        "facets": facets,
        "page": page,
        "pageSize": pageSize,
        "totalPages": totalPages,
        "hasPrev": page > 1,
        "hasNext": page < totalPages,
    }




def _is_fresh(pid: str) -> bool:
    ts = _PRODUCT_CACHE_TS.get(pid)
    return ts is not None and (_now() - ts) < CACHE_TTL_SECONDS


def _prune_cache() -> None:
    """Remove expired entries to keep memory tidy."""
    if not _PRODUCT_CACHE_TS:
        return
    now = _now()
    expired = [pid for pid, ts in _PRODUCT_CACHE_TS.items() if (now - ts) >= CACHE_TTL_SECONDS]
    for pid in expired:
        _PRODUCT_CACHE.pop(pid, None)
        _PRODUCT_CACHE_TS.pop(pid, None)


def _cache_set_many(docs: List[dict]) -> None:
    now = _now()
    for d in docs:
        pid = str(d.get("id"))
        if not pid:
            continue
        _PRODUCT_CACHE[pid] = d
        _PRODUCT_CACHE_TS[pid] = now


def _cache_get_many(pids: List[str]) -> Dict[str, dict]:
    out: Dict[str, dict] = {}
    for pid in pids:
        if _is_fresh(pid) and pid in _PRODUCT_CACHE:
            out[pid] = _PRODUCT_CACHE[pid]
    return out


# -----------------------------
# Shared helpers
# -----------------------------
async def fetch_solr_docs(collection: str, query: str):
    """Fetch plain Solr documents (no facets)."""
    url = f"{SOLR_BASE}/{collection}/select"
    params = {"q": query, "rows": 100, "wt": "json"}
    async with httpx.AsyncClient(verify=False) as client:
        resp = await client.get(url, params=params, auth=SOLR_AUTH)
        resp.raise_for_status()
        data = resp.json()
        docs = data.get("response", {}).get("docs", [])
        return [normalize_solr_doc(d) for d in docs]


def normalize_solr_doc(doc: dict) -> dict:
    """Flatten single-item lists for readability."""
    clean_doc = {}
    for key, val in doc.items():
        if isinstance(val, list) and len(val) == 1:
            clean_doc[key] = val[0]
        else:
            clean_doc[key] = val
    return clean_doc


async def fetch_solr_with_facets(
    collection: str,
    query: str,
    page: int = 1,
    pageSize: int = 20,
    facet_fields: List[str] = None
):
    """
    Fetch Solr docs and facet counts in one call with pagination support.
    - page: 1-based index
    - pageSize: number of rows per page
    - facets returned only for page 1 (performance optimization)
    """
    facet_fields = facet_fields or [
        "account_id",
        "status",
        "payment_status",
        "warehouse_status",
        "currency"
    ]

    # Pagination
    if page < 1:
        page = 1
    if pageSize < 1:
        pageSize = 20
    if pageSize > 100:
        pageSize = 100

    start = (page - 1) * pageSize

    url = f"{SOLR_BASE}/{collection}/select"
    is_super_query = query.strip() == "*:*"

    params = {
        "q": query,
        "start": start,
        "rows": pageSize,
        "wt": "json",
        # Facets only for page 1
        "facet": "true" if page == 1 else "false",
        "facet.mincount": 1
    }

    if page == 1:
        # Add facet fields only for first request
        for f in facet_fields:
            params.setdefault("facet.field", []).append(f)

    async with httpx.AsyncClient(verify=VERIFY_SSL) as client:
        resp = await client.get(url, params=params, auth=SOLR_AUTH)
        resp.raise_for_status()
        data = resp.json()

    response = data.get("response", {})
    docs = response.get("docs", [])
    num_found = response.get("numFound", len(docs))

    # Facets only on page 1
    facets = {}
    if page == 1:
        raw_facets = data.get("facet_counts", {}).get("facet_fields", {})
        facets = {
            k: [{"name": arr[i], "count": arr[i + 1]}
                for i in range(0, len(arr), 2)]
            for k, arr in raw_facets.items()
        }

    # Normalize docs
    orders = [normalize_solr_doc(d) for d in docs]

    return {
        "numFound": num_found,
        "orders": orders,
        "facets": facets
    }


    # -----------------------------------------------------------
# ✅ PHASE A+B.1: Bulk product fetch with in-memory TTL cache
# -----------------------------------------------------------
async def fetch_products_bulk(product_ids: List[str]) -> Dict[str, dict]:
    """
    Fetch product details for all product_ids with:
      - In-memory cache (10 min TTL)
      - One (or few) Solr queries for cache misses
    Returns a dict: { product_id: productDoc }
    """
    print("=== fetch_products_bulk CALLED ===")
    print("input product_ids:", product_ids)

    if not product_ids:
        print("No product_ids provided")
        return {}

    uniq_ids = list({str(pid).strip() for pid in product_ids if pid})
    print("Normalized uniq_ids:", uniq_ids)

    # (Temporarily clear cache for debugging)
    _PRODUCT_CACHE.clear()
    _PRODUCT_CACHE_TS.clear()
    print("⚠️ Cache Cleared")

    fetched_map: Dict[str, dict] = {}

    CHUNK_SIZE = 50  # keep small for debug
    async with httpx.AsyncClient(verify=False, timeout=10.0) as client:
        for i in range(0, len(uniq_ids), CHUNK_SIZE):
            chunk = uniq_ids[i:i + CHUNK_SIZE]

            fq = "id:(" + " ".join(chunk) + ")"  # space = OR in Solr FQ
            print("Solr Built FQ:", fq)

            url = f"{SOLR_BASE}/products/select"
            params = {
                "q": "*:*",
                "fq": fq,
                "rows": len(chunk),
                "wt": "json"
            }

            resp = await client.get(url, params=params, auth=SOLR_AUTH, headers={"Content-Type": "application/json"})
            print("Solr Status:", resp.status_code)
            data = resp.json()
            print("Solr RAW Response:", data)

            docs = data.get("response", {}).get("docs", [])
            print("Solr returned docs:", docs)

            docs = [normalize_solr_doc(d) for d in docs]
            print("Normalized docs:", docs)

            for d in docs:
                pid = str(d.get("id")).strip()
                fetched_map[pid] = d

            _cache_set_many(docs)

    print("Final fetched_map:", fetched_map)
    return fetched_map
