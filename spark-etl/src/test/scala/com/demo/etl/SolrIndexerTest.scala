package com.demo.etl

import org.apache.spark.sql.SparkSession
import org.scalatest.funsuite.AnyFunSuite

class SolrIndexerTest extends AnyFunSuite {
  val spark = SparkSession.builder().master("local[*]").appName("SolrIndexerTest").getOrCreate()
  import spark.implicits._

  test("indexData should run safely with dummy data") {
    val df = Seq(
      (1, "Widget", 10.5),
      (2, "Gadget", 20.0)
    ).toDF("id", "name", "price")

    noException should be thrownBy {
      SolrIndexer.indexData(df, "https://localhost:8983/solr", "products", "solr", "SolrRocks")
    }
  }
}
