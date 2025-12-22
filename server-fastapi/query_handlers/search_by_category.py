# query_handlers/search_by_category.py
from .base_handler import build_edismax_query

def handle(intent, entities, text):
    category = entities.get("category")
    fq = []
    q = "*:*"

    if category:
        safe_val = f"\"{category}\"" if " " in category else category
        fq.append(f"category:{safe_val}")
        q = safe_val

    print(f"[INTENT] search_by_category → category={category}")
    return build_edismax_query(q, fq)
