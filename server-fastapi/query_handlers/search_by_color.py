#query_handlers/search_by_color.py
from .base_handler import build_edismax_query

def handle(intent, entities, text):
    color = entities.get("color")
    fq = [f"color:{color}"] if color else []
    q = color or "*:*"
    print(f"[INTENT] search_by_color → color={color}")
    return build_edismax_query(q, fq)
