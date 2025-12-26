package com.demo.etl

import org.apache.spark.sql.DataFrame
import play.api.libs.json._
import com.demo.etl.Util._

object SolrIndexer {
  def indexData(df: DataFrame, solrUrl: String, collection: String, user: String, pass: String): Unit = {
    val updateUrl = s"$solrUrl/$collection/update?commit=true"
    val jsonDocs = df.toJSON.collect().grouped(100).toSeq
    var total = 0

    println(s"Indexing ${df.count()} documents into Solr collection: $collection ...")

    jsonDocs.zipWithIndex.foreach { case (batch, idx) =>
      val jsonArray = Json.parse("[" + batch.mkString(",") + "]")
      httpPostJson(updateUrl, jsonArray, user, pass)
      total += batch.size
      println(f"📈 Batch ${idx + 1}/${jsonDocs.size} complete – total indexed: $total")
    }

    println(s"Finished indexing $total documents to Solr collection: $collection.")
  }
}
