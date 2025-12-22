#services/product_detail_service.py

import httpx

SOLR_BASE = "https://localhost:8983/solr/products/select"
SOLR_AUTH = ("solr", "SolrRocks")

async def fetch_product_by_id(product_id: str):
    """
    Fetch a single product from Solr by exact ID.
    No fuzzy logic, no facets, no filters.
    """
    params = {
        "q": f'id:"{product_id}"',
        "rows": 1,
        "wt": "json"
    }

    async with httpx.AsyncClient(verify=False) as client:
        resp = await client.get(SOLR_BASE, params=params, auth=SOLR_AUTH)
        resp.raise_for_status()
        data = resp.json()

    docs = data.get("response", {}).get("docs", [])
    return docs[0] if docs else None
