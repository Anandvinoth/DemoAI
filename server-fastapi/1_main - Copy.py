from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

cart = {}
SOLR_URL = "https://35.239.13.165:8983/solr/products/select"

class CartItem(BaseModel):
    user: str
    product: dict

@app.post("/webhook")
async def webhook(req: Request):
    body = await req.json()
    query = body.get("query", "")
    if "add" in query and "cart" in query:
        return {"reply": "Item added to your cart."}
    elif "cart" in query:
        return {"reply": f"Your cart contains: {cart.get('demo-user', [])}"}
    else:
        async with httpx.AsyncClient() as client:
            solr_resp = await client.get(SOLR_URL, params={"q": query, "wt": "json"})
            docs = solr_resp.json().get("response", {}).get("docs", [])
            names = [doc.get("name", "Unknown") for doc in docs]
            return {"reply": "I found: " + ", ".join(names)}

@app.post("/cart/add")
def add_to_cart(item: CartItem):
    user_cart = cart.setdefault(item.user, [])
    user_cart.append(item.product)
    return {"status": "added", "cart": user_cart}

@app.get("/cart")
def get_cart(user: str = "demo-user"):
    return {"cart": cart.get(user, [])}
