import requests

SOLR_URL = "https://localhost:8983/solr/opportunity_analytics/update?commit=true"

def index_to_solr(docs: list):
    if not docs:
        return 0

    # resp = requests.post(SOLR_URL, json=docs, timeout=30)
    resp = requests.post(
        SOLR_URL,
        json=docs,
        auth=("solr", "SolrRocks"),
        verify=False,
        timeout=30
    )
    print("Solr status:", resp.status_code)
    print("Solr response:", resp.text)
    resp.raise_for_status()
    return len(docs)
