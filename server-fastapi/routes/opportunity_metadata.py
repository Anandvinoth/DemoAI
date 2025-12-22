# routes/opportunity_metadata.py
from fastapi import APIRouter

router = APIRouter(prefix="/opportunities", tags=["Opportunities Metadata"])

@router.get("/metadata")
def get_opportunity_metadata():
    """
    Static dropdown values for Opportunity Creation UI.
    """
    return {
        "stage": [
            "Prospecting",
            "Qualification",
            "Needs Analysis",
            "Value Proposition",
            "Proposal/Price Quote",
            "Negotiation/Review",
            "Closed Won",
            "Closed Lost"
        ],
        "status": [
            "Open",
            "Working",
            "Closed"
        ],
        "currency": [
            "USD",
            "CAD",
            "EUR"
        ],
        "forecast_category": [
            "Pipeline",
            "Best Case",
            "Commit",
            "Closed"
        ],
        "lead_source": [
            "Inbound",
            "Outbound",
            "Partner",
            "Website",
            "Referral"
        ],
        "priority": [
            "Low",
            "Medium",
            "High"
        ],
        "deal_type": [
            "New Business",
            "Existing Business",
            "Renewal",
            "Upsell"
        ],
        "pipeline_id": [
            "PL-SaaS-2025",
            "PL-Enterprise-2025",
            "PL-SMB-2025"
        ],
        "record_type": [
            "Sales Opportunity",
            "Renewal",
            "Upsell"
        ]
    }
