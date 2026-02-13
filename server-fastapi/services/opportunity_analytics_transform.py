from datetime import date, datetime
import logging

# -------------------------------------------------
# Logger setup (simple + demo friendly)
# -------------------------------------------------
logger = logging.getLogger("opportunity_analytics")
logger.setLevel(logging.INFO)

if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter(
        "[%(levelname)s][%(name)s] %(message)s"
    )
    handler.setFormatter(formatter)
    logger.addHandler(handler)


# -------------------------------------------------
# Date helpers
# -------------------------------------------------
def _to_date(val):
    """Normalize datetime → date safely."""
    if val is None:
        return None
    if isinstance(val, datetime):
        return val.date()
    if isinstance(val, date):
        return val
    return None


from datetime import datetime, date

def solr_safe(val):
    if val is None:
        return None

    # Full datetime
    if isinstance(val, datetime):
        return val.strftime("%Y-%m-%dT%H:%M:%SZ")

    # Date only → convert to midnight UTC
    if isinstance(val, date):
        return val.strftime("%Y-%m-%dT00:00:00Z")

    return val



def days_between(d1, d2):
    d1 = _to_date(d1)
    d2 = _to_date(d2)

    if not d1 or not d2:
        return None

    return (d2 - d1).days


# -------------------------------------------------
# Risk logic
# -------------------------------------------------
def risk_flag(last_activity, next_activity):
    today = date.today()

    last_activity = _to_date(last_activity)
    next_activity = _to_date(next_activity)

    if last_activity and (today - last_activity).days > 30:
        return "RED", "No activity in last 30 days"

    if next_activity and next_activity < today:
        return "RED", "Follow-up overdue"

    return "GREEN", "Recent activity"


# -------------------------------------------------
# Main transformer
# -------------------------------------------------
def transform_opportunity(row: dict) -> dict:
    """
    Transform a MySQL opportunity row into a Solr-ready analytics document.
    """

    try:
        today = date.today()

        last_activity = row.get("last_activity_date")
        next_activity = row.get("next_activity_date")
        expected_close = row.get("expected_close_date")

        risk, reason = risk_flag(last_activity, next_activity)

        doc = {
            "id": f"OPP-{row['opportunity_id']}",

            # Core identifiers
            "opportunity_id": row["opportunity_id"],
            "opportunity_name": row["opportunity_name"],
            "account_id": row["account_id"],
            "account_name": row.get("account_name"),
            "industry": row.get("industry"),
            "primary_contact_name": row.get("primary_contact_name"),
            "owner_id": row["owner_id"],

            # Status
            "stage": row["stage"],
            "status": row["status"],
            "is_closed": row["is_closed"],
            "is_won": row["is_won"],

            # Financials
            "amount": float(row["amount"] or 0),
            "currency": row.get("currency"),
            "probability": float(row["probability"] or 0),
            "expected_revenue": float(row["amount"] or 0)
                * float(row["probability"] or 0) / 100,

            # Dates (Solr safe)
            "expected_close_date": solr_safe(expected_close),
            "close_date": solr_safe(row.get("close_date")),
            "last_activity_date": solr_safe(last_activity),
            "next_activity_date": solr_safe(next_activity),
            "created_at": solr_safe(row.get("created_at")),
            "updated_at": solr_safe(row.get("updated_at")),

            # Analytics
            "days_since_last_activity": days_between(last_activity, today),
            "days_to_close": days_between(today, expected_close),
            "risk_flag": risk,
            "risk_reason": reason,
            "next_step": row.get("next_step"),

            # Time buckets
            "close_month": expected_close.strftime("%Y-%m")
                if expected_close else None,
            "close_quarter": (
                f"{expected_close.year}-Q{((expected_close.month - 1) // 3) + 1}"
                if expected_close else None
            ),
            "close_year": str(expected_close.year)
                if expected_close else None,
        }

        logger.info(
            "Transformed opportunity %s (risk=%s, stage=%s)",
            doc["id"],
            risk,
            doc["stage"]
        )

        return doc

    except Exception as e:
        logger.exception(
            "Failed to transform opportunity_id=%s",
            row.get("opportunity_id")
        )
        raise
