Test all these:
"show me Bosch" → search_by_brand
"filter by color red" → search_by_color
"under 200" → search_by_price
"find" or "get all products" → search_all
“Show me Hitachi products”
“Show me Iron tools”
“Show me Red items”	
“Show me Workshop Tools”
show me power tools
I want hand tools
find all tools
“show me two drills”
“find four inch tile”
“model zero one”


(base) e221137@remtabgljgy84 solrcloud % pwd
/Users/e221137/Official/personal/Demo/DemoAI/solrcloud

##### if image exist stop and remove commands#####
docker stop solr9
docker rm solr9
docker rmi solr:9.7
chmod +x docker-compose.yml
docker ps -a
#######################

mkdir clusterprops
mkdir clusterprops
mkdir security
cat > filename.txt
cat > clusterprops/clusterprops.json
cat > security/security.json
mkdir ssl
cd ssl
keytool -genkeypair -alias solr-ssl -keyalg RSA -keysize 2048 -storetype PKCS12 -keystore solr-ssl.keystore.p12 -validity 3650 -storepass secret -dname "CN=localhost, OU=IT, O=MyCompany, L=Kennesaw, ST=GA, C=US" 
Generating 2,048 bit RSA key pair and self-signed certificate (SHA256withRSA) with a validity of 3,650 days
	for: CN=localhost, OU=IT, O=MyCompany, L=Kennesaw, ST=GA, C=US
	
Generate a new certificate with the hostname you want
If you want to use solr1.local or other hostnames in production, create a new cert with CN=solr1.local and SANs for all hostnames you’ll use. Example with OpenSSL:
keytool -genkeypair -alias solr-ssl -keyalg RSA -keysize 2048 -storetype PKCS12 -keystore solr-ssl.keystore.p12 -validity 3650 -storepass secret -keypass secret -dname "CN=solr1.local, OU=IT, O=MyCompany, L=Kennesaw, ST=GA, C=US" -ext "SAN=dns:solr1.local,dns:solr2.local,dns:localhost"


docker stop zookeeper1 zookeeper2 zookeeper3
docker compose restart zookeeper1 zookeeper2 zookeeper3
docker compose restart solr1 solr2
docker rm zookeeper1 zookeeper2 zookeeper3
docker network rm solrcloud-net

docker-compose down -v 
docker build --no-cache -t solr-custom-minimalv1:9.6 .         ##### use this for custom image
docker-compose up -d --build 					  ##### Execute this 
#docker run -it --rm -p 8983:8983 -e ZK_HOST="zookeeper1:2181,zookeeper2:2181,zookeeper3:2181" -e SOLR_USER=solr -e SOLR_PASS=SolrRocks solr-custom-minimalv1:9.6
docker-compose logs -f
##########################
docker logs zookeeper1 | grep clientPort
(base) e221137@dgslap5psmdw3 solrcloud % docker exec -it zookeeper1 zkServer.sh status
(base) e221137@dgslap5psmdw3 solrcloud % docker exec -it zookeeper1 zkCli.sh -server zookeeper1:2181
docker exec -it solr1 bin/solr zk ls / -z zookeeper1:2181,zookeeper2:2181,zookeeper3:2181 - List files in Zookeeper node

###################################
docker exec -it solr1 bin/solr auth disable -z zookeeper1:2181,zookeeper2:2181,zookeeper3:2181  - Disable security
Re-enable BasicAuth with your desired credentials
docker exec -it solr1 bin/solr auth enable -type basicAuth -credentials solr:SolrRocks -z zookeeper1:2181,zookeeper2:2181,zookeeper3:2181
docker restart solr1 solr2
curl --insecure -u solr:SolrRocks "https://localhost:8983/solr/admin/collections?action=LIST&wt=json"   - TEST
####################

####Clean all Docker########
docker-compose down
docker volume ls
docker volume prune -f
docker rmi solr:9.6 zookeeper:3.6.3
docker-compose down
rm -rf ./solr-data/solr1
rm -rf ./solr-data/solr2
rm -rf ./zookeeper1/data ./zookeeper1/datalog
rm -rf ./zookeeper2/data ./zookeeper2/datalog
rm -rf ./zookeeper3/data ./zookeeper3/datalog
docker-compose up --build

####Clean all Docker Ends########

Run the test inside the ZooKeeper container
docker exec -it zookeeper1 bash
docker exec -it solr1 bash
echo ruok | nc localhost 2181


## ✅ Let's Troubleshoot It Step-by-Step

