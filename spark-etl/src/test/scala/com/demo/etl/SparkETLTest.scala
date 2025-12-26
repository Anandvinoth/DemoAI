package com.demo.etl

import org.scalatest.funsuite.AnyFunSuite

class SparkETLTest extends AnyFunSuite {
  test("Main ETL should complete without crash") {
    noException should be thrownBy {
      SparkETL.main(Array())
    }
  }
}
