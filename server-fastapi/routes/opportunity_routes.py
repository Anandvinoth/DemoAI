# routes/opportunities.py
from fastapi import APIRouter, HTTPException
from model.opportunity import OpportunityCreate
from services.opportunity_service import create_opportunity, list_opportunities

router = APIRouter(prefix="/api/opportunities", tags=["CRM Opportunities"])

@router.post("/create")
async def create_opportunity_api(data: OpportunityCreate):
    result = await create_opportunity(data)
    if result.get("status") == "error":
        raise HTTPException(status_code=500, detail=result["message"])
    return result


@router.get("/list")
async def get_all_opportunities():
    result = await list_opportunities()
    return result
