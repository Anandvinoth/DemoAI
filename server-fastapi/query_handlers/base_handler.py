# query_handlers/base_handler.py
import re

def extract_price_filters(text: str):
    text = text.lower()
    under = re.search(r"under\s+(\d+)", text)
    over = re.search(r"(?:above|over|greater\s+than)\s+(\d+)", text)
    between = re.search(r"between\s+(\d+)\s+(?:and|to)\s+(\d+)", text)

    if between:
        low, high = between.groups()
        return f"price:[{low} TO {high}]"
    elif under:
        val = int(under.group(1))
        return f"price:[0 TO {val}]"
    elif over:
        val = int(over.group(1))
        return f"price:[{val} TO 999999]"
    return None


def build_edismax_query(q="*:*", fq=None):
    return {
        "q": q or "*:*",
        "fq": fq or [],
        "defType": "edismax",
        "qf": "search_text name brand category description",
        "df": "search_text"
    }
