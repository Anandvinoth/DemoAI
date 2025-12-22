from fastapi import APIRouter, Query
from services.opportunity_autocomplete_service import search_accounts, search_contacts

router = APIRouter(prefix="/api/opportunities", tags=["Opportunities – Autocomplete"])

@router.get("/search")
async def autocomplete(q: str = Query(..., min_length=1)):
    """
    Autocomplete for accounts + contacts.
    More types (owners, campaigns) can be added later.
    """

    accounts = await search_accounts(q)
    contacts = await search_contacts(q)

    return {
        "query": q,
        "accounts": accounts,
        "contacts": contacts
    }
