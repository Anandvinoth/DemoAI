# services/order_service.py
import asyncio
import json
from typing import List, Dict, Optional
from services.solr_service import fetch_solr_with_facets, fetch_products_bulk

async def get_orders_with_products(
    account_id: Optional[str],
    is_super_user: bool = False,
    page: int = 1,
    pageSize: int = 20
) -> Dict:
    """
    Fetch orders from Solr (optionally filtered by account_id) with pagination and enrichment.
    Returns a dict with:
      - numFound: total orders matching query
      - orders: list of enriched orders for the page
      - facets: facet counts (only on page 1)
      - page, pageSize, totalPages
    """

    # -------------------------------
    # 1️⃣ Build Solr Query
    # -------------------------------
    if is_super_user:
        query = "*:*"
    elif account_id:
        query = f"account_id:{account_id}"
    else:
        raise ValueError("account_id must be provided for non-super-user queries")

    # -------------------------------
    # 2️⃣ Fetch Orders (with facets only for page 1)
    # -------------------------------
    solr_result = await fetch_solr_with_facets(
        "orderHistory",
        query,
        page=page,
        pageSize=pageSize
    )

    orders = solr_result.get("orders", [])
    num_found = solr_result.get("numFound", len(orders))
    facets = solr_result.get("facets", {})

    if not orders:
        return {"numFound": 0, "orders": [], "facets": facets, "page": page, "pageSize": pageSize, "totalPages": 0}

    # -------------------------------
    # 3️⃣ Extract Product IDs (Hybrid parsing)
    # -------------------------------
    product_ids = set()

    for order in orders:
        items = []

        items_json_str = order.get("items_json")
        if items_json_str:
            try:
                items = json.loads(items_json_str) if isinstance(items_json_str, str) else items_json_str
                if isinstance(items, str):
                    items = json.loads(items)
            except Exception:
                items = []

        # Fallback to array-based items
        if not items:
            prod_ids = order.get("item_product_id", [])
            quantities = order.get("item_quantity", [])
            unit_prices = order.get("item_unit_price", [])
            for idx, pid in enumerate(prod_ids):
                item = {
                    "product_id": pid,
                    "quantity": quantities[idx] if idx < len(quantities) else None,
                    "unit_price": unit_prices[idx] if idx < len(unit_prices) else None
                }
                items.append(item)

        order["items"] = items

        for it in items:
            pid = it.get("product_id")
            if pid:
                product_ids.add(str(pid).strip())

    # -------------------------------
    # 4️⃣ Bulk Fetch Product Info (cached)
    # -------------------------------
    products_map = await fetch_products_bulk(list(product_ids))

    # -------------------------------
    # 5️⃣ Enrich Orders with Product Details
    # -------------------------------
    for order in orders:
        enriched_details = []

        for item in order.get("items", []):
            pid = str(item.get("product_id")).strip()
            product = products_map.get(pid)

            if not product:
                # Try product_detail_id fallback
                pdetail = item.get("product_detail_id")
                if pdetail and "-" in pdetail:
                    base_pid = pdetail.split("-")[0]
                    product = products_map.get(base_pid)

            if product:
                enriched_details.append({
                    "product_id": pid,
                    "name": product.get("name"),
                    "brand": product.get("brand"),
                    "price": product.get("price"),
                    "material": product.get("material"),
                    "color": product.get("color"),
                    "weight": product.get("weight"),
                    "image_url": product.get("image_url")
                })

        order["product_details"] = enriched_details

    # -------------------------------
    # 6️⃣ Build Pagination Metadata
    # -------------------------------
    totalPages = (num_found + pageSize - 1) // pageSize

    return {
        "numFound": num_found,
        "orders": orders,
        "facets": facets,
        "page": page,
        "pageSize": pageSize,
        "totalPages": totalPages
    }
