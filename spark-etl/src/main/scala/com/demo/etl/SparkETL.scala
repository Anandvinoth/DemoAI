package com.demo.etl

import org.apache.spark.sql.SparkSession

object SparkETL {

  def main(args: Array[String]): Unit = {

    // -------- CONFIG --------
    val solrUrlBase = "https://localhost:8983/solr"
    val collectionName = "products"
    val solrUser = "solr"
    val solrPass = "SolrRocks"
    val csvPath = "data/products.csv"

    // -------- SPARK SESSION --------
    val spark = SparkSession.builder()
      .appName("Solr Data Loader")
      .master("local[*]")
      .config("spark.driver.bindAddress", "127.0.0.1")
      .config("spark.driver.host", "127.0.0.1")
      .getOrCreate()

    println(" Spark session started")

    // -------- LOAD DATA --------
    val df = spark.read.option("header", "true").option("inferSchema", "true").csv(csvPath)
    println(s" Loaded ${df.count()} records from $csvPath")
    df.printSchema()

    // -------- INDEX ONLY --------
    SolrIndexer.indexData(df, solrUrlBase, collectionName, solrUser, solrPass)

    println("✨ Data successfully loaded into Solr.")
    spark.stop()
  }
}
