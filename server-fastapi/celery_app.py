# celery_app.py

from celery import Celery
import os, sys

# Ensure project root is in sys.path (so 'tasks' can be imported)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.append(BASE_DIR)

celery_app = Celery(
    "openvoice360",
    broker="redis://localhost:6379/0",
    backend="redis://localhost:6379/0"
)

# Register your task modules here
celery_app.autodiscover_tasks(["tasks"])

# Optional but good for debug
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="America/New_York",
    enable_utc=True,
)

# --- Explicit import fix ---
try:
    import tasks.order_indexer
    print("Imported tasks.order_indexer successfully.")
except Exception as e:
    print(f" Failed to import tasks.order_indexer: {e}")

celery_app.autodiscover_tasks(['tasks'])

if __name__ == "__main__":
    celery_app.start()