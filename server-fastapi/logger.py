# logger.py
import logging
from logging.handlers import RotatingFileHandler
import os
from datetime import datetime
import json

# Constants
LOG_FILE = "solr_debug.log"
MAX_BYTES = 5 * 1024 * 1024  # 5MB per file
BACKUP_COUNT = 3  # Keep last 3 log files

# Set up logger
logger = logging.getLogger("solrLogger")
logger.setLevel(logging.INFO)

# Ensure only one handler is added
if not logger.hasHandlers():
    handler = RotatingFileHandler(LOG_FILE, maxBytes=MAX_BYTES, backupCount=BACKUP_COUNT)
    formatter = logging.Formatter('[%(asctime)s] %(levelname)s - %(message)s')
    handler.setFormatter(formatter)
    logger.addHandler(handler)


def log_solr_request_response(url: str, params: dict, response: dict):
    """
    Logs Solr request/response in a structured way.
    """

    # Build log record
    log_data = {
        "timestamp": datetime.now().isoformat(),
        "solr_url": url,
        "params": params,
        "response_summary": {
            "numFound": response.get("response", {}).get("numFound", 0),
            "docs_sample": response.get("response", {}).get("docs", [])[:2],
            "facet_fields": response.get("facet_counts", {}).get("facet_fields", {})
        }
    }

    logger.info(json.dumps(log_data, indent=2))
