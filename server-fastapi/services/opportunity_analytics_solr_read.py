import requests

SOLR_URL = "https://localhost:8983/solr/opportunity_analytics/select"
SOLR_AUTH = ("solr", "SolrRocks")

def fetch_opportunity_analytics(
    query="*:*",
    page=1,
    pageSize=20,
    filters=None,
    sort=None
):
    filters = filters or {}

    start = (page - 1) * pageSize

    params = {
        "q": query,
        "start": start,
        "rows": pageSize,
        "wt": "json"
    }

    # 🔹 Apply filters
    fqs = []
    for key, value in filters.items():
        if isinstance(value, list):
            fq = " OR ".join(f'{key}:"{v}"' for v in value)
            fqs.append(f"({fq})")
        else:
            fqs.append(f'{key}:"{value}"')

    if fqs:
        params["fq"] = fqs

    # 🔹 Sorting
    if sort:
        params["sort"] = sort

    print("[ANALYTICS-SOLR] Params:", params)

    resp = requests.get(
        SOLR_URL,
        params=params,
        auth=SOLR_AUTH,
        verify=False
    )

    resp.raise_for_status()
    data = resp.json()

    docs = data.get("response", {}).get("docs", [])
    total = data.get("response", {}).get("numFound", 0)

    return {
        "total": total,
        "page": page,
        "pageSize": pageSize,
        "data": docs
    }
