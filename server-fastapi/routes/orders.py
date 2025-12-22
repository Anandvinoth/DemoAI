# routes/orders.py
from fastapi import APIRouter, HTTPException, Query,Body
from typing import List, Optional, Dict, Any
from model.order_history import OrderHistory
from services.order_service import get_orders_with_products
from tasks.order_indexer import index_order_in_solr
import mysql.connector

router = APIRouter(prefix="/orders", tags=["Orders"])

# --------------------------
# 1️⃣  View order history (with facets + pagination)
# --------------------------
@router.get("/history")
@router.post("/history")
async def get_order_history(
    payload: Optional[dict] = Body(default=None),
    account_id: Optional[str] = Query(None, description="Account ID for normal user"),
    super_user: bool = Query(False, description="If true, fetches all orders"),
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    pageSize: int = Query(20, ge=1, le=100, description="Items per page (max 100)")
):
    """
    Unified GET + POST endpoint:
    - GET → /api/orders/history?account_id=ACC1002&super_user=false&page=1&pageSize=20
    - POST → { "superUser": true, "page": 1, "pageSize": 20 }
    """

    # 🧩 Merge POST payload with query params
    if payload:
        account_id = payload.get("account_id", account_id)
        # Angular usually sends camelCase keys like "superUser"
        super_user = payload.get("super_user", payload.get("superUser", super_user))
        page = int(payload.get("page", page))
        pageSize = int(payload.get("pageSize", pageSize))

    try:
        # 🔹 Choose between super-user and normal account view
        if super_user:
            result = await get_orders_with_products(account_id=None, is_super_user=True, page=page, pageSize=pageSize)
        elif account_id:
            result = await get_orders_with_products(account_id=account_id, is_super_user=False, page=page, pageSize=pageSize)
        else:
            raise HTTPException(status_code=400, detail="Provide either account_id or super_user=true")

        if not result or result.get("numFound", 0) == 0:
            raise HTTPException(status_code=404, detail="No orders found")

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --------------------------
# 2️⃣  Create order
# --------------------------
@router.post("/orders")
def create_order(order: dict):
    """
    Insert order into MySQL, then trigger Solr indexing.
    """
    conn = mysql.connector.connect(
        host="localhost",
        user="sa",
        password="nimda",
        database="openvoice360"
    )
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO order_header (order_id, account_id, order_date, status, total_amount, currency) VALUES (%s, %s, %s, %s, %s, %s)",
        (order["order_id"], order["account_id"], order["order_date"], order["status"], order["total_amount"], order["currency"])
    )
    conn.commit()
    conn.close()

    index_order_in_solr.delay(order["order_id"])
    return {"message": "Order created and indexing triggered."}
