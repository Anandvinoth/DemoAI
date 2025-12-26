package com.demo.etl

import org.apache.hc.client5.http.classic.methods.{HttpPost, HttpGet}
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient
import org.apache.hc.client5.http.impl.classic.HttpClients
import org.apache.hc.client5.http.ssl.NoopHostnameVerifier
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManagerBuilder
import org.apache.hc.client5.http.ssl.SSLConnectionSocketFactoryBuilder
import org.apache.hc.core5.http.io.entity.StringEntity
import org.apache.hc.core5.http.ContentType
import org.apache.hc.core5.ssl.SSLContexts
import javax.net.ssl.SSLContext
import java.nio.charset.StandardCharsets
import play.api.libs.json._

object Util {

  /** Build HTTP client that skips SSL verification for self-signed certs. */
  def buildInsecureHttpClient(): CloseableHttpClient = {
    val sslContext: SSLContext = SSLContexts.custom()
      .loadTrustMaterial(null, (_: Array[java.security.cert.X509Certificate], _: String) => true)
      .build()

    val sslSocketFactory = SSLConnectionSocketFactoryBuilder.create()
      .setSslContext(sslContext)
      .setHostnameVerifier(NoopHostnameVerifier.INSTANCE)
      .build()

    val connManager = PoolingHttpClientConnectionManagerBuilder.create()
      .setSSLSocketFactory(sslSocketFactory)
      .build()

    HttpClients.custom()
      .setConnectionManager(connManager)
      .build()
  }

  /** Generic JSON POST helper */
  def httpPostJson(url: String, body: JsValue, user: String, pass: String): Unit = {
    val httpClient = buildInsecureHttpClient()
    val post = new HttpPost(url)
    post.setHeader("Content-Type", "application/json")
    val auth = java.util.Base64.getEncoder.encodeToString(s"$user:$pass".getBytes(StandardCharsets.UTF_8))
    post.setHeader("Authorization", s"Basic $auth")
    post.setEntity(new StringEntity(Json.stringify(body), ContentType.APPLICATION_JSON))

    val response = httpClient.execute(post)
    val status = response.getCode
    val result = scala.io.Source.fromInputStream(response.getEntity.getContent).mkString
    println(s"🔗 Solr response ($status): $result")
    response.close()
    httpClient.close()
  }
    
  /** Generic JSON GET helper (with SSL trust-all) */
  def httpGetJson(url: String, user: String, pass: String): String = {
    val httpClient = buildInsecureHttpClient()
    val get = new org.apache.hc.client5.http.classic.methods.HttpGet(url)
    val auth = java.util.Base64.getEncoder.encodeToString(s"$user:$pass".getBytes(StandardCharsets.UTF_8))
    get.setHeader("Authorization", s"Basic $auth")
    get.setHeader("Accept", "application/json")

    val response = httpClient.execute(get)
    val entity = response.getEntity
    val result = scala.io.Source.fromInputStream(entity.getContent).mkString
    response.close()
    httpClient.close()
    result
  }

}
