# routes/order_voice.py
from fastapi import APIRouter, Body, HTTPException
from nlu_engine import NLU
from services.solr_voice_order_service import fetch_solr_orders_voice

router = APIRouter(prefix="/orders", tags=["Orders (Voice)"])
_nlu = NLU()


def sanitize_entities(entities: dict) -> dict:
    """
    Remove filler or meaningless entities like 'notes', 'by', etc.
    """
    ignore_keys = {"search_text", "account_partial", "notes", "by", "to", "for"}
    return {k: v for k, v in entities.items() if k not in ignore_keys}


def clean_voice_filters(filters: dict, intent: str) -> dict:
    """
    Remove conflicting or irrelevant filters from NLU output.
    """
    cleaned = dict(filters)
    # If account ID is present, drop item/product filters
    if "account_id" in cleaned:
        for drop_key in ["item_product_id", "product_id", "sku"]:
            cleaned.pop(drop_key, None)
    if intent.startswith("filter_by_account"):
        for drop_key in ["item_product_id", "product_id", "sku"]:
            cleaned.pop(drop_key, None)
    return cleaned


@router.post("/voice")
async def order_voice(payload: dict = Body(...)):
    text = (payload or {}).get("query", "")
    page = int((payload or {}).get("page", 1))
    pageSize = int((payload or {}).get("pageSize", 20))

    print(f"################## 1 : {text}")

    if not text.strip():
        raise HTTPException(status_code=400, detail="Query text required")

    # Step 1: Run NLU
    result = _nlu.infer(text)
    intent = result.get("intent", "unknown")
    raw_entities = result.get("entities", {})
    
    # Step 2: Sanitize entities before anything else
    entities = sanitize_entities(raw_entities)
    print("############# : " + f"[DEBUG][NLU] Text='{text}' | Intent='{intent}' | Entities={entities}")
    
    print(f"################## 2 : {intent}")
    print(f"################## Entities : {entities}")

    # Step 3: Build base query + filters
    q = "*:*"
    filters = {
        k: [v] for k, v in entities.items()
        if k not in {"account_id"}  # handle separately below
    }

    account_id = entities.get("account_id")
    super_user = intent == "view_all_orders"

    if not super_user and account_id:
        normalized = account_id.replace(" ", "")
        filters["account_id"] = [normalized]

    # Step 4: Remove conflicting filters (e.g. product_id)
    filters = clean_voice_filters(filters, intent)

    print(f"################## 3 (final fq): {filters}")

    # Step 5: Query Solr
    solr_result = await fetch_solr_orders_voice(
        query=q,
        page=page,
        pageSize=pageSize,
        filters=filters
    )

    # Step 6: Handle no results
    if solr_result.get("numFound", 0) == 0:
        raise HTTPException(status_code=404, detail="No orders found")

    # Step 7: Speech response
    num = solr_result.get("numFound", 0)
    speech = f"Showing {min(pageSize, num)} orders"
    if account_id:
        speech += f" for account {account_id}"
    if filters:
        other_filters = {k: v for k, v in filters.items() if k != "account_id"}
        if other_filters:
            speech += " filtered by " + ", ".join(
                f"{k}={','.join(v)}" for k, v in other_filters.items()
            )
    speech += "."

    return {
        **result,
        **solr_result,
        "speech": speech,
        "query_used": q
    }

