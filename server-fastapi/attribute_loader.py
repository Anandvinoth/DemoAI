#attribute_loader.py
import requests
import time
import os
import socket

#CACHE = None
LAST_REFRESH = 0
CACHE_TTL = 3600  # 1 hour
CACHE_PRODUCTS = None
CACHE_ORDERS = None
LAST_REFRESH_PRODUCTS = 0
LAST_REFRESH_ORDERS = 0

# Dynamic defaults
DEFAULT_COLLECTION = os.getenv("SOLR_COLLECTION", "products")

def get_solr_host():
    """Auto-detect host (works both in Docker and local)."""
    try:
        socket.gethostbyname("host.docker.internal")
        return "host.docker.internal"
    except socket.error:
        return "localhost"

SOLR_HOST = "localhost"#os.getenv("SOLR_HOST", get_solr_host())

def load_facet_values(collection: str = DEFAULT_COLLECTION, force_refresh=False):
    """Load Solr facets on demand. Cached to avoid repeated hits."""
    global CACHE_PRODUCTS, LAST_REFRESH_PRODUCTS

    # ✅ Only refresh if cache expired or forced
#    if CACHE_PRODUCTS is not None and not force_refresh and (time.time() - LAST_REFRESH < CACHE_TTL):
#        return CACHE_PRODUCTS
    if CACHE_PRODUCTS is not None and not force_refresh and (time.time() - LAST_REFRESH_PRODUCTS < CACHE_TTL):
        return CACHE_PRODUCTS

    session = requests.Session()
    session.verify = False

    solr_base = f"https://{SOLR_HOST}:8983/solr/{collection}"
    solr_url = f"{solr_base}/select"
    schema_url = f"{solr_base}/schema/fields"
    
    SOLR_USER = os.getenv("SOLR_USER", "solr")
    SOLR_PASS = os.getenv("SOLR_PASS", "SolrRocks")

    session = requests.Session()
    session.auth = (SOLR_USER, SOLR_PASS)
    session.verify = False

    print(f"[INFO] Loading facets from Solr collection '{collection}' via {SOLR_HOST} ...")

    try:
        schema_resp = session.get(schema_url, timeout=5)
        schema_resp.raise_for_status()
        schema_fields = [f["name"] for f in schema_resp.json().get("fields", [])]
    except Exception as e:
        print(f"[WARN] Solr not reachable ({e}); returning empty facet cache.")
        return {}

    params = {"q": "*:*", "rows": 0, "facet": "true"}
    for f in schema_fields:
        params.setdefault("facet.field", []).append(f)

    try:
        response = session.get(solr_url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        facets = data.get("facet_counts", {}).get("facet_fields", {})
        CACHE = {k: [facets[k][i] for i in range(0, len(facets[k]), 2)] for k in facets}
        LAST_REFRESH_PRODUCTS = time.time()
        return CACHE
    except Exception as e:
        print(f"[WARN] Solr facet load failed: {e}")
        return {}


def clear_cache():
    global CACHE, LAST_REFRESH
    CACHE = None
    LAST_REFRESH = 0
    print("[INFO] Solr facet cache cleared.")
    
    
def load_order_facets(force_refresh=False):
    """Load facets from the 'orderHistory' Solr collection (separate cache)."""
    global CACHE_ORDERS, LAST_REFRESH_ORDERS

    if CACHE_ORDERS is not None and not force_refresh and (time.time() - LAST_REFRESH_ORDERS < CACHE_TTL):
        return CACHE_ORDERS

    print("[INFO] Loading order facets from Solr collection 'orderHistory' ...")
    try:
        result = load_facet_values(collection="orderHistory", force_refresh=True)
        CACHE_ORDERS = result
        LAST_REFRESH_ORDERS = time.time()
        return result
    except Exception as e:
        print(f"[WARN] Failed to load order facets: {e}")
        return {}




