# routes/order_history_voice.py
from fastapi import APIRouter, HTTPException, Header, Request, Query, Body
from typing import Optional, Dict, Any
from services.order_service import get_orders_with_products
from nlu_engine import NLU

router = APIRouter(prefix="/orderhistory", tags=["Order History (Voice)"])
_nlu = NLU()

# -------------------------------------------------------
# 1️⃣ Helper: Generate voice-friendly speech summary
# -------------------------------------------------------
def _speech_for_orders(result: Dict[str, Any], acc: Optional[str], super_user: bool) -> str:
    num = result.get("numFound", 0)
    page = result.get("page", 1)
    pageSize = result.get("pageSize", 20)
    who = "all accounts" if super_user else (acc or "your account")
    return f"Showing {min(pageSize, num)} orders on page {page} for {who}."

# -------------------------------------------------------
# 2️⃣ GET/POST: Unified order history query (voice + filters)
# -------------------------------------------------------
@router.get("/query")
@router.post("/query")
async def order_history_query(
    request: Request,
    payload: Optional[dict] = Body(default=None),
    x_account_id: Optional[str] = Header(default=None, alias="X-ACCOUNT-ID"),
    x_super_user: Optional[str] = Header(default=None, alias="X-SUPER-USER"),
    account_id_q: Optional[str] = Query(None, description="Account ID (GET fallback)"),
    super_user_q: bool = Query(False, description="Super user flag (GET fallback)"),
    page_q: int = Query(1, ge=1, description="Page number (GET fallback)"),
    page_size_q: int = Query(20, ge=1, le=100, description="Page size (GET fallback)"),
):
    """
    Handles both voice-based (POST) and API (GET) order history queries.
    Supports:
    - Voice: {"query": "show my orders", "account_id": "ACC1027", "super_user": true}
    - Angular/UI filters: {"filters": {"status": ["Delivered"], "price": ["[500 TO 999999]"]}}
    - Simple GET requests: /orderhistory/query?super_user=true&page=1&pageSize=20
    """

    # ----------------------------------------------
    # 1️⃣ Unify parameters from GET or POST
    # ----------------------------------------------
    text = (payload or {}).get("query", "") if payload else ""
    account_id = x_account_id or account_id_q or ((payload or {}).get("account_id") if payload else None)
    super_user_flag = (x_super_user or "").lower() == "true" or bool((payload or {}).get("super_user", False) if payload else super_user_q)
    page = int((payload or {}).get("page", page_q))
    pageSize = int((payload or {}).get("pageSize", page_size_q))
    filters = (payload or {}).get("filters", {}) if payload else {}

    # ----------------------------------------------
    # 2️⃣ Handle voice-based query intent (if any)
    # ----------------------------------------------
    if text:
        entities = _nlu.extract_entities(text)
        if not super_user_flag and not account_id:
            if "account_id" in entities:
                account_id = entities["account_id"]
            elif entities.get("account_partial"):
                return {
                    "intent": "clarify_account",
                    "message": "I couldn’t catch your full account ID. Please say it again or type it in the account_id box.",
                    "retrySafe": True
                }

    # ----------------------------------------------
    # 3️⃣ Security check
    # ----------------------------------------------
    if not super_user_flag and not account_id:
        return {
            "intent": "clarify_account",
            "message": "Please say or type your account ID to continue.",
            "retrySafe": True
        }

    # ----------------------------------------------
    # 4️⃣ Execute query
    # ----------------------------------------------
    try:
        result = await get_orders_with_products(
            account_id=None if super_user_flag else account_id,
            is_super_user=super_user_flag,
            page=page,
            pageSize=pageSize,
        )

        if result.get("numFound", 0) == 0:
            raise HTTPException(status_code=404, detail="No orders found")

        speech = _speech_for_orders(result, account_id, super_user_flag)

        return {
            "speech": speech,
            "filters_used": filters,
            "input_query": text,
            **result
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))