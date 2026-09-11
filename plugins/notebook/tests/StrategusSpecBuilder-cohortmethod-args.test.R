# StrategusSpecBuilder-cohortmethod-args.test.R
#
# Verifies that the CohortMethod-facing constructors in StrategusSpecBuilder.R emit exactly
# the argument names CohortMethod 5.5.2 (pinned in the Data2Evidence flow-hades renv.lock)
# accepts, in the object shapes captured in
# docs/superpowers/specs/2026-09-10-hades-object-field-sets-evidence.md — i.e.
# names(<constructor>(...)), NOT names(formals(...)). A field whose value is empty/NULL is
# dropped by the real package's own object, so several constructors here emit fewer fields
# than their signature accepts.
#
# Also verifies that every argument CohortMethod 5.5.2 removed or renamed still exists in its
# original positional slot (so old positional call sites fail loudly, here, instead of deep in
# a Strategus flow run), raising an error naming "5.5.2", for both a keyword call and a
# positional call landing on that slot.
#
# Run: Rscript plugins/notebook/tests/StrategusSpecBuilder-cohortmethod-args.test.R

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

# Asserts that both a keyword call and a positional call landing on `argName`'s original
# slot raise an error whose message contains "5.5.2". `positionalArgs` is an unnamed list of
# values filling every slot up to and including argName's position (using each slot's own
# default where a value doesn't matter) — do.call() matches an unnamed list positionally.
expect_removed <- function(label, fn, argName, keywordValue, positionalArgs) {
  kwCall <- setNames(list(keywordValue), argName)
  kwResult <- tryCatch({ do.call(fn, kwCall); NULL }, error = function(e) e)
  check(
    !is.null(kwResult) && grepl("5.5.2", conditionMessage(kwResult), fixed = TRUE),
    sprintf("%s: keyword call raises with '5.5.2' message", label)
  )

  posResult <- tryCatch({ do.call(fn, positionalArgs); NULL }, error = function(e) e)
  check(
    !is.null(posResult) && grepl("5.5.2", conditionMessage(posResult), fixed = TRUE),
    sprintf("%s: positional call landing on original slot raises with '5.5.2' message", label)
  )
}

# =============================================================================
# Exact emitted key sets (the OBJECT's fields, not the signature) — order matters,
# so these use identical(names(x), c(...)), not a sorted/set comparison.
# =============================================================================

check(
  identical(
    names(createGetDbCohortMethodDataArgs()),
    c("studyStartDate", "studyEndDate", "firstExposureOnly", "removeDuplicateSubjects",
      "restrictToCommonPeriod", "washoutPeriod", "maxCohortSize", "covariateSettings")
  ),
  "createGetDbCohortMethodDataArgs(): emitted key set/order matches CohortMethod 5.5.2 object"
)

check(
  identical(
    names(createCreateStudyPopulationArgs()),
    c("firstExposureOnly", "restrictToCommonPeriod", "washoutPeriod", "removeDuplicateSubjects",
      "removeSubjectsWithPriorOutcome", "priorOutcomeLookback", "minDaysAtRisk", "maxDaysAtRisk",
      "riskWindowStart", "startAnchor", "riskWindowEnd", "endAnchor", "censorAtNewRiskWindow")
  ),
  "createCreateStudyPopulationArgs(): emitted key set/order matches CohortMethod 5.5.2 object"
)

check(
  identical(
    names(createCreatePsArgs()),
    c("maxCohortSizeForFitting", "errorOnHighCorrelation", "stopOnError", "prior", "control",
      "estimator")
  ),
  "createCreatePsArgs(): emitted key set/order matches CohortMethod 5.5.2 object"
)

check(
  identical(names(createTrimByPsArgs()), c("trimFraction")),
  "createTrimByPsArgs(): emitted key set matches CohortMethod 5.5.2 object (trimFraction only)"
)

check(
  identical(names(createTruncateIptwArgs()), c("maxWeight")),
  "createTruncateIptwArgs(): emitted key set unchanged (maxWeight only)"
)

check(
  identical(
    names(createMatchOnPsArgs()),
    c("caliper", "caliperScale", "maxRatio", "allowReverseMatch")
  ),
  "createMatchOnPsArgs(): emitted key set/order matches CohortMethod 5.5.2 object"
)

