from fastapi import APIRouter, Body
from services.opportunity_analytics_solr_read import fetch_opportunity_analytics

router = APIRouter(prefix="/api/analytics", tags=["Opportunity Analytics"])

@router.post("/opportunities")
def get_opportunity_analytics(payload: dict = Body(...)):
    query = payload.get("query", "*:*")
    filters = payload.get("filters", {})
    page = payload.get("page", 1)
    pageSize = payload.get("pageSize", 20)
    sort = payload.get("sort")

    result = fetch_opportunity_analytics(
        query=query,
        page=page,
        pageSize=pageSize,
        filters=filters,
        sort=sort
    )

    return result
