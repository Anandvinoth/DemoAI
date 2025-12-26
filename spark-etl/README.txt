Minimal project layout

| Step                     | Class                               | Purpose                                                                      |
| ------------------------ | ----------------------------------- | ---------------------------------------------------------------------------- |
| **1. Extract & Load**    | `SparkETL`                          | Reads data (CSV/JSON, etc.) into Spark DataFrame                             |
| **2. Transform**         | (inside `SparkETL` or other helper) | Cleans / enriches / normalizes data                                          |
| **3. Schema Management** | `SchemaSync`                        | Compares DataFrame schema to Solr schema and adds missing fields dynamically |
| **4. Index to Solr**     | ✅ **`SolrIndexer`**                 | Converts rows to JSON and pushes batches to Solr `/update` API securely      |
| **5. Utility support**   | `Util`                              | Handles HTTP requests, authentication, JSON operations                       |

SparkETL — orchestrator (read, transform, call SchemaSync, then SolrIndexer)
SchemaSync — auto-creates missing Solr fields
SolrIndexer — actually posts the data to Solr
Util — common HTTP utilities

SparkETL.scala
   ├── Reads CSV into DataFrame
   ├── calls SchemaSync.ensureSchema()  → adds new Solr fields dynamically
   ├── calls SolrIndexer.indexData()    → posts batches of data to Solr
   └── stops Spark


spark-etl/
├── build.sbt
├── src/main/scala/com/demo/etl/
│   ├── SparkETL.scala          # entrypoint: read → transform → schema sync → index
│   ├── SchemaSync.scala        # inspects Spark schema and adds missing fields in Solr
│   ├── SolrIndexer.scala       # batches docs and POSTs to Solr /update
│   └── Util.scala              # tiny helpers (HTTP auth, JSON, id creation)
└── data/
    ├── products.csv            # demo source
    └── sales.json



brew install sbt
sbt sbtVersion
Install Apache Spark on macOS:
    brew install apache-spark
    spark-submit --version
    export SPARK_HOME=/opt/homebrew/opt/apache-spark/libexec
    export PATH=$SPARK_HOME/bin:$PATH
    source ~/.zshrc

Compile your project
    cd spark-etl
    sbt reload
    sbt clean compile
    sbt clean assembly
    (base) e221137@remtabgljgy84 spark-etl % curl -k -u solr:SolrRocks "https://localhost:8983/solr/admin/collections?action=LIST"
    Run the Spark Job:
    spark-submit --class com.demo.etl.SparkETL --master "local[*]" target/scala-2.13/SolrSparkETL-assembly-1.0.jar

    
    ###############ERROR:
    java.net.BindException: Can't assign requested address: Service 'sparkDriver' failed after 16 retries
    That means the Spark driver can’t bind to a local port.
    It’s common on macOS with VPNs, firewalls, or IPv6-only adapters.
    spark-submit --class com.demo.etl.SparkETL --master "local[*]" --conf spark.driver.host=127.0.0.1 target/scala-2.12/SolrSparkETL-assembly-1.0.jar
    ###############ERROR:

Run
To execute the ETL (Spark + Solr):
    sbt "runMain com.demo.etl.SparkETL"
    
    
   
https://localhost:8983/solr/#/products/query?q=*:*&q.op=OR&indent=true&sort=id%20asc&useParams=
#####################TESTING:#####################
Directory layout

spark-etl/
└── src/test/scala/com/demo/etl/
    ├── UtilTest.scala
    ├── SchemaSyncTest.scala
    ├── SolrIndexerTest.scala
    └── SparkETLTest.scala

Run Test :
    sbt test
run a single test:
    sbt "testOnly *UtilTest"
    
| Class               | Test Purpose                         |
| ------------------- | ------------------------------------ |
| **UtilTest**        | Verifies HTTP helper works safely    |
| **SchemaSyncTest**  | Checks Solr schema sync logic        |
| **SolrIndexerTest** | Tests batch indexing flow            |
| **SparkETLTest**    | Ensures main pipeline does not crash |

#####################TESTING:#####################

TODO:
extend SchemaSync next so it automatically adds missing fields whenever new columns appear in your data?
