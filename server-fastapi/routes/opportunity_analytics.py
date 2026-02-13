from fastapi import APIRouter
from services.opportunity_analytics_mysql import fetch_opportunity_analytics_rows
from services.opportunity_analytics_transform import transform_opportunity
from services.opportunity_analytics_solr import index_to_solr

router = APIRouter(prefix="/api/analytics", tags=["Opportunity Analytics"])

@router.post("/index/opportunities")
def index_opportunity_analytics():
    rows = fetch_opportunity_analytics_rows()
    docs = [transform_opportunity(r) for r in rows]
    count = index_to_solr(docs)

    return {
        "indexed": count,
        "collection": "opportunity_analytics"
    }
