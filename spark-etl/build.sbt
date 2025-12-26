name := "SolrSparkETL"
version := "1.0"
scalaVersion := "2.13.14"

libraryDependencies ++= Seq(
  // 🔹 Apache Spark (core + SQL)
  "org.apache.spark" %% "spark-core" % "4.0.1" % "provided",
  "org.apache.spark" %% "spark-sql"  % "4.0.1" % "provided",
    
  // 🔹 Apache HTTP Client 5.x (for Solr HTTPS)
  "org.apache.httpcomponents.client5" % "httpclient5" % "5.3.1",
    
  // 🔹 JSON parsing (Play JSON used by your SchemaSync, SolrIndexer, Util)
  "com.typesafe.play" %% "play-json" % "2.10.5"
)

assembly / mainClass := Some("com.demo.etl.SparkETL")

assemblyMergeStrategy in assembly := {
  case PathList("META-INF", xs @ _*) => MergeStrategy.discard
  case _ => MergeStrategy.first
}