check(
  identical(names(createStratifyByPsArgs()), c("numberOfStrata", "baseSelection")),
  "createStratifyByPsArgs(): emitted key set/order matches CohortMethod 5.5.2 object"
)

check(
  identical(names(createComputeCovariateBalanceArgs()), c("maxCohortSize")),
  "createComputeCovariateBalanceArgs(): emitted key set matches CohortMethod 5.5.2 object (maxCohortSize only)"
)

check(
  identical(
    names(createFitOutcomeModelArgs()),
    c("modelType", "stratified", "useCovariates", "inversePtWeighting", "profileBounds",
      "prior", "control")
  ),
  "createFitOutcomeModelArgs(): emitted key set/order matches CohortMethod 5.5.2 object"
)

cmAnalysis <- createCmAnalysis(
  getDbCohortMethodDataArgs = createGetDbCohortMethodDataArgs(),
  createStudyPopArgs = createCreateStudyPopulationArgs()
)
check(
  identical(
    names(cmAnalysis),
    c("analysisId", "description", "getDbCohortMethodDataArgs", "createStudyPopArgs")
  ),
  "createCmAnalysis(): emits only the 4 always-present fields when no optional slot is supplied"
)

outcome <- createOutcome(outcomeId = 1)
check(
  identical(names(outcome), c("outcomeId", "outcomeOfInterest", "trueEffectSize")),
  "createOutcome(): emitted key set/order matches CohortMethod 5.5.2 object"
)

tco <- createTargetComparatorOutcomes(targetId = 1, comparatorId = 2, outcomes = list())
check(
  identical(names(tco), c("targetId", "comparatorId", "outcomes")),
  "createTargetComparatorOutcomes(): emitted key set/order matches CohortMethod 5.5.2 object"
)

check(
  identical(
    names(createCmDiagnosticThresholds()),
    c("mdrrThreshold", "easeThreshold", "sdmThreshold", "equipoiseThreshold",
      "generalizabilitySdmThreshold")
  ),
  "createCmDiagnosticThresholds(): emitted key set/order matches CohortMethod 5.5.2 object"
)

# =============================================================================
# Conditionally-emitted parameters: present only when the caller actually supplies them
# =============================================================================

check(
  is.null(createMatchOnPsArgs()$stratificationColumns) &&
    identical(createMatchOnPsArgs(stratificationColumns = c("a"))$stratificationColumns, c("a")),
  "createMatchOnPsArgs: stratificationColumns absent by default, present when supplied"
)

check(
  is.null(createStratifyByPsArgs()$stratificationColumns) &&
    identical(createStratifyByPsArgs(stratificationColumns = c("a"))$stratificationColumns, c("a")),
  "createStratifyByPsArgs: stratificationColumns absent by default, present when supplied"
)

check(
  is.null(createComputeCovariateBalanceArgs()$subgroupCovariateId) &&
    identical(createComputeCovariateBalanceArgs(subgroupCovariateId = 1)$subgroupCovariateId, 1),
  "createComputeCovariateBalanceArgs: subgroupCovariateId absent by default, present when supplied"
)

check(
  is.null(createComputeCovariateBalanceArgs()$covariateFilter) &&
    !is.null(createComputeCovariateBalanceArgs(covariateFilter = "x")$covariateFilter),
  "createComputeCovariateBalanceArgs: covariateFilter absent by default, present when supplied"
)

check(
  is.null(createFitOutcomeModelArgs()$profileGrid) &&
    identical(createFitOutcomeModelArgs(profileGrid = c(1, 2))$profileGrid, c(1, 2)),
  "createFitOutcomeModelArgs: profileGrid absent by default, present when supplied"
)

check(
  is.null(createFitOutcomeModelArgs()$interactionCovariateIds) &&
    identical(createFitOutcomeModelArgs(interactionCovariateIds = 123)$interactionCovariateIds, 123),
  "createFitOutcomeModelArgs: interactionCovariateIds absent by default, present when supplied"
)

check(
  is.null(createFitOutcomeModelArgs()$excludeCovariateIds) &&
    identical(createFitOutcomeModelArgs(excludeCovariateIds = 123)$excludeCovariateIds, 123),
  "createFitOutcomeModelArgs: excludeCovariateIds absent by default, present when supplied"
)

