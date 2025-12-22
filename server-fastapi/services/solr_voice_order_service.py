# services/solr_voice_order_service.py
import httpx
from typing import List, Dict, Optional
from services.solr_service import SOLR_BASE, SOLR_AUTH, VERIFY_SSL

def normalize_solr_doc(doc: dict) -> dict:
    """
    Normalize Solr doc into a consistent flat dict.
    - Flattens single-value arrays.
    - Ensures all values are JSON-safe.
    """
    normalized = {}
    for k, v in doc.items():
        if isinstance(v, list) and len(v) == 1:
            normalized[k] = v[0]
        else:
            normalized[k] = v
    return normalized


async def fetch_solr_orders_voice(
    query: str = "*:*",
    page: int = 1,
    pageSize: int = 20,
    filters: Optional[Dict[str, List[str]]] = None,
    facet_fields: Optional[List[str]] = None
) -> Dict:
    """
    Dedicated to voice-driven order search and filtering.
    Safe and independent from existing solr_service.py functions.
    """

    facet_fields = facet_fields or [
        "account_id", "status", "payment_status", "warehouse_status", "currency"
    ]

    if page < 1:
        page = 1
    if pageSize < 1:
        pageSize = 20
    if pageSize > 100:
        pageSize = 100

    start = (page - 1) * pageSize
    url = f"{SOLR_BASE}/orderHistory/select"

    params = {
        "q": query,
        "start": start,
        "rows": pageSize,
        "wt": "json",
        "facet": "true" if page == 1 else "false",
        "facet.mincount": 1
    }

    if page == 1:
        for f in facet_fields:
            params.setdefault("facet.field", []).append(f)

    # ✅ Only this method supports dynamic fq filters
    if filters:
        fq_list = []
        for k, vlist in filters.items():
            if not vlist:
                continue
            parts = []
            for val in vlist:
                sval = str(val).strip()
                # ✅ If value has a space, wrap it in quotes
                if " " in sval:
                    parts.append(f'"{sval}"')
                else:
                    parts.append(sval)
            fq_list.append(f"{k}:({ ' OR '.join(parts) })")
        if fq_list:
            params["fq"] = fq_list

            
    # 🔍 Debug log (matches product query format)
    print("\n[SOLR] Query URL:", url)
    print("[SOLR] Params:", params, "\n")

    async with httpx.AsyncClient(verify=VERIFY_SSL) as client:
        resp = await client.get(url, params=params, auth=SOLR_AUTH)
        resp.raise_for_status()
        data = resp.json()

    response = data.get("response", {})
    docs = response.get("docs", [])
    num_found = response.get("numFound", len(docs))

    facets = {}
    if page == 1:
        raw_facets = data.get("facet_counts", {}).get("facet_fields", {})
        facets = {
            k: [
                {"name": arr[i], "count": arr[i + 1]}
                for i in range(0, len(arr), 2)
            ]
            for k, arr in raw_facets.items()
        }

    orders = [normalize_solr_doc(d) for d in docs]
    
    total_pages = (num_found + pageSize - 1) // pageSize if pageSize > 0 else 1

    return {
        "numFound": num_found,
        "orders": orders,
        "facets": facets,
        "page": page,
        "pageSize": pageSize,
        "totalPages": total_pages 
    }
