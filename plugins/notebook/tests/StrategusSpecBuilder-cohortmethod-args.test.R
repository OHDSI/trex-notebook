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

# Asserts that both a keyword call and a positional call raise an error whose message
# contains "5.5.2" AND names the specific argument the raised guard is for. `positionalArgs`
# is an unnamed list of values filling every slot up to and including argName's position
# (using each slot's own default where a value doesn't matter) — do.call() matches an
# unnamed list positionally.
#
# `positionalGuardArg` names the guard the positional call actually trips. It defaults to
# `argName`, i.e. "the positional call reaches argName's own guard". But supplying any
# removed slot positionally — even NULL, even just to fill a later slot — trips THAT slot's
# guard first if it sits earlier in the signature. Where an earlier removed slot sits before
# argName, pass that slot's name here instead, so the assertion documents (and checks) the
# guard that actually fires rather than implying the positional call reaches argName's guard
# when it cannot.
expect_removed <- function(label, fn, argName, keywordValue, positionalArgs, positionalGuardArg = argName) {
  kwCall <- setNames(list(keywordValue), argName)
  kwResult <- tryCatch({ do.call(fn, kwCall); NULL }, error = function(e) e)
  check(
    !is.null(kwResult) &&
      grepl("5.5.2", conditionMessage(kwResult), fixed = TRUE) &&
      grepl(argName, conditionMessage(kwResult), fixed = TRUE),
    sprintf("%s: keyword call raises with '5.5.2' message naming '%s'", label, argName)
  )

  posResult <- tryCatch({ do.call(fn, positionalArgs); NULL }, error = function(e) e)
  posDescription <- if (identical(positionalGuardArg, argName)) {
    sprintf("%s: positional call landing on original slot raises with '5.5.2' message naming '%s'", label, argName)
  } else {
    sprintf(
      "%s: positional call cannot reach '%s' directly — an earlier removed slot ('%s') is filled first, so its guard fires instead; raises with '5.5.2' message naming '%s'",
      label, argName, positionalGuardArg, positionalGuardArg
    )
  }
  check(
    !is.null(posResult) &&
      grepl("5.5.2", conditionMessage(posResult), fixed = TRUE) &&
      grepl(positionalGuardArg, conditionMessage(posResult), fixed = TRUE),
    posDescription
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
  identical(names(createTrimByPsToEquipoiseArgs()), c("bounds")),
  "createTrimByPsToEquipoiseArgs(): emitted key set matches CohortMethod 5.5.2 object (bounds only)"
)

check(
  identical(names(createTrimByIptwArgs()), c("maxWeight")),
  "createTrimByIptwArgs(): emitted key set matches CohortMethod 5.5.2 object (maxWeight only)"
)

check(
  identical(
    names(createMatchOnPsAndCovariatesArgs(covariateIds = 1)),
    c("caliper", "caliperScale", "maxRatio", "allowReverseMatch", "covariateIds")
  ),
  "createMatchOnPsAndCovariatesArgs(): emitted key set/order matches CohortMethod 5.5.2 object"
)

check(
  identical(
    names(createStratifyByPsAndCovariatesArgs(covariateIds = 1)),
    c("numberOfStrata", "baseSelection", "covariateIds")
  ),
  "createStratifyByPsAndCovariatesArgs(): emitted key set/order matches CohortMethod 5.5.2 object"
)

check(
  inherits(tryCatch(createMatchOnPsAndCovariatesArgs(), error = function(e) e), "error"),
  "createMatchOnPsAndCovariatesArgs(): covariateIds is required"
)

check(
  inherits(tryCatch(createStratifyByPsAndCovariatesArgs(), error = function(e) e), "error"),
  "createStratifyByPsAndCovariatesArgs(): covariateIds is required"
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
  list(createDefaultCovariateSettings(), "keep first, truncate to second", TRUE, 365, NULL, TRUE, 18),
  positionalGuardArg = "nestingCohortId"
)

expect_removed(
  "createGetDbCohortMethodDataArgs(maxAge=...)", createGetDbCohortMethodDataArgs,
  "maxAge", 65,
  list(createDefaultCovariateSettings(), "keep first, truncate to second", TRUE, 365, NULL, TRUE, NULL, 65),
  positionalGuardArg = "nestingCohortId"
)

expect_removed(
  "createGetDbCohortMethodDataArgs(genderConceptIds=...)", createGetDbCohortMethodDataArgs,
  "genderConceptIds", 8507,
  list(createDefaultCovariateSettings(), "keep first, truncate to second", TRUE, 365, NULL, TRUE, NULL, NULL, 8507),
  positionalGuardArg = "nestingCohortId"
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
  list(NULL, NULL, 10),
  positionalGuardArg = "equipoiseBounds"
)

expect_removed(
  "createTrimByPsArgs(trimMethod=...)", createTrimByPsArgs,
  "trimMethod", "one-sided",
  list(NULL, NULL, NULL, "one-sided"),
  positionalGuardArg = "equipoiseBounds"
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
  list(0.2, "standardized logit", 1, FALSE, NULL, 123),
  positionalGuardArg = "matchColumns"
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
  list(NULL, 250000, NULL, NULL, 0.05),
  positionalGuardArg = "threshold"
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
  list("cox", FALSE, FALSE, FALSE, NULL, 100),
  positionalGuardArg = "bootstrapCi"
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
# createCmAnalysis: every *Args slot is type-checked (class "args"). Four slots
# (trimByPsToEquipoiseArgs, trimByIptwArgs, matchOnPsAndCovariatesArgs,
# stratifyByPsAndCovariatesArgs) were inserted mid-signature to match CohortMethod
# 5.5.2's order, shifting six existing slots. All 14 *Args slots are NULL-defaulted
# with no type check on their own, so a legacy positional call site could bind an
# object into the wrong slot and produce a structurally valid but semantically
# wrong spec, silently. Assert a wrongly-typed value in ANY slot raises, naming
# that slot, instead.
# =============================================================================

wrongTypedArgsObject <- structure(list(foo = 1), class = "outcome")

expect_cm_analysis_slot_type_error <- function(slotName) {
  callArgs <- list(
    getDbCohortMethodDataArgs = createGetDbCohortMethodDataArgs(),
    createStudyPopArgs = createCreateStudyPopulationArgs()
  )
  callArgs[[slotName]] <- wrongTypedArgsObject
  result <- tryCatch({ do.call(createCmAnalysis, callArgs); NULL }, error = function(e) e)
  check(
    !is.null(result) && grepl(slotName, conditionMessage(result), fixed = TRUE),
    sprintf("createCmAnalysis(%s = <wrong class>): raises, naming '%s'", slotName, slotName)
  )
}

for (slotName in c(
  "getDbCohortMethodDataArgs", "createStudyPopArgs", "createPsArgs", "trimByPsArgs",
  "trimByPsToEquipoiseArgs", "trimByIptwArgs", "truncateIptwArgs", "matchOnPsArgs",
  "matchOnPsAndCovariatesArgs", "stratifyByPsArgs", "stratifyByPsAndCovariatesArgs",
  "computeSharedCovariateBalanceArgs", "computeCovariateBalanceArgs", "fitOutcomeModelArgs"
)) {
  expect_cm_analysis_slot_type_error(slotName)
}

check(
  is.null(tryCatch({
    createCmAnalysis(
      getDbCohortMethodDataArgs = createGetDbCohortMethodDataArgs(),
      createStudyPopArgs = createCreateStudyPopulationArgs(),
      createPsArgs = createCreatePsArgs(),
      trimByPsArgs = createTrimByPsArgs(),
      truncateIptwArgs = createTruncateIptwArgs(),
      matchOnPsArgs = createMatchOnPsArgs(),
      stratifyByPsArgs = createStratifyByPsArgs(),
      computeCovariateBalanceArgs = createComputeCovariateBalanceArgs(),
      fitOutcomeModelArgs = createFitOutcomeModelArgs()
    )
    NULL
  }, error = function(e) e)),
  "createCmAnalysis: correctly-typed slots (class 'args') do not raise"
)

# Every constructor stamps the same "args" class, so the guard tells slots apart by
# field names: a real constructor object in the wrong slot must raise too.
cmAnalysisError <- function(...) {
  tryCatch({
    createCmAnalysis(
      getDbCohortMethodDataArgs = createGetDbCohortMethodDataArgs(),
      createStudyPopArgs = createCreateStudyPopulationArgs(),
      ...
    )
    NULL
  }, error = function(e) conditionMessage(e))
}

err <- cmAnalysisError(trimByPsArgs = createMatchOnPsArgs())
check(!is.null(err) && grepl("trimByPsArgs", err, fixed = TRUE) && grepl("createMatchOnPsArgs", err, fixed = TRUE),
      "createCmAnalysis(trimByPsArgs = createMatchOnPsArgs()): raises, naming the slot and the constructor it looks like")

err <- cmAnalysisError(fitOutcomeModelArgs = createCreatePsArgs())
check(!is.null(err) && grepl("fitOutcomeModelArgs", err, fixed = TRUE),
      "createCmAnalysis(fitOutcomeModelArgs = createCreatePsArgs()): raises")

check(is.null(cmAnalysisError(
  createPsArgs = createCreatePsArgs(excludeCovariateIds = c(1, 2)),
  matchOnPsArgs = createMatchOnPsArgs(stratificationColumns = c("a")),
  computeCovariateBalanceArgs = createComputeCovariateBalanceArgs(subgroupCovariateId = 1),
  fitOutcomeModelArgs = createFitOutcomeModelArgs(profileGrid = c(0, 1))
)), "createCmAnalysis: constructor objects carrying optional fields still match their slot")

# Pre-5.5.2 positional order: (..., createPsArgs, trimByPsArgs, truncateIptwArgs,
# matchOnPsArgs, ...). Under the 5.5.2 order truncateIptwArgs lands in
# trimByPsToEquipoiseArgs, which must raise rather than silently mis-bind.
legacyErr <- tryCatch({
  createCmAnalysis(1, "legacy positional",
                   createGetDbCohortMethodDataArgs(), createCreateStudyPopulationArgs(),
                   createCreatePsArgs(), createTrimByPsArgs(),
                   createTruncateIptwArgs(), createMatchOnPsArgs())
  NULL
}, error = function(e) conditionMessage(e))
check(!is.null(legacyErr) && grepl("trimByPsToEquipoiseArgs", legacyErr, fixed = TRUE),
      "createCmAnalysis: legacy positional call raises at the first shifted slot")

# Every slot has a constructor now: it accepts that constructor's object and rejects another
# constructor's object, naming the slot. Slot -> (its constructor's object, a wrong object).
slotObjects <- list(
  trimByPsToEquipoiseArgs = list(createTrimByPsToEquipoiseArgs(), createMatchOnPsArgs()),
  trimByIptwArgs = list(createTrimByIptwArgs(), createMatchOnPsArgs()),
  matchOnPsAndCovariatesArgs = list(createMatchOnPsAndCovariatesArgs(covariateIds = c(1, 2)),
                                    createMatchOnPsArgs()),
  stratifyByPsAndCovariatesArgs = list(createStratifyByPsAndCovariatesArgs(covariateIds = c(1, 2)),
                                       createStratifyByPsArgs()),
  computeSharedCovariateBalanceArgs = list(createComputeCovariateBalanceArgs(), createMatchOnPsArgs())
)

for (slotName in names(slotObjects)) {
  callArgs <- list(
    getDbCohortMethodDataArgs = createGetDbCohortMethodDataArgs(),
    createStudyPopArgs = createCreateStudyPopulationArgs()
  )
  callArgs[[slotName]] <- slotObjects[[slotName]][[1]]
  analysis <- tryCatch(do.call(createCmAnalysis, callArgs), error = function(e) e)
  check(!inherits(analysis, "error") && identical(class(analysis), "cmAnalysis") &&
          identical(analysis[[slotName]], slotObjects[[slotName]][[1]]),
        sprintf("createCmAnalysis(%s = <its constructor's object>): accepted", slotName))

  callArgs[[slotName]] <- slotObjects[[slotName]][[2]]
  err <- tryCatch({ do.call(createCmAnalysis, callArgs); NULL }, error = function(e) conditionMessage(e))
  check(!is.null(err) && grepl(slotName, err, fixed = TRUE),
        sprintf("createCmAnalysis(%s = <another constructor's object>): rejected, naming the slot", slotName))

  callArgs[[slotName]] <- list(someField = 1)
  err <- tryCatch({ do.call(createCmAnalysis, callArgs); NULL }, error = function(e) conditionMessage(e))
  check(!is.null(err) && grepl(slotName, err, fixed = TRUE),
        sprintf("createCmAnalysis(%s = <plain list>): rejected, naming the slot", slotName))
}

# createTrimByIptwArgs() and createTruncateIptwArgs() share the shape {maxWeight}, so a
# by-name swap between their slots is not detectable. Known, accepted limitation.
check(
  !inherits(tryCatch(createCmAnalysis(
    getDbCohortMethodDataArgs = createGetDbCohortMethodDataArgs(),
    createStudyPopArgs = createCreateStudyPopulationArgs(),
    trimByIptwArgs = createTruncateIptwArgs(),
    truncateIptwArgs = createTrimByIptwArgs()
  ), error = function(e) e), "error"),
  "createCmAnalysis: trimByIptwArgs/truncateIptwArgs swap is accepted (identical shapes)"
)

# Removed-arg messages on createTrimByPsArgs point at the real constructors.
trimMsg <- function(...) tryCatch({ createTrimByPsArgs(...); NULL }, error = function(e) conditionMessage(e))
check(grepl("createTrimByPsToEquipoiseArgs", trimMsg(equipoiseBounds = c(0.3, 0.7)), fixed = TRUE) &&
        grepl("trimByPsToEquipoiseArgs", trimMsg(equipoiseBounds = c(0.3, 0.7)), fixed = TRUE),
      "createTrimByPsArgs(equipoiseBounds=...): points at createTrimByPsToEquipoiseArgs / its slot")
check(grepl("createTrimByIptwArgs", trimMsg(maxWeight = 10), fixed = TRUE) &&
        grepl("createTruncateIptwArgs", trimMsg(maxWeight = 10), fixed = TRUE),
      "createTrimByPsArgs(maxWeight=...): points at createTrimByIptwArgs / createTruncateIptwArgs")
check(grepl("createTrimByPsToEquipoiseArgs", trimMsg(trimMethod = "x"), fixed = TRUE) &&
        grepl("createTrimByIptwArgs", trimMsg(trimMethod = "x"), fixed = TRUE) &&
        grepl("createTrimByPsArgs()", trimMsg(trimMethod = "x"), fixed = TRUE),
      "createTrimByPsArgs(trimMethod=...): lists the three matching constructors")
check(!any(grepl("by hand", c(trimMsg(equipoiseBounds = 1), trimMsg(maxWeight = 1), trimMsg(trimMethod = "x")),
                 fixed = TRUE)),
      "createTrimByPsArgs: removed-arg messages no longer say 'set by hand'")

# =============================================================================

if (failures > 0) {
  cat(sprintf("\n%d check(s) FAILED.\n", failures))
  quit(status = 1, save = "no")
} else {
  cat("\nAll checks PASSED.\n")
  quit(status = 0, save = "no")
}
