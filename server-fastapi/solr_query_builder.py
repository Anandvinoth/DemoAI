# solr_query_builder.py
import os
import requests
from query_handlers import (
    search_all, search_by_brand, search_by_category, search_by_color,
    search_by_price, search_by_material, fallback
)

SOLR_HOST = os.getenv("SOLR_HOST", "localhost")
SOLR_COLLECTION = os.getenv("SOLR_COLLECTION", "products")
SOLR_USER = os.getenv("SOLR_USER", "solr")
SOLR_PASS = os.getenv("SOLR_PASS", "SolrRocks")

# --- Facet fields to include ---
DEFAULT_FACET_FIELDS = ["brand", "category", "color", "material"]


INTENT_MAP = {
    "search_by_brand": search_by_brand.handle,
    "search_by_category": search_by_category.handle,
    "search_by_color": search_by_color.handle,
    "search_by_material": search_by_material.handle,
    "search_by_price_max": search_by_price.handle,
    "search_by_price_min": search_by_price.handle,
    "search_by_price_between": search_by_price.handle,
    "search_all": search_all.handle
}

def build_solr_query(text, intent, entities):
    handler = INTENT_MAP.get(intent, fallback.handle)
    params = handler(intent, entities, text)
    params["rows"] = 20
    params["wt"] = "json"
    params["df"] = "search_text"
    return params


#def search_solr(text, intent, entities, rows=20):
 #   params = build_solr_query(text, intent, entities)
  #  solr_url = f"https://{SOLR_HOST}:8983/solr/{SOLR_COLLECTION}/select"

   # session = requests.Session()
#    session.auth = (SOLR_USER, SOLR_PASS)
#    session.verify = False

#    print(f"[DEBUG] Executing Solr query: {params}")
#    resp = session.get(solr_url, params=params)
#    resp.raise_for_status()
#    data = resp.json()
#    return data.get("response", {}).get("docs", [])

def search_solr(text, intent, entities, rows=20, include_facets=True):
    params = build_solr_query(text, intent, entities)
    params["rows"] = rows
    params["wt"] = "json"
    params["df"] = "search_text"
    
    if include_facets:
        params["facet"] = "true"
        for f in DEFAULT_FACET_FIELDS:
            params.setdefault("facet.field", []).append(f)
        params["facet.mincount"] = 1   # hide zero-count facets

    solr_url = f"https://{SOLR_HOST}:8983/solr/{SOLR_COLLECTION}/select"
    session = requests.Session()
    session.auth = (SOLR_USER, SOLR_PASS)
    session.verify = False

    print(f"[DEBUG] 🔍 Connecting to: {solr_url}")
    flat_params = []
    for k, v in params.items():
        if isinstance(v, list):
            for item in v:
                flat_params.append((k, item))
        else:
            flat_params.append((k, v))

    resp = session.get(solr_url, params=flat_params)
    resp.raise_for_status()

    data = resp.json()
    docs = data.get("response", {}).get("docs", [])

    # 🔹 Extract facets safely
    facets = {}
    if include_facets:
        raw_facets = data.get("facet_counts", {}).get("facet_fields", {})
        for k, arr in raw_facets.items():
            facets[k] = [{"name": arr[i], "count": arr[i + 1]} for i in range(0, len(arr), 2)]

    return {
        "docs": docs,
        "facets": facets
    }

