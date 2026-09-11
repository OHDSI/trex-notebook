# StrategusSpecBuilder-cohortmethod-classes.test.R
#
# Verifies the S3 class values Strategus expects for the CohortMethod surface
# of StrategusSpecBuilder.R, and that list-valued fields that must serialise
# as JSON arrays (cmAnalysisList, targetComparatorOutcomesList, outcomes) are
# assembled unnamed. Also pins down the handful of classes that were already
# correct, so a future find-replace doesn't regress them.
#
# Deliberately out of scope (not touched here): the SelfControlledCaseSeries
# study-population args and the CohortIncidence outcome definition, which
# reuse the literal strings "CreateStudyPopulationArgs" and "Outcome" for
# unrelated objects.
#
# Run: Rscript plugins/notebook/tests/StrategusSpecBuilder-cohortmethod-classes.test.R

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

# --- Class value mapping (12 functions, all -> lowercase "args"/leaf names) ---

check(identical(class(createGetDbCohortMethodDataArgs()), "args"),
      "createGetDbCohortMethodDataArgs: class is 'args'")

check(identical(class(createCreateStudyPopulationArgs()), "args"),
      "createCreateStudyPopulationArgs: class is 'args'")

check(identical(class(createCreatePsArgs()), "args"),
      "createCreatePsArgs: class is 'args'")

check(identical(class(createTrimByPsArgs()), "args"),
      "createTrimByPsArgs: class is 'args'")

check(identical(class(createTruncateIptwArgs()), "args"),
      "createTruncateIptwArgs: class is 'args'")

check(identical(class(createMatchOnPsArgs()), "args"),
      "createMatchOnPsArgs: class is 'args'")

check(identical(class(createStratifyByPsArgs()), "args"),
      "createStratifyByPsArgs: class is 'args'")

check(identical(class(createComputeCovariateBalanceArgs()), "args"),
      "createComputeCovariateBalanceArgs: class is 'args'")

check(identical(class(createFitOutcomeModelArgs()), "args"),
      "createFitOutcomeModelArgs: class is 'args'")

cmAnalysis <- createCmAnalysis(
  getDbCohortMethodDataArgs = createGetDbCohortMethodDataArgs(),
  createStudyPopArgs = createCreateStudyPopulationArgs()
)
check(identical(class(cmAnalysis), "cmAnalysis"),
      "createCmAnalysis: class is 'cmAnalysis'")

outcome <- createOutcome(outcomeId = 1)
check(identical(class(outcome), "outcome"),
      "createOutcome: class is 'outcome'")

tco <- createTargetComparatorOutcomes(
  targetId = 1,
  comparatorId = 2,
  outcomes = list(outcome, createOutcome(outcomeId = 2))
)
check(identical(class(tco), "targetComparatorOutcomes"),
      "createTargetComparatorOutcomes: class is 'targetComparatorOutcomes'")

# --- List shapes: must be unnamed so they serialise as JSON arrays ---

check(is.null(names(tco$outcomes)),
      "createTargetComparatorOutcomes: outcomes list is unnamed (serialises as array)")
check(length(tco$outcomes) == 2,
      "createTargetComparatorOutcomes: outcomes list retains all elements")

cmSpec <- createCohortMethodModuleSpecifications(
  cmAnalysisList = list(cmAnalysis),
  targetComparatorOutcomesList = list(tco)
)
check(is.null(names(cmSpec$settings$cmAnalysisList)),
      "createCohortMethodModuleSpecifications: cmAnalysisList is unnamed (serialises as array)")
check(is.null(names(cmSpec$settings$targetComparatorOutcomesList)),
      "createCohortMethodModuleSpecifications: targetComparatorOutcomesList is unnamed (serialises as array)")
check(length(cmSpec$settings$cmAnalysisList) == 1 && length(cmSpec$settings$targetComparatorOutcomesList) == 1,
      "createCohortMethodModuleSpecifications: list contents preserved after unname()")

# --- Out-of-scope sibling functions must be untouched ---

sccsArgs <- .SelfControlledCaseSeries_createCreateStudyPopulationArgs()
check(identical(class(sccsArgs), "CreateStudyPopulationArgs"),
      "SCCS createCreateStudyPopulationArgs: untouched, still 'CreateStudyPopulationArgs'")

ciOutcome <- createOutcomeDef(id = 1)
check(identical(class(ciOutcome), "Outcome"),
      "CohortIncidence createOutcomeDef: untouched, still 'Outcome'")

# --- Classes that were already correct and must remain unchanged ---

check(identical(class(createCmDiagnosticThresholds()), "CmDiagnosticThresholds"),
      "createCmDiagnosticThresholds: unchanged, class is 'CmDiagnosticThresholds'")

check(identical(class(createPrior()), "cyclopsPrior"),
      "createPrior: unchanged, class is 'cyclopsPrior'")

check(identical(class(createControl()), "cyclopsControl"),
      "createControl: unchanged, class is 'cyclopsControl'")

check(identical(class(createCovariateSettings(useDemographicsGender = TRUE)), "covariateSettings"),
      "createCovariateSettings: unchanged, class is 'covariateSettings'")

if (failures > 0) {
  cat(sprintf("\n%d check(s) FAILED.\n", failures))
  quit(status = 1, save = "no")
} else {
  cat("\nAll checks PASSED.\n")
  quit(status = 0, save = "no")
}
