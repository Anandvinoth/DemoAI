# services/order_intent_router.py
from typing import Dict, Any, List
from services.order_service import get_orders_with_products

#DEFAULT_ACCOUNT_ID = "ACC1021"   # <-- change to your test user

ORDER_INTENTS = {"view_orders", "view_all_orders"}

async def handle_order_intent(intent: str, entities: Dict[str, Any],account_id=None) -> List[Dict[str, Any]]:
    if intent == "view_all_orders":
        return await get_orders_with_products(account_id=None, is_super_user=True)

    #account_id = entities.get("account_id") or DEFAULT_ACCOUNT_ID
    return await get_orders_with_products(account_id=account_id, is_super_user=False)
