#!/bin/sh
set -e

# ---- Config ----
ZK_HOST=${ZK_HOST:-zookeeper1:2181,zookeeper2:2181,zookeeper3:2181}
CONFIGSET_NAME="_default"
CONFIGSET_DIR="/opt/solr/server/solr/configsets/${CONFIGSET_NAME}"
COLLECTION_NAME="test"
NUM_SHARDS=${NUM_SHARDS:-1}
REPLICATION_FACTOR=${REPLICATION_FACTOR:-1}
SOLR_USER=${SOLR_USER:-solr}
SOLR_PASS=${SOLR_PASS:-SolrRocks}
SOLR_HOST=${SOLR_HOST:-0.0.0.0:8983}
MARKER_FILE="/var/solr/data/.initialized"

# ---- Ensure Solr home exists ----
mkdir -p /var/solr/data
chown solr:solr /var/solr/data

# ---- Start Solr in background ----
echo "Starting Solr in background..."
solr -cloud -z "$ZK_HOST" -f &

# ---- Wait for ZooKeeper ensemble ----
echo "Waiting for ZooKeeper ensemble..."
for zk in $(echo $ZK_HOST | tr ',' ' '); do
  host=$(echo $zk | cut -d: -f1)
  port=$(echo $zk | cut -d: -f2)
  until nc -z "$host" "$port"; do
    echo "ZooKeeper $host:$port not ready yet..."
    sleep 2
  done
done
echo "ZooKeeper ensemble is up."

# ---- One-time setup ----
if [ ! -f "$MARKER_FILE" ]; then
  echo "First-time Solr setup detected."

  # ---- Upload security.json ----
  if [ -f "/var/solr/data/security.json" ]; then
    echo "Uploading security.json to ZooKeeper..."
    bin/solr zk cp file:/var/solr/data/security.json zk:/security.json -z "$ZK_HOST" -force
    echo "security.json uploaded successfully."
  fi

  # ---- Upload clusterprops.json ----
  if [ -f "/var/solr/data/clusterprops.json" ]; then
    echo "Uploading clusterprops.json to ZooKeeper..."
    bin/solr zk cp file:/var/solr/data/clusterprops.json zk:/clusterprops.json -z "$ZK_HOST" -force
    echo "clusterprops.json uploaded successfully."
  fi

  # ---- Upload configset if exists ----
  if [ -d "$CONFIGSET_DIR" ]; then
    echo "Uploading configset '$CONFIGSET_NAME'..."
    bin/solr zk upconfig -n "$CONFIGSET_NAME" -z "$ZK_HOST" -d "$CONFIGSET_DIR" -force
    echo "Configset uploaded successfully."
  fi

  touch "$MARKER_FILE"
else
  echo "Solr already initialized. Skipping one-time setup."
fi

# ---- Wait for Solr API with auth enabled ----
HOST=$(echo "$SOLR_HOST" | cut -d: -f1)
PORT=$(echo "$SOLR_HOST" | cut -s -d: -f2)
PORT=${PORT:-8983}

echo "Waiting for Solr API at https://${HOST}:${PORT}..."
MAX_RETRIES=60
RETRIES=0
until curl --silent --insecure -u "$SOLR_USER:$SOLR_PASS" "https://${HOST}:${PORT}/solr/admin/info/system" >/dev/null 2>&1; do
  echo "Solr API not ready yet..."
  RETRIES=$((RETRIES+1))
  [ $RETRIES -ge $MAX_RETRIES ] && echo "ERROR: Solr API didn't respond" && exit 1
  sleep 2
done
echo "Solr API is up at https://${HOST}:${PORT}"

# ---- Enable Basic Auth if not already ----
AUTH_CHECK=$(curl --silent --insecure -u "$SOLR_USER:$SOLR_PASS" "https://${HOST}:${PORT}/solr/admin/authentication?wt=json" | grep -o 'basic')
if [ -z "$AUTH_CHECK" ]; then
  echo "Enabling Basic Auth..."
  bin/solr auth enable -type basicAuth -credentials "$SOLR_USER:$SOLR_PASS" -z "$ZK_HOST"
  echo "Basic Auth enabled."
fi

# ---- Auto-create collection if missing ----
echo "Checking for collection '$COLLECTION_NAME'..."
COLLECTIONS=$(curl --silent --insecure -u "$SOLR_USER:$SOLR_PASS" "https://${HOST}:${PORT}/solr/admin/collections?action=LIST&wt=json")
if echo "$COLLECTIONS" | grep -o "\"${COLLECTION_NAME}\"" >/dev/null; then
  echo "Collection '$COLLECTION_NAME' already exists."
else
  echo "Creating collection '$COLLECTION_NAME'..."
  CREATE_URL="https://${HOST}:${PORT}/solr/admin/collections?action=CREATE&name=${COLLECTION_NAME}&numShards=${NUM_SHARDS}&replicationFactor=${REPLICATION_FACTOR}&collection.configName=${CONFIGSET_NAME}&wt=json&maxShardsPerNode=1"
  curl --silent --insecure -u "$SOLR_USER:$SOLR_PASS" "$CREATE_URL" || echo "ERROR: Failed to create collection '$COLLECTION_NAME'"
  echo "Collection '$COLLECTION_NAME' created successfully."
fi

# ---- Keep container running ----
wait
