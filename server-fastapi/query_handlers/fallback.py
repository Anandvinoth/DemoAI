#query_handlers/fallback.py
from .base_handler import build_edismax_query

def handle(intent, entities, text):
    print(f"[INTENT] fallback → unknown intent '{intent}'")
    return build_edismax_query("*:*")
