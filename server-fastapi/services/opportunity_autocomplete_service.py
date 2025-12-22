# services/opportunity_autocomplete_service.py
import re
from db.mysql_client import get_connection

SPOKEN_NUMS = {
    "zero": "0", "one": "1", "two": "2", "three": "3", "four": "4",
    "five": "5", "six": "6", "seven": "7", "eight": "8", "nine": "9",
    "ten": "10"
}

# NEW — covers all weird voice prefixes
FUZZY_ACC_PREFIXES = [
    r"^yes\s*cc",
    r"^yess\s*cc",
    r"^kcc",
    r"^scc",
    r"^xcc",
    r"^hcc",
    r"^ac\s*c\s*c",
    r"^a\s*c\s*c",
    r"^ac",
    r"^a\s*c",
    r"^acc",
]


def normalize_voice_id(text: str) -> str:
    """
    Converts messy speech-to-text into clean CRM IDs:
      'Yes CC one zero one' → 'ACC101'
      'Kcc101' → 'ACC101'
      'S C C 1027' → 'ACC1027'
      'one zero zero seven' → 'ACC1007'
      'acc ten ten' → 'ACC1010'
    """

    raw = text.lower().strip()

    # ----------------------------------------
    # 1) Fix fuzzy prefixes → "acc"
    # ----------------------------------------
    fixed = raw
    for pat in FUZZY_ACC_PREFIXES:
        fixed = re.sub(pat, "acc", fixed)

    # Insert space between letters & digits → acc101 → acc 101
    fixed = re.sub(r"([a-z]+)(\d+)", r"\1 \2", fixed)

    # Remove extra spaces
    fixed = fixed.replace("  ", " ").strip()

    tokens = fixed.split()
    digits_only = []

    # ----------------------------------------
    # 2) Convert spoken numbers
    # ----------------------------------------
    for tok in tokens:
        if tok in SPOKEN_NUMS:
            digits_only.append(SPOKEN_NUMS[tok])
        elif tok.isdigit():
            digits_only.append(tok)
        elif tok.startswith("acc"):
            # keep prefix
            pass

    number_str = "".join(digits_only)

    # ----------------------------------------
    # 3) Build final ID
    # ----------------------------------------
    if "acc" in fixed:
        # User said some form of ACC
        final = "ACC" + number_str
    else:
        # User did NOT say ACC → infer it's an account ID
        # Example: "one zero zero seven" → ACC1007
        final = "ACC" + number_str

    # Clean non-alphanumeric
    final = re.sub(r"[^A-Z0-9]", "", final)

    return final.upper()


async def search_accounts(query: str):
    q_norm = normalize_voice_id(query)
    print("##### normalized voice id : " + q_norm)

    sql = """
        SELECT account_id AS id, account_name AS name
        FROM account
        WHERE account_id LIKE %s OR account_name LIKE %s
        LIMIT 10
    """

    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(sql, (f"%{q_norm}%", f"%{query}%"))
            return cursor.fetchall()
    finally:
        conn.close()



async def search_contacts(query: str):
    
    q_norm = normalize_voice_id(query)
    
    sql = """
        SELECT contact_id AS id, full_name AS name
        FROM contact
        WHERE contact_id LIKE %s OR full_name LIKE %s
        LIMIT 10
    """
    #like = f"%{query}%"

    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(sql, (f"%{q_norm}%", f"%{query}%"))
            return cursor.fetchall()
    finally:
        conn.close()
