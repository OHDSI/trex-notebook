# StrategusSpecBuilder-class-order.test.R
#
# Verifies that module specifications produced by StrategusSpecBuilder.R carry
# a specific-first S3 class vector (e.g. c("CohortMethodModuleSpecifications",
# "ModuleSpecifications")), not the generic-first order the builder used to
# emit. Strategus itself dispatches on the specific class, so generic-first
# ordering breaks module recognition even though the class values are
# individually correct.
#
# Run: Rscript plugins/notebook/tests/StrategusSpecBuilder-class-order.test.R

get_script_path <- function() {
  args <- commandArgs(trailingOnly = FALSE)
  file_arg <- grep("^--file=", args, value = TRUE)
  if (length(file_arg) > 0) {
    return(normalizePath(sub("^--file=", "", file_arg[1])))
  }
  normalizePath(sys.frame(1)$ofile)
}

script_dir <- dirname(get_script_path())
builder_path <- file.path(script_dir, "..", "src", "kernels", "webr", "StrategusSpecBuilder.R")
source(normalizePath(builder_path))

failures <- 0

check <- function(condition, message) {
  if (isTRUE(condition)) {
    cat("PASS:", message, "\n")
  } else {
    cat("FAIL:", message, "\n")
    failures <<- failures + 1
  }
}

# --- The shared internal helper is the single source of truth for module
# --- class order. Every module type routes through it.
generic <- .createModuleSpecifications("FooModule", list(a = 1))
check(
  identical(class(generic), c("FooModuleSpecifications", "ModuleSpecifications")),
  ".createModuleSpecifications: class is specific-first, c(specific, 'ModuleSpecifications')"
)

# --- Spot-check a couple of concrete public constructors to make sure the
# --- fix is actually wired through, not just correct in isolation.
cgSpec <- createCohortGeneratorModuleSpecifications()
check(
  identical(class(cgSpec), c("CohortGeneratorModuleSpecifications", "ModuleSpecifications")),
  "createCohortGeneratorModuleSpecifications: specific-first class order"
)

cdSpec <- createCohortDiagnosticsModuleSpecifications()
check(
  identical(class(cdSpec), c("CohortDiagnosticsModuleSpecifications", "ModuleSpecifications")),
  "createCohortDiagnosticsModuleSpecifications: specific-first class order"
)

cmSpec <- createCohortMethodModuleSpecifications(
  cmAnalysisList = list(),
  targetComparatorOutcomesList = list()
)
check(
  identical(class(cmSpec), c("CohortMethodModuleSpecifications", "ModuleSpecifications")),
  "createCohortMethodModuleSpecifications: specific-first class order"
)

ciSpec <- createCohortIncidenceModuleSpecifications()
check(
  identical(class(ciSpec), c("CohortIncidenceModuleSpecifications", "ModuleSpecifications")),
  "createCohortIncidenceModuleSpecifications: specific-first class order"
)

# --- addModuleSpecifications asserts class "ModuleSpecifications" via
# --- checkmate::assertClass, which only requires the class to appear
# --- somewhere in the vector -- so reordering must not break that check.
analysisSpecifications <- list(sharedResources = list(), moduleSpecifications = list())
class(analysisSpecifications) <- "AnalysisSpecifications"
result <- tryCatch({
  addModuleSpecifications(analysisSpecifications, cmSpec)
  TRUE
}, error = function(e) FALSE)
check(isTRUE(result), "addModuleSpecifications: still accepts specific-first ModuleSpecifications")

if (failures > 0) {
  cat(sprintf("\n%d check(s) FAILED.\n", failures))
  quit(status = 1, save = "no")
} else {
  cat("\nAll checks PASSED.\n")
  quit(status = 0, save = "no")
}
