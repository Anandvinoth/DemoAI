package com.demo.etl

import org.apache.spark.sql.SparkSession
import org.scalatest.funsuite.AnyFunSuite

class SchemaSyncTest extends AnyFunSuite {
  val spark = SparkSession.builder().master("local[*]").appName("SchemaSyncTest").getOrCreate()

  test("syncWithSolr should detect new fields") {
    import spark.implicits._
    val df = Seq((1, "TestProduct")).toDF("id", "name")
    noException should be thrownBy {
      SchemaSync.syncWithSolr("https://localhost:8983/solr", "products", df, "solr", "SolrRocks")
    }
  }
}