check(
  is.null(createFitOutcomeModelArgs()$includeCovariateIds) &&
    identical(createFitOutcomeModelArgs(includeCovariateIds = 123)$includeCovariateIds, 123),
  "createFitOutcomeModelArgs: includeCovariateIds absent by default, present when supplied"
)

check(
  is.null(createCreatePsArgs()$excludeCovariateIds) &&
    identical(createCreatePsArgs(excludeCovariateIds = 123)$excludeCovariateIds, 123),
  "createCreatePsArgs: excludeCovariateIds absent by default, present when supplied"
)

check(
  is.null(createCreatePsArgs()$includeCovariateIds) &&
    identical(createCreatePsArgs(includeCovariateIds = 123)$includeCovariateIds, 123),
  "createCreatePsArgs: includeCovariateIds absent by default, present when supplied"
)

check(
  is.null(createCmDiagnosticThresholds()$attritionFractionThreshold) &&
    identical(createCmDiagnosticThresholds(attritionFractionThreshold = 0.1)$attritionFractionThreshold, 0.1),
  "createCmDiagnosticThresholds: attritionFractionThreshold absent by default, present when supplied"
)

cmAnalysisWithPs <- createCmAnalysis(
  getDbCohortMethodDataArgs = createGetDbCohortMethodDataArgs(),
  createStudyPopArgs = createCreateStudyPopulationArgs(),
  createPsArgs = createCreatePsArgs()
)
check(
  "createPsArgs" %in% names(cmAnalysisWithPs) && !("trimByPsArgs" %in% names(cmAnalysisWithPs)),
  "createCmAnalysis: optional slot (createPsArgs) present only when supplied, others stay absent"
)

check(
  is.null(createOutcome(outcomeId = 1)$riskWindowStart) &&
    identical(createOutcome(outcomeId = 1, riskWindowStart = 0)$riskWindowStart, 0),
  "createOutcome: riskWindowStart absent by default, present when supplied"
)

check(
  is.null(createTargetComparatorOutcomes(targetId = 1, comparatorId = 2, outcomes = list())$includedCovariateConceptIds) &&
    identical(
      createTargetComparatorOutcomes(
        targetId = 1, comparatorId = 2, outcomes = list(), includedCovariateConceptIds = 123
      )$includedCovariateConceptIds,
      123
    ),
  "createTargetComparatorOutcomes: includedCovariateConceptIds absent by default, present when supplied"
)

# =============================================================================
# Pinned default VALUES — never change these
# =============================================================================

check(
  createGetDbCohortMethodDataArgs()$washoutPeriod == 365,
  "createGetDbCohortMethodDataArgs: washoutPeriod default is still 365"
)

check(
  createFitOutcomeModelArgs()$modelType == "cox",
  "createFitOutcomeModelArgs: modelType default is still 'cox'"
)

check(
  createStratifyByPsArgs()$numberOfStrata == 10,
  "createStratifyByPsArgs: numberOfStrata default is still 10"
)

check(
  createCmDiagnosticThresholds()$generalizabilitySdmThreshold == 999,
  "createCmDiagnosticThresholds: generalizabilitySdmThreshold default is still 999"
)

check(
  is.null(createTrimByPsArgs()$trimFraction),
  "createTrimByPsArgs: trimFraction default is still NULL"
)

# =============================================================================
# Removed/renamed arguments (16) — each stays in its original positional slot,
# guarded, and raises naming "5.5.2" for both a keyword and a positional call.
# =============================================================================

# --- createGetDbCohortMethodDataArgs: nestingCohortId(5), minAge(7), maxAge(8),
# --- genderConceptIds(9) ---

expect_removed(
  "createGetDbCohortMethodDataArgs(nestingCohortId=...)", createGetDbCohortMethodDataArgs,
  "nestingCohortId", 1,
  list(createDefaultCovariateSettings(), "keep first, truncate to second", TRUE, 365, 1)
)

expect_removed(
  "createGetDbCohortMethodDataArgs(minAge=...)", createGetDbCohortMethodDataArgs,
  "minAge", 18,
  list(createDefaultCovariateSettings(), "keep first, truncate to second", TRUE, 365, NULL, TRUE, 18)
)

