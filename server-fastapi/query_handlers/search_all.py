#query_handlers/search_all.py
from .base_handler import build_edismax_query
import re

def handle(intent, entities, text):
    print(f"[INTENT] search_all → '{text}'")
    return build_edismax_query("*:*")
