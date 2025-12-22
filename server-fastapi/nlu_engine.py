# nlu_engine.py
import re
from typing import Dict, Optional, Tuple
from difflib import SequenceMatcher
from phonetic_logger import log_unknown_terms
import torch
from transformers import DistilBertTokenizerFast, DistilBertForSequenceClassification
from attribute_loader import load_order_facets

from attribute_loader import load_facet_values
from phonetic_rules import (
    PHONETIC_RULES,
    PRODUCT_TYPE_NORMALIZATION,
    VOICE_MISHEAR_CORRECTIONS,
    ACCOUNT_SPOKEN_DIGITS,
    ACCOUNT_PREFIX_PATTERNS,
    _PHONETIC_MAP
)


class NLU:
    def __init__(self):
        # Load model & tokenizer
        self.model_path = "./intent_model"
        self.tokenizer = DistilBertTokenizerFast.from_pretrained(
            self.model_path, local_files_only=True
        )
        self.model = DistilBertForSequenceClassification.from_pretrained(
            self.model_path, local_files_only=True
        )
        self.model.eval()

        print("[DEBUG] Loaded intent labels:", self.model.config.id2label)

        # Load facet values for fuzzy entity recognition
        self.facets = load_facet_values() or {}
        
        order_facets = load_order_facets()
        self.facets.update(order_facets or {})
        print("[DEBUG] order facets ->", list(self.facets.get("status", []))[:10])

        self.label_names = list(self.model.config.id2label.values())
        
    # ✅ Build a known vocabulary for learning filter
        facet_values = []
        for values in self.facets.values():
            facet_values.extend([str(v).lower() for v in values])
        self.known_terms = set(facet_values + [
            # common brands, materials, colors, etc.
            "3m", "bosch", "dewalt", "makita", "godrej", "havells", "hitachi", "stanley", "kito", "ge",
            "steel", "plastic", "wood", "fibre",
            "red", "blue", "black", "white", "gray", "silver", "gold",
            "grinder", "drill", "brush", "tools", "broadloom", "vinyl", "ceramic", "granite"
        ])

    # --------------------------------------------------------
    # Intent classification (kept as-is; used by main.py)
    # --------------------------------------------------------
    def classify_intent(self, text: str):
        try:
            inputs = self.tokenizer(text, return_tensors="pt", truncation=True, padding=True)
            with torch.no_grad():
                logits = self.model(**inputs).logits
                probs = torch.softmax(logits, dim=1)[0]
                idx = torch.argmax(probs).item()
                conf = float(probs[idx])
            intent = self.label_names[idx]
            return intent, conf
        except Exception as e:
            print(f"[WARN] Intent classification failed: {e}")
            return "unknown", 0.0

    # --------------------------------------------------------
    # Text normalization (brands, product types, mishears)
    # NOTE: We intentionally DO NOT normalize account numbers here.
    #       Account normalization happens inside entity extraction only.
    # --------------------------------------------------------
    def normalize_text(self, text: str) -> str:
        """
        Normalize natural language text into a Solr-friendly string.
        Handles noise words, plurals, and phonetic / synonym normalization.
        """
        normalized = text.lower().strip()

        # --- Remove filler or polite words ---
        # These don't affect meaning but confuse Solr matching
        normalized = re.sub(r"\b(the|a|an|please|kindly|show|get|give|list|display|find|all of|of)\b", " ", normalized)

        # --- Normalize plurals ---
        normalized = re.sub(r"\bproducts\b", "product", normalized)
        normalized = re.sub(r"\borders\b", "order", normalized)

        # --- Collapse multiple spaces ---
        normalized = re.sub(r"\s+", " ", normalized).strip()
        
        # ✅ --- NEW: Self-learning unknown term logger (before normalization) ---
        raw_tokens = re.findall(r"\b[a-zA-Z0-9]+\b", normalized)
        raw_unknowns = [t for t in raw_tokens if t not in self.known_terms and len(t) > 2]
        if raw_unknowns:
            log_unknown_terms(raw_unknowns, list(self.known_terms))

        # --- Apply phonetic and mishear corrections ---
        for pattern, repl in PHONETIC_RULES.items():
            normalized = re.sub(pattern, repl, normalized)
        for pattern, repl in PRODUCT_TYPE_NORMALIZATION.items():
            normalized = re.sub(pattern, repl, normalized)
        for pattern, repl in VOICE_MISHEAR_CORRECTIONS.items():
            if pattern in normalized:
                print(f"[DEBUG][VOICE_CORRECTION] Replacing '{pattern}' → '{repl}' in '{normalized}'")
            normalized = re.sub(pattern, repl, normalized, flags=re.IGNORECASE)
        for pattern, replacement in _PHONETIC_MAP.items():
            normalized = re.sub(pattern, replacement, normalized, flags=re.IGNORECASE)
            
        # ✅ --- NEW: Self-learning unknown term logger ---
        tokens = re.findall(r"\b[a-zA-Z0-9]+\b", normalized)
        unknowns = [t for t in tokens if t not in self.known_terms and len(t) > 2]
        if unknowns:
            log_unknown_terms(unknowns, list(self.known_terms))
            
        return normalized


    # --------------------------------------------------------
    # Account helpers (customer-safe)
    # --------------------------------------------------------
    @staticmethod
    def _normalize_account_phrase_segment(text: str) -> str:
        """
        Converts spoken digits to numerals ONLY when they appear after account prefixes
        like 'acc', 'account', 'account number', 'my account'. Leaves other numbers alone.
        Example: 'acc one zero two seven' -> 'acc 1027'
        """
        prefix_alt = "|".join(map(re.escape, ACCOUNT_PREFIX_PATTERNS))
        # capture "<prefix> <tail of words/digits>"
        pattern = re.compile(rf"\b(?:{prefix_alt})\s+([a-z\s\d]+)\b", re.IGNORECASE)

        def repl(match: re.Match) -> str:
            tail = match.group(1)
            tokens = re.split(r"\s+", tail.strip())
            converted = []
            for t in tokens:
                t_clean = t.strip().lower()
                if t_clean in ACCOUNT_SPOKEN_DIGITS:
                    converted.append(ACCOUNT_SPOKEN_DIGITS[t_clean])
                elif t_clean.isdigit():
                    converted.append(t_clean)
                else:
                    # stop at first non-digit-ish token so we don't eat extra words
                    break
            digits = "".join(converted)
            if digits:
                full = match.group(0)
                # replace only the tail with the recognized digits
                return full[: full.lower().find(tail.lower())] + digits
            return match.group(0)

        return pattern.sub(repl, text)

    @classmethod
    def _extract_account_id(cls, raw_text: str) -> Tuple[Optional[str], bool]:
        """
        Returns (account_id, is_partial)
          - account_id like 'ACC1027' if we find >= 4 digits after 'acc'/'account' OR explicit 'acc####'
          - is_partial=True if an account context was detected but digits < 4
        """
        t = raw_text.strip()
        # 1) Normalize only account segment
        t_norm = cls._normalize_account_phrase_segment(t)

        # 2) Try explicit 'acc####'
        m_explicit = re.search(r"\bacc\s*([0-9]{4,})\b", t_norm, flags=re.IGNORECASE)
        if m_explicit:
            return f"ACC{m_explicit.group(1)}".upper(), False

        # 3) Try 'account ####' / 'account number ####' / 'my account ####'
        m_prefix = re.search(
            r"\b(?:account|account number|my account)\s*([0-9]{1,})\b",
            t_norm,
            flags=re.IGNORECASE,
        )
        if m_prefix:
            digits = m_prefix.group(1)
            if len(digits) >= 4:
                return f"ACC{digits}".upper(), False
            return None, True  # account context heard but insufficient digits

        return None, False  # no account context

    # --------------------------------------------------------
    # Entity extraction (merged + customer-safe account logic)
    # --------------------------------------------------------
    def extract_entities(self, text: str) -> Dict:
        entities: Dict = {}
            
        normalized = self.normalize_text(text)
        lowered = normalized.lower()    
        #lowered = text.lower()
        ignore_fields = {"search_text", "_text_", "_version_", "id"}

        def fuzzy_ratio(a, b):
            return SequenceMatcher(None, a.lower(), b.lower()).ratio()

        # 0) Account ID (customer-safe) — do FIRST so we always capture it
        account_id, is_partial = self._extract_account_id(text)
        if account_id:
            entities["account_id"] = account_id
        elif is_partial:
            entities["account_partial"] = True  # router will ask the user to repeat

        # 1) Fuzzy match against Solr facet values (brand/material/color/etc.)
        for field, values in self.facets.items():
            if field in ignore_fields:
                continue
            best_match = None
            best_score = 0.0
            for v in values:
                v_clean = str(v).lower().strip()
                score = fuzzy_ratio(lowered, v_clean)
                if score > best_score:
                    best_match, best_score = v, score
                # literal contains check
                if re.search(rf"\b{re.escape(v_clean)}\b", lowered):
                    best_match, best_score = v, 1.0
                    break
            if best_score >= 0.8:
                entities[field] = best_match

        # 2) Price handling
        under = re.search(r"under\s+(\d+)", lowered)
        over = re.search(r"(?:above|over|greater\s+than)\s+(\d+)", lowered)
        between = re.search(r"between\s+(\d+)\s+(?:and|to)\s+(\d+)", lowered)
        if between:
            low, high = between.groups()
            entities["price"] = f"[{low} TO {high}]"
        elif under:
            entities["price"] = f"[0 TO {under.group(1)}]"
        elif over:
            entities["price"] = f"[{over.group(1)} TO 999999]"

        # 3) Synonyms → canonical
        synonym_map = {
            "manufacturer": "brand",
            "make": "brand",
            "fabric": "material",
            "substance": "material",
            "colour": "color",
            "tone": "color",
        }
        for syn, canonical in synonym_map.items():
            if syn in lowered and canonical in self.facets:
                entities[canonical] = syn

        # 4) Fallback search text (only if nothing else captured)
        if not entities:
            entities["search_text"] = lowered
        print("[ENTITIES RAW]", entities)
        return entities

    # --------------------------------------------------------
    # Optional combined pipeline (not used by your main.py, but handy)
    # --------------------------------------------------------
    def parse(self, text: str) -> Dict:
        """
        Full convenience call:
          1) normalize (brands/mishears/product-types),
          2) classify intent,
          3) extract entities (incl. account ID).
        """
        normalized = self.normalize_text(text)
        intent, confidence = self.classify_intent(normalized)
        entities = self.extract_entities(text)  # pass raw text so account logic works safely

        lowered = normalized.lower()
        if "all" in lowered and "order" in lowered:
            intent = "view_all_orders"
            confidence = max(confidence, 0.8)
            print(f"[DEBUG] Overridden intent to {intent} based on keyword match")

        return {"intent": intent, "confidence": confidence, "entities": entities}
    
    # --------------------------------------------------------
    # Unified inference helper for voice endpoints
    # --------------------------------------------------------
    def infer(self, text: str) -> Dict:
        """
        High-level NLU inference combining:
          - normalization
          - intent classification
          - entity extraction
        """
        normalized = self.normalize_text(text)
        intent, confidence = self.classify_intent(normalized)
        entities = self.extract_entities(normalized)
        return {
            "input": text,
            "normalized": normalized,
            "intent": intent,
            "confidence": confidence,
            "entities": entities
    }

