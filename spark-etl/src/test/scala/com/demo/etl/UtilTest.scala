package com.demo.etl

import org.scalatest.funsuite.AnyFunSuite
import play.api.libs.json.Json

class UtilTest extends AnyFunSuite {
  test("httpPostJson should not throw when posting dummy data") {
    noException should be thrownBy {
      Util.httpPostJson("https://httpbin.org/post", Json.obj("ping" -> "pong"), "user", "pass")
    }
  }
}
