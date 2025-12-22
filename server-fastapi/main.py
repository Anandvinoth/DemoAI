# main.py
from fastapi import FastAPI, Request, HTTPException,Header
from nlu_engine import NLU
import requests, pysolr
from fastapi.middleware.cors import CORSMiddleware
from routes import orders
from pydantic import BaseModel
from logger import log_solr_request_response
from attribute_loader import clear_cache, load_facet_values
from solr_query_builder import search_solr
import solr_query_builder
print(f"[DEBUG] Imported solr_query_builder from: {solr_query_builder.__file__}")
import traceback
from celery_app import celery_app  # ensure celery loads first
from routes import orders  # import routes after celery setup
from services.order_intent_router import handle_order_intent, ORDER_INTENTS
from typing import Dict
from fastapi import Request
from services.order_service import get_orders_with_products
#from routes import products
#from routes import products as products_router
from routes import order_history_voice as order_history_voice_router
from routes import product_voice as product_voice_router
from routes import order_voice
from routes.product_voice_v2 import router as product_voice_v2_router
from routes.product_detail import router as product_detail_router
from routes.opportunity_routes import router as opp_router
from routes.opportunity_metadata import router as opportunity_metadata_router
from routes.opportunity_autocomplete import router as opp_auto_router


# Simple in-memory retry state (per client IP)
_ACCOUNT_RETRY: Dict[str, int] = {}
MAX_ACCOUNT_RETRIES = 2

def _client_key(req: Request) -> str:
    # Use client IP; if you have auth, you can switch to user id/claims later.
    return getattr(req.client, "host", "unknown")

# verify connection to Redis before app startup
try:
    conn = celery_app.connection()
    conn.ensure_connection(max_retries=3)
    print("✅ Celery broker reachable.")
except Exception as e:
    print(f"❌ Celery broker unreachable: {e}")

#app = FastAPI()
app = FastAPI(title="EcomCRM")
nlu = NLU()

app.include_router(orders.router, prefix="/api")     
#app.include_router(products_router.router, prefix="/api")
app.include_router(product_voice_router.router, prefix="/api")
app.include_router(order_history_voice_router.router, prefix="/api") 
app.include_router(order_voice.router, prefix="/api") 
app.include_router(product_voice_v2_router)
app.include_router(product_detail_router, prefix="/api")
app.include_router(opp_router, prefix="/api")
app.include_router(opportunity_metadata_router, prefix="/api")
app.include_router(opp_auto_router)

class QueryRequest(BaseModel):
    query: str

# CORS for Angular
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],
    #allow_origins=["https://angular-demo.local"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

#SOLR_URL = "https://35.223.69.124:8983/solr/mproducts/select"
SOLR_URL = "https://localhost:8983/solr/products/select"

# Requests session ignoring SSL
session = requests.Session()
session.verify = False

# Initialize Solr
solr = pysolr.Solr(SOLR_URL, always_commit=True, timeout=10, session=session)

@app.get("/")
def read_root():
    return {"message": "EcomCRM running!"}

@app.options("/check")
async def options_handler():
    return Response(status_code=204)

@app.get("/schema")
def get_solr_schema():
    session = requests.Session()
    session.verify = False
    resp = session.get("https://localhost:8983/solr/products/schema/fields").json()
    return [f["name"] for f in resp.get("fields", [])]


#async def query_endpoint(req: QueryRequest, request: Request,x_account_id: str = Header(..., description="Account identifier header")):
@app.post("/query")
async def query_endpoint(payload: QueryRequest, request: Request):
    text = payload.query
    text_lower = text.lower()

    # --- run NLU ---
    intent, confidence = nlu.classify_intent(text)  # your existing call
    entities = nlu.extract_entities(text)           # now includes account_id/account_partial

    # Determine user type (current rule you gave):
    # superuser=true will tell and accountid will tell he is customer for now
    header_super = request.headers.get("X-SUPER-USER", "").lower() == "true"
    header_account = request.headers.get("X-ACCOUNT-ID")
    is_super_user = header_super or ("super_user" in text_lower)  # keep simple; your choice earlier
    is_customer = bool(header_account) and not is_super_user

    # -----------------------------
    # ✅ CUSTOMER-SAFE OVERRIDE LOGIC
    # -----------------------------
    # If we have a clear account_id entity, DO NOT override to view_all_orders
    if entities.get("account_id"):
        intent = "view_orders"

    # If no account_id and user is NOT a super user, handle clarification flow
    if not is_super_user and not entities.get("account_id"):
        # If we heard account context but it was partial, ask to repeat
        if entities.get("account_partial"):
            key = _client_key(request)
            _ACCOUNT_RETRY[key] = _ACCOUNT_RETRY.get(key, 0) + 1

            if _ACCOUNT_RETRY[key] >= MAX_ACCOUNT_RETRIES:
                # reset counter and ask to type for security
                _ACCOUNT_RETRY[key] = 0
                return {
                    "intent": "clarify_account",
                    "message": "I couldn’t catch your full account ID. For your security, please type it in the account_id box.",
                    "retryCount": MAX_ACCOUNT_RETRIES
                }
            else:
                return {
                    "intent": "clarify_account",
                    "message": "Please say the full account ID, for example: A C C one zero two seven.",
                    "retryCount": _ACCOUNT_RETRY[key]
                }

        # No account context at all → treat as customer's own orders only if header present
        if header_account:
            entities["account_id"] = header_account
            intent = "view_orders"
        else:
            # Do NOT fall back to all orders for a customer (privacy)
            return {
                "intent": "clarify_account",
                "message": "Please say or type your account ID to continue.",
                "retryCount": 1
            }

    # -----------------------------
    # ✅ SUPER USER OVERRIDE (unchanged)
    # -----------------------------
    if is_super_user and ("all" in text_lower or intent in {"view_all_orders", "view_orders"} and not entities.get("account_id")):
        intent = "view_all_orders"

    # --- route to orders ---
    if intent == "view_orders" and entities.get("account_id"):
        acc = entities["account_id"]
        result = await get_orders_with_products(account_id=acc, is_super_user=False, page=1, pageSize=20)
        # clear retry state on success
        _ACCOUNT_RETRY[_client_key(request)] = 0
        return {
            "intent": "view_orders",
            "confidence": float(confidence),
            "entities": entities,
            "count": result.get("numFound", 0),
            "results": result
        }

    if intent == "view_all_orders" and is_super_user:
        result = await get_orders_with_products(account_id=None, is_super_user=True, page=1, pageSize=20)
        return {
            "intent": "view_all_orders",
            "confidence": float(confidence),
            "entities": entities,
            "count": result.get("numFound", 0),
            "results": result
        }

    # Fallback
    return {
        "intent": intent,
        "confidence": float(confidence),
        "entities": entities,
        "message": "I can help with order history. Please provide an account ID or say 'show all orders' if you are an admin."
    }


@app.post("/refresh-cache")
def refresh_cache():
    """Clear and reload Solr attribute cache"""
    try:
        clear_cache()
        fresh = load_facet_values(force_refresh=True)
        return {"status": "refreshed", "counts": {k: len(v) for k, v in fresh.items()}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to refresh cache: {str(e)}")
