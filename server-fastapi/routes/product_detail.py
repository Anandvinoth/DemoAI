#routes/product_detail.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.product_detail_service import fetch_product_by_id

router = APIRouter(prefix="/products", tags=["Product Detail"])

class ProductDetailRequest(BaseModel):
    product_id: str

@router.post("/detail")
async def product_detail(req: ProductDetailRequest):
    product_id = req.product_id.strip()

    if not product_id:
        raise HTTPException(status_code=400, detail="product_id is required")

    product = await fetch_product_by_id(product_id)

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    return {
        "intent": "product_detail",
        "product_id": product_id,
        "product": product
    }
