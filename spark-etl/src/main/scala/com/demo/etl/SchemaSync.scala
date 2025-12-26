package com.demo.etl

import org.apache.spark.sql.types._

object SchemaSync {

  /** 
    * Temporarily disable Solr schema creation.
    * Only log which fields exist and skip modifying schema.
    */
  def ensureSchema(solrUrl: String, collection: String, dfSchema: StructType, user: String, pass: String): Unit = {
    println(s"🧠 (SchemaSync skipped) – using existing Solr schema for collection: $collection")
    println("ℹ️  Fields detected in Spark DataFrame:")
    dfSchema.fields.foreach(f => println(s"   • ${f.name}: ${f.dataType.simpleString}"))
  }
}