expect_removed(
  "createGetDbCohortMethodDataArgs(maxAge=...)", createGetDbCohortMethodDataArgs,
  "maxAge", 65,
  list(createDefaultCovariateSettings(), "keep first, truncate to second", TRUE, 365, NULL, TRUE, NULL, 65)
)

expect_removed(
  "createGetDbCohortMethodDataArgs(genderConceptIds=...)", createGetDbCohortMethodDataArgs,
  "genderConceptIds", 8507,
  list(createDefaultCovariateSettings(), "keep first, truncate to second", TRUE, 365, NULL, TRUE, NULL, NULL, 8507)
)

# --- createTrimByPsArgs: equipoiseBounds(2), maxWeight(3), trimMethod(4) ---

expect_removed(
  "createTrimByPsArgs(equipoiseBounds=...)", createTrimByPsArgs,
  "equipoiseBounds", c(0.3, 0.7),
  list(NULL, c(0.3, 0.7))
)

expect_removed(
  "createTrimByPsArgs(maxWeight=...)", createTrimByPsArgs,
  "maxWeight", 10,
  list(NULL, NULL, 10)
)

expect_removed(
  "createTrimByPsArgs(trimMethod=...)", createTrimByPsArgs,
  "trimMethod", "one-sided",
  list(NULL, NULL, NULL, "one-sided")
)

# --- createMatchOnPsArgs: matchColumns(5), matchCovariateIds(6) ---

expect_removed(
  "createMatchOnPsArgs(matchColumns=...)", createMatchOnPsArgs,
  "matchColumns", "x",
  list(0.2, "standardized logit", 1, FALSE, "x")
)

expect_removed(
  "createMatchOnPsArgs(matchCovariateIds=...)", createMatchOnPsArgs,
  "matchCovariateIds", 123,
  list(0.2, "standardized logit", 1, FALSE, NULL, 123)
)

# --- createStratifyByPsArgs: stratificationCovariateIds(4) ---

expect_removed(
  "createStratifyByPsArgs(stratificationCovariateIds=...)", createStratifyByPsArgs,
  "stratificationCovariateIds", 123,
  list(10, "all", c(), 123)
)

# --- createComputeCovariateBalanceArgs: threshold(4), alpha(5) ---

expect_removed(
  "createComputeCovariateBalanceArgs(threshold=...)", createComputeCovariateBalanceArgs,
  "threshold", 0.1,
  list(NULL, 250000, NULL, 0.1)
)

expect_removed(
  "createComputeCovariateBalanceArgs(alpha=...)", createComputeCovariateBalanceArgs,
  "alpha", 0.05,
  list(NULL, 250000, NULL, NULL, 0.05)
)

# --- createFitOutcomeModelArgs: bootstrapCi(5), bootstrapReplicates(6) ---

expect_removed(
  "createFitOutcomeModelArgs(bootstrapCi=...)", createFitOutcomeModelArgs,
  "bootstrapCi", TRUE,
  list("cox", FALSE, FALSE, FALSE, TRUE)
)

expect_removed(
  "createFitOutcomeModelArgs(bootstrapReplicates=...)", createFitOutcomeModelArgs,
  "bootstrapReplicates", 100,
  list("cox", FALSE, FALSE, FALSE, NULL, 100)
)

# --- createCmDiagnosticThresholds: sdmAlpha(4) ---

expect_removed(
  "createCmDiagnosticThresholds(sdmAlpha=...)", createCmDiagnosticThresholds,
  "sdmAlpha", 0.05,
  list(10, 0.25, 0.1, 0.05)
)

# --- createTargetComparatorOutcomes: nestingCohortId(4) ---

expect_removed(
  "createTargetComparatorOutcomes(nestingCohortId=...)", createTargetComparatorOutcomes,
  "nestingCohortId", 99,
  list(1, 2, list(), 99)
)

# =============================================================================

if (failures > 0) {
  cat(sprintf("\n%d check(s) FAILED.\n", failures))
  quit(status = 1, save = "no")
} else {
  cat("\nAll checks PASSED.\n")
  quit(status = 0, save = "no")
}
