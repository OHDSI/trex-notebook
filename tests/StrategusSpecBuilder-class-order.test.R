#!/usr/bin/env Rscript
# Regression test: module specifications carry their S3 class in Strategus'
# canonical order -- specific class first, base "ModuleSpecifications" second --
# e.g. c("CohortGeneratorModuleSpecifications", "ModuleSpecifications").
#
# S3 dispatch keys off class[1], and once the rD2E serializer emits attr_class
# the execution side reconstructs the class in this order; a reversed order
# (base first) would misdispatch. The builder previously produced base-first.
#
# WebR cannot run under the JS/vitest harness (needs a browser + workers), so
# this is covered here in a real R runtime instead.
#
# Run: Rscript tests/StrategusSpecBuilder-class-order.test.R   (base R; no WebR)

args <- commandArgs(FALSE)
this_file <- sub("^--file=", "", grep("^--file=", args, value = TRUE))
test_dir <- dirname(normalizePath(this_file))
source(file.path(test_dir, "..", "src", "kernels", "webr", "StrategusSpecBuilder.R"))

failures <- 0L
check <- function(desc, cond) {
  if (isTRUE(cond)) {
    cat("PASS: ", desc, "\n", sep = "")
  } else {
    cat("FAIL: ", desc, "\n", sep = "")
    failures <<- failures + 1L
  }
}

spec <- createCohortGeneratorModuleSpecifications(generateStats = TRUE)
cls <- class(spec)

check("class[1] is the specific module class",
      identical(cls[[1]], "CohortGeneratorModuleSpecifications"))
check("class[2] is the base ModuleSpecifications",
      identical(cls[[2]], "ModuleSpecifications"))

if (failures > 0L) {
  cat("\n", failures, " check(s) failed\n", sep = "")
  quit(status = 1)
}
cat("\nAll builder class-order checks passed\n")