### 🔍 Step 1: Reconfirm the Docker network setup
docker network inspect solrcloud-net
Look under the `"Containers"` section. You **must see** these:
* `solr1`
* `solr2`
* `zookeeper1`
* `zookeeper2`
* `zookeeper3`
### 🧪 Step 2: Manual test from inside `solr1`
Try connecting manually from inside the Solr container to ZK:
docker exec -it --user root solr1 bash
apt update && apt install -y netcat
nc -zv zookeeper1 2181
nc -zv zookeeper2 2181
nc -zv zookeeper3 2181
Expected output:
Connection to zookeeper1 2181 port [tcp/*] succeeded!
### 🔎 Step 3: Check ZooKeeper logs
Look for these log entries in **each ZooKeeper container** (`zookeeper1`, etc.):
docker logs zookeeper1
You should see something like:
binding to port 0.0.0.0/0.0.0.0:2181
If ZooKeeper is not binding to the client port (`2181`), then the issue could be misconfiguration (e.g., the `ZOO_SERVERS` line or `ZOO_MY_ID` might be wrong).
### ✅ Step 4: Check `ZOO_MY_ID` and `ZOO_SERVERS` match
Each ZK container must have:
* A unique `ZOO_MY_ID` (1, 2, 3)
* The **same** `ZOO_SERVERS` across all 3
You currently have:
```yaml
ZOO_SERVERS: server.1=zookeeper1:2888:3888 server.2=zookeeper2:2888:3888 server.3=zookeeper3:2888:3888
✅ That’s correct and should work — as long as they are all on the same Docker network.
### 📌 Step 5: Check if volumes are corrupted (rare but possible)
Sometimes, leftover data in the `zk-data` or `zk-log` folders causes issues. Try wiping all ZK state **just once**:
docker-compose down -v
rm -rf zk-data/* zk-log/*
docker-compose up -d --build
⚠️ Warning: This clears all persisted ZooKeeper state — but it’s safe for fresh setups.
## ✅ Summary

| Check                              | Command                                                         |
| ---------------------------------- | --------------------------------------------------------------- |
| 🧠 All containers in same network? | `docker network inspect solrcloud-net`                          |
| 🔌 Solr can reach ZooKeeper?       | `docker exec -it solr1 bash && nc -zv zookeeper1 2181`          |
| 📄 ZooKeeper logs show listening?  | `docker logs zookeeper1`                                        |
| 🧼 Clean up state & retry          | `docker-compose down -v && rm -rf zk-* && docker-compose up -d` |
Let me know what results you get from the `netcat` (`nc -zv`) test and Docker network inspect — those will confirm where the problem really is.

###############Queries##########
Verify data presence
curl --insecure -u solr:SolrRocks "https://localhost:8983/solr/products/select?q=*:*&fl=id,name,brand,price&rows=5&wt=json&indent=true"
curl -X POST -u solr:SolrRocks http://localhost:8000/query -H "Content-Type: application/json" -d '{"query": "show me Bosch drill under 200"}'
curl --insecure -u solr:SolrRocks "https://localhost:8983/solr/products/select?q=_text_:(Bosch drill)&fq=price:[* TO 200]&wt=json&indent=true"
curl -X POST -u solr:SolrRocks http://localhost:8000/query -H "Content-Type: application/json" -d '{"query": "show me Bosch drill under 200"}'
curl --insecure -u solr:SolrRocks "https://localhost:8983/solr/products/select?q=_text_:(Bosch%20drill)&fq=price:[*%20TO%20200]&wt=json&indent=true"
curl --insecure -u solr:SolrRocks "https://localhost:8983/solr/products/select?q=bosch+drill+red&fl=id,name,brand,price&rows=5&wt=json&indent=true"
curl --insecure -u solr:SolrRocks "https://localhost:8983/solr/products/schema/fields?wt=json" | jq '.fields[] | select(.name=="search_text")'
curl --insecure -u solr:SolrRocks "https://localhost:8983/solr/products/select?q=id:1001&fl=id,name,brand,search_text&wt=json&indent=true"
curl -X POST -u solr:SolrRocks http://localhost:8000/query -H "Content-Type: application/json" -d '{"query": "show me all the products"}'
################Queries##########
################Download configset##############
e221137@remtabgljgy84 solrcloud % docker exec -it solr1 bash
solr@solr1:/opt/solr-9.6.1$ bin/solr zk downconfig -n _default -d /tmp -z zookeeper1:2181
exit
e221137@remtabgljgy84 solrcloud % docker ps
e221137@remtabgljgy84 solrcloud % docker cp solr1:/tmp/conf /Users/e221137/Official/personal/Demo/DemoAI/solrcloud
Successfully copied 221kB to /Users/e221137/Official/personal/Demo/DemoAI/solrcloud

Zip the configset to import (cloud only)
(cd _default/conf && zip -r - *) > _default.zip
################Download configset##############
 <!-- ============================================= -->
<!--Fuzzy, Synonym-aware Search Field Type 
    | Component                     | Purpose                                                                   |
| ----------------------------- | ------------------------------------------------------------------------- |
| **SynonymGraphFilterFactory** | Handles words like “fetch”, “get”, “show”, “display” → all map to “show”. |
| **PorterStemFilterFactory**   | Matches plural/singular and tenses (“shows”, “showing”, “showed”).        |
| **FuzzyQueryFactory**         | Allows fuzzy matches for voice typos (“Bossh” → “Bosch”).                 |
| **copyField → search_text**   | Combines all relevant attributes into one search vector.                  |
| **text_fuzzy**                | Field type that supports synonyms + stemming + fuzziness.                 |
-->
<!-- ============================================= -->

