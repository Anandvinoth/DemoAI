# tasks/order_indexer.py
from celery_app import celery_app
import mysql.connector
import requests, json, datetime, decimal

# ----------------------
# JSON Safe Serializer
# ----------------------
def default_serializer(obj):
    if isinstance(obj, (datetime.date, datetime.datetime)):
        return obj.isoformat()
    if isinstance(obj, decimal.Decimal):
        return float(obj)
    return str(obj)

# ----------------------
# Celery Task Definition
# ----------------------
@celery_app.task(name="tasks.order_indexer.index_order_in_solr")
def index_order_in_solr(order_id):
    """
    Fetch order details + items from MySQL and index as a single doc in Solr.
    """
    print(f"[Celery] 🔍 Fetching order {order_id} from MySQL...")

    try:
        # ---------------------- MySQL Connection ----------------------
        conn = mysql.connector.connect(
            host="localhost",
            user="sa",
            password="nimda",
            database="openvoice360"
        )
        cursor = conn.cursor(dictionary=True)

        # Fetch order_header
        cursor.execute("SELECT * FROM order_header WHERE order_id = %s", (order_id,))
        order_header = cursor.fetchone()

        if not order_header:
            print(f"[Celery] ⚠️ No order found for ID {order_id}")
            return

        # Fetch order_items
        cursor.execute("""
            SELECT quantity, unit_price, total_price
            FROM order_item WHERE order_id = %s
        """, (order_id,))
        order_items = cursor.fetchall()

        total_items = len(order_items)
        total_items_value = sum([float(item["total_price"]) for item in order_items]) if order_items else 0.0

        # ---------------------- Combine into one document ----------------------
        doc = {
            **order_header,  # merge header columns directly
            "total_items": total_items,
            "order_items_value": total_items_value,
        }

        # ---------------------- Solr Indexing ----------------------
        solr_url = "https://localhost:8983/solr/orderHistory/update?commitWithin=2000"

        payload = json.dumps([doc], default=default_serializer)

        response = requests.post(
            solr_url,
            data=payload,
            headers={"Content-Type": "application/json"},
            auth=("solr", "SolrRocks"),
            verify=False
        )

        if response.status_code == 200:
            print(f"[Celery] ✅ Indexed {order_id} successfully in Solr.")
        else:
            print(f"[Celery] ❌ Solr indexing failed ({response.status_code}): {response.text}")

    except Exception as e:
        print(f"[Celery] 🔥 Error during Solr indexing for {order_id}: {e}")

    finally:
        if conn.is_connected():
            cursor.close()
            conn.close()

