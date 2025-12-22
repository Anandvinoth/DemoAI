# phonetic_logger.py
import json
import os
import re
from datetime import datetime
from typing import List

LOG_FILE = "phonetic_learning_log.json"

def _load_log() -> dict:
    if os.path.exists(LOG_FILE):
        try:
            with open(LOG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except json.JSONDecodeError:
            return {}
    return {}

def _save_log(data: dict):
    with open(LOG_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def log_unknown_terms(raw_terms: List[str], known_terms: List[str]):
    """
    Logs any tokens not recognized in the known vocabulary.
    Uses a human-readable UTC timestamp.
    """
    data = _load_log()
    known_set = set(t.lower() for t in known_terms)

    for t in raw_terms:
        t_clean = re.sub(r"[^a-z0-9\s]", "", t.lower()).strip()
        if not t_clean or len(t_clean) < 2:
            continue
        if t_clean not in known_set:
            entry = data.get(t_clean, [])
            entry.append({
                "timestamp": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
                "original": t
            })
            data[t_clean] = entry

    _save_log(data)
