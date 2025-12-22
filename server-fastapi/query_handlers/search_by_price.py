#query_handlers/search_by_price.py
from .base_handler import build_edismax_query, extract_price_filters

def handle(intent, entities, text):
    price_fq = extract_price_filters(text)
    fq = [price_fq] if price_fq else []
    print(f"[INTENT] {intent} → fq={fq}")
    return build_edismax_query("*:*", fq)
