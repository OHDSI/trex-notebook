# StrategusSpecBuilder-characterization.test.R
#
# Verifies that createCharacterizationModuleSpecifications() emits a settings
# object matching the installed Strategus::CharacterizationModule layout:
#
#   settings = list(analysis = <characterizationSettings>, minCharacterizationMean = ...)
#
# Previously the builder flattened all user inputs directly into settings, which produced
# settings$analysis = NULL at runtime and failed the Strategus assertion:
#
#   Variable 'settings': Must inherit from class 'characterizationSettings',
#   but has class 'NULL'
#
# Also verifies .getDefaultCaseCovariateSettings() routes through
# createDuringCovariateSettings so FeatureExtraction's Java createSql() can read the
# prefix-free FIELD names (fixes 'use*'-prefixed keys).
#
# Run: Rscript plugins/notebook/tests/StrategusSpecBuilder-characterization.test.R

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

# =============================================================================
# .getDefaultCaseCovariateSettings — prefix-free FIELD names
# =============================================================================

case <- .getDefaultCaseCovariateSettings()

check(
  !any(grepl("^use", names(case))),
  ".getDefaultCaseCovariateSettings(): no emitted key starts with 'use'"
)

check(
  identical(attr(case, "fun"), "Characterization::getDbDuringCovariateData"),
  ".getDefaultCaseCovariateSettings(): fun attribute == Characterization::getDbDuringCovariateData"
)

check(
  identical(class(case), "covariateSettings"),
  ".getDefaultCaseCovariateSettings(): class == covariateSettings"
)

for (stripped in c("ConditionGroupEraDuring", "DrugGroupEraDuring",
                   "ProcedureOccurrenceDuring", "DeviceExposureDuring",
                   "MeasurementDuring", "ObservationDuring",
                   "VisitConceptCountDuring")) {
  check(
    isTRUE(case[[stripped]]),
    sprintf(".getDefaultCaseCovariateSettings(): %s == TRUE (prefix stripped)", stripped)
  )
}

# =============================================================================
# createCharacterizationModuleSpecifications — the user's actual notebook call
# cModule$createModuleSpecifications(
#   targetIds=c(1,2), outcomeIds=3, minPriorObservation=0,
#   riskWindowStart=1, startAnchor="cohort start",
#   riskWindowEnd=99999, endAnchor="cohort start",
#   covariateSettings=<default>, minCharacterizationMean=0.01)
# =============================================================================

cov <- .getDefaultCharacterizationCovariateSettings()
spec <- createCharacterizationModuleSpecifications(
  targetIds           = c(1, 2),
  outcomeIds          = 3,
  outcomeWashoutDays  = 365,
  minPriorObservation = 0,
  riskWindowStart     = 1,
  startAnchor         = "cohort start",
  riskWindowEnd       = 99999,
  endAnchor           = "cohort start",
  covariateSettings   = cov,
  minCharacterizationMean = 0.01
)

check(identical(spec$module, "CharacterizationModule"), "module name preserved")

settings <- spec$settings
check("analysis" %in% names(settings), "settings$analysis present")
check(
  "characterizationSettings" %in% class(settings$analysis),
  "settings$analysis has class 'characterizationSettings'"
)
check(
  identical(settings$minCharacterizationMean, 0.01),
  "settings$minCharacterizationMean preserved at module level"
)

for (leaked in c("targetIds", "outcomeIds", "outcomeWashoutDays",
                 "minPriorObservation", "dechallengeStopInterval",
                 "dechallengeEvaluationWindow", "riskWindowStart",
                 "startAnchor", "riskWindowEnd", "endAnchor",
                 "covariateSettings", "caseCovariateSettings")) {
  check(
    !(leaked %in% names(settings)),
    sprintf("settings$%s dropped from module-level (lives inside analysis sub-objects)", leaked)
  )
}

analysis <- settings$analysis

check(
  is.list(analysis$timeToEventSettings) && length(analysis$timeToEventSettings) == 1,
  "analysis$timeToEventSettings is a list of length 1"
)
tte <- analysis$timeToEventSettings[[1]]
check(
  identical(tte$targetIds, c(1, 2)) && identical(tte$outcomeIds, 3),
  "analysis$timeToEventSettings[[1]] carries targetIds/outcomeIds"
)

check(
  is.list(analysis$dechallengeRechallengeSettings) &&
    length(analysis$dechallengeRechallengeSettings) == 1,
  "analysis$dechallengeRechallengeSettings is a list of length 1"
)
drch <- analysis$dechallengeRechallengeSettings[[1]]
check(
  identical(drch$dechallengeStopInterval, 30) &&
    identical(drch$dechallengeEvaluationWindow, 30),
  "analysis$dechallengeRechallengeSettings[[1]] carries default intervals"
)

check(
  is.list(analysis$aggregateCovariateSettings) &&
    length(analysis$aggregateCovariateSettings) == 1,
  "analysis$aggregateCovariateSettings length = 1 risk window * 1 washout group"
)
agg <- analysis$aggregateCovariateSettings[[1]]
check(
  identical(agg$riskWindowStart, 1) && identical(agg$riskWindowEnd, 99999),
  "aggregate carries scalar risk-window values the user supplied"
)
check(
  identical(agg$startAnchor, "cohort start") && identical(agg$endAnchor, "cohort start"),
  "aggregate carries anchors verbatim"
)
check(
  "covariateSettings" %in% names(agg) && "caseCovariateSettings" %in% names(agg),
  "aggregate carries covariateSettings AND caseCovariateSettings INSIDE itself"
)

# =============================================================================
# Multi-riskWindow × multi-washout expansion
# =============================================================================
spec2 <- createCharacterizationModuleSpecifications(
  targetIds           = c(1, 2),
  outcomeIds          = c(3, 4, 5),
  outcomeWashoutDays  = c(365, 180, 365),  # groups: {365: [3,5], 180: [4]}
  minPriorObservation = 365,
  riskWindowStart     = c(1, 1),
  startAnchor         = c("cohort start", "cohort start"),
  riskWindowEnd       = c(0, 365),
  endAnchor           = c("cohort end", "cohort end"),
  minCharacterizationMean = 0.01
)
agg2 <- spec2$settings$analysis$aggregateCovariateSettings
check(
  length(agg2) == 2 * 2,
  sprintf("aggregateCovariateSettings length = len(riskWindow) * len(unique(washout)) = 4 (got %d)", length(agg2))
)

# =============================================================================
# Length-mismatch validation (Strategus parity)
# =============================================================================
raised <- tryCatch({
  createCharacterizationModuleSpecifications(
    targetIds = 1, outcomeIds = 2,
    minPriorObservation = c(0, 1),  # length > 1
    minCharacterizationMean = 0.01
  )
  FALSE
}, error = function(e) TRUE)
check(isTRUE(raised), "minPriorObservation length > 1 raises")

raised <- tryCatch({
  createCharacterizationModuleSpecifications(
    targetIds = 1, outcomeIds = 2,
    riskWindowStart = c(1, 1), startAnchor = "cohort start",
    riskWindowEnd = c(0, 365), endAnchor = c("cohort end", "cohort end"),
    minCharacterizationMean = 0.01
  )
  FALSE
}, error = function(e) TRUE)
check(isTRUE(raised), "Time-at-risk vector length mismatch raises")

cat("\n")
if (failures == 0) {
  cat("All checks passed.\n")
  quit(status = 0)
}
cat(sprintf("%d failure(s).\n", failures))
quit(status = 1)
