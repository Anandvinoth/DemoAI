# ================================================
# phonetic_rules.py
# ================================================

# Simple dictionary of replacements for phonetic normalization
PHONETIC_RULES = {
    r"\bto\b": "2",
    r"\btoo\b": "2",
    r"\btwo\b": "2",
    r"\bfor\b": "4",
    r"\bfour\b": "4",
    r"\bzero\b": "0",
    r"\boh\b": "0",
    # add more as needed...
}

# ===================================================
# Misheard brand/material/color → canonical correction
# ===================================================
VOICE_MISHEAR_CORRECTIONS = {
    # --- Brands ---
    "cartridge": "godrej",
    "god rage": "godrej",
    "god rageh": "godrej",
    "goodridge": "godrej",
    "dewalt": "dewalt",
    "default": "dewalt",
    "maketa": "makita",
    "makeda": "makita",
    "hitachi": "hitachi",
    "hitache": "hitachi",
    "heavens": "havells",
    "keto": "kito",
    "stan lee": "stanley",
    "stanly": "stanley",
    "bosh": "bosch",
    "boshh": "bosch",
    "boschh": "bosch",
    "gee": "ge",
    "jee": "ge",
    "3mr": "3m",
    "3 m r": "3m",
    "3 m g e": "3m ge",
    "3mge": "3m ge",

    # --- Materials ---
    "steal": "steel",
    "plastick": "plastic",
    "wooden": "wood",
    "iron": "steel",  # sometimes used interchangeably
    "fiber": "fibre",

    # --- Colors ---
    "read": "red",
    "blew": "blue",
    "blak": "black",
    "wite": "white",
    "grey": "gray",
    "ash": "gray",
    "sliver": "silver",
    "golden": "gold",

    # --- Categories ---
    "grinder machine": "grinder",
    "drill machine": "drill",
    "hand tool": "tools",
    "paint brush": "brush"
}

# ===================================================
# Phonetic / regex-based normalization map
# ===================================================
_PHONETIC_MAP = {
    r"\b3mr\b": "3m or",
    r"\b3m\s*r\b": "3m or",
    r"\b3m\s*\+\s*g\b": "3m + ge",
    r"\b3m\s*g\b": "3m ge",
    r"\bgod\s*rej\b": "godrej",
    r"\bgod\s*rage\b": "godrej",
    r"\bgod\s*raj\b": "godrej",
    r"\bboshh?\b": "bosch",
    r"\bdew\s*all\b": "dewalt",
    r"\bstan\s*lee\b": "stanley",
    r"\bgee\b": "ge",
    r"\bjee\b": "ge",
    r"\bcartridgee?\b": "cartridge",
    r"\bcanceled\b": "cancelled",
    r"\bcanceling\b": "cancelling",
    r"\bcancel\b": "cancel",
}

# ===================================================
# Product Type Normalization
# ===================================================
PRODUCT_TYPE_NORMALIZATION = {
    r"\bcommercial broad loom\b": "commercial broadloom",
    r"\bresidential broad loom\b": "residential broadloom",
    r"\bbroad loom\b": "broadloom",
    r"\bvinyll?\b": "vinyl",
    r"\bceremic\b": "ceramic",
    r"\bgranitt?\b": "granite"
}

# ===================================================
# Account Number Speech Normalization
# ===================================================
ACCOUNT_SPOKEN_DIGITS = {
    "zero": "0",
    "oh": "0",       # users say "oh" instead of zero
    "one": "1",
    "two": "2",
    "to": "2",
    "too": "2",
    "three": "3",
    "four": "4",
    "for": "4",
    "five": "5",
    "six": "6",
    "seven": "7",
    "eight": "8",
    "nine": "9"
}

ACCOUNT_PREFIX_PATTERNS = [
    "acc",
    "account",
    "my account",
    "account number"
]
