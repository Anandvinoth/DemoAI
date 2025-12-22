#query_handlers/search_by_brand.py
from .base_handler import build_edismax_query

def handle(intent, entities, text):
    brand = entities.get("brand")
    fq = [f"brand:{brand}"] if brand else []
    q = brand or "*:*"
    print(f"[INTENT] search_by_brand → brand={brand}")
    return build_edismax_query(q, fq)
