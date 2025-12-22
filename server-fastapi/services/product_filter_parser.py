# product_filter_parser.py
import re
from typing import Dict, Any, List
from attribute_loader import load_facet_values

# We only care about these for products
KNOWN_FACETS = {"brand", "material", "color", "category"}


def _flatten(filters: Dict[str, Any]) -> Dict[str, List[str]]:
    """
    Make sure every filter value is a list[str].
    Example:
      {"brand": ["3M"], "category": "Power Tools"}
    → {"brand": ["3M"], "category": ["Power Tools"]}
    """
    out: Dict[str, List[str]] = {}
    for k, v in filters.items():
        if v is None:
            continue
        if isinstance(v, list):
            vals = [str(x).strip() for x in v if str(x).strip()]
        else:
            vals = [str(v).strip()]
        if vals:
            out[k.lower()] = vals
    return out


# Build facet value index once (uses your cached attribute_loader)
_facet_cache = load_facet_values() or {}
_facet_index: Dict[str, Dict[str, str]] = {}

for field, values in (_facet_cache or {}).items():
    field_l = field.lower()
    if field_l in KNOWN_FACETS:
        _facet_index[field_l] = {}
        for v in values:
            s = str(v).strip()
            if not s:
                continue
            _facet_index[field_l][s.upper()] = s  # "BOSCH" -> "Bosch"


def _normalize_value(field: str, raw: str) -> str:
    """
    Map BOSCH → Bosch, FURNITURE → Furniture etc.
    Uses live Solr facet values if possible, otherwise falls back to title().
    """
    field = field.lower()
    raw = raw.strip()
    if not raw:
        return raw

    up = raw.upper()

    # Exact facet match
    if field in _facet_index:
        if up in _facet_index[field]:
            return _facet_index[field][up]

        # Loose contains match (e.g. 'POWER TOOLS' vs 'POWER TOOLS ')
        for key, canonical in _facet_index[field].items():
            if up in key or key in up:
                return canonical

    # Fallback – pretty formatting
    return raw.title()


def normalize_filters_from_frontend(filters: Dict[str, Any]) -> Dict[str, Any]:
    """
    Takes Angular filters and returns a clean, multi-facet map.
    Handles phrases like:
      - "POWER TOOLS AND MATERIAL STEEL"
      - "STEEL AND COLOR BLUE"
      - "BRAND BOSCH AND COLOR BLACK"
    into:
      {"category": ["Power Tools"], "material": ["Steel"]}
      {"material": ["Steel"], "color": ["Blue"]}
      {"brand": ["Bosch"], "color": ["Black"]}
    """
    flat = _flatten(filters)
    out: Dict[str, List[str]] = {}

    for field, vals in flat.items():
        # Unknown facet key → push into search_text as-is
        if field not in KNOWN_FACETS:
            out.setdefault("search_text", []).extend(vals)
            continue

        for raw_val in vals:
            # Split on AND/OR
            parts = re.split(r"\band\b|\bor\b", raw_val, flags=re.IGNORECASE)
            for part in parts:
                part = part.strip()
                if not part:
                    continue

                lowered = part.lower()
                assigned = False

                # If the piece explicitly mentions another facet name,
                # redirect value to that facet.
                for other in KNOWN_FACETS:
                    if other in lowered and other != field:
                        # e.g. "material steel" → other = "material"
                        # strip the facet word out to get the value
                        value = re.sub(other, "", lowered, flags=re.IGNORECASE).strip()
                        if value:
                            nval = _normalize_value(other, value)
                            out.setdefault(other, []).append(nval)
                            assigned = True
                            break

                if assigned:
                    continue

                # Otherwise, keep it on the original facet
                nval = _normalize_value(field, part)
                out.setdefault(field, []).append(nval)

    return out
