# routes/orders.py
from fastapi import APIRouter
from typing import List
from model.order_history import OrderHistory

router = APIRouter()

@router.get("/history/{user_id}", response_model=List[OrderHistory])
async def get_order_history(user_id: str):
    # Later you can fetch this from MySQL or another service
    # For now, return a demo dataset
    return [
        {
            "orderId": "ORD1001",
            "userId": user_id,
            "orderDate": "2025-10-10",
            "total": 259.99,
            "status": "Delivered",
            "items": [
                {"name": "Hydraulic Press", "qty": 1, "price": 159.99},
                {"name": "Safety Helmet", "qty": 2, "price": 50.00},
            ],
        },
        {
            "orderId": "ORD1002",
            "userId": user_id,
            "orderDate": "2025-10-11",
            "total": 399.50,
            "status": "In Transit",
            "items": [{"name": "Welding Machine", "qty": 1, "price": 399.50}],
        },
    ]
