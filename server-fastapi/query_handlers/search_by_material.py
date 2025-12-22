#query_handlers/search_by_material.py
from .base_handler import build_edismax_query

def handle(intent, entities, text):
    material = entities.get("material")
    fq = [f"material:{material}"] if material else []
    q = material or "*:*"
    print(f"[INTENT] search_by_material → material={material}")
    return build_edismax_query(q, fq)
