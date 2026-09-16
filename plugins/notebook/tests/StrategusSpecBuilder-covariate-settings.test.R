# StrategusSpecBuilder-covariate-settings.test.R
#
# Verifies that the covariate-settings helpers in StrategusSpecBuilder.R emit objects
# FeatureExtraction 3.11.0's Java createSql() can actually read. createSql() looks fields
# up by exact name; the private default helpers previously emitted use*-prefixed keys
# (constructor ARGUMENT names) instead of the prefix-free FIELD names FeatureExtraction's
# object actually carries, and createDefaultCovariateSettings() dropped the three
# concept/covariate-id filter fields entirely by assigning them c() (NULL), instead of
# keeping them present as zero-length vectors the way FeatureExtraction's own object does.
#
# Authoritative field sets are documented in
# docs/superpowers/specs/2026-09-10-hades-object-field-sets-evidence.md.
#
# Run: Rscript plugins/notebook/tests/StrategusSpecBuilder-covariate-settings.test.R

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

ALWAYS_PRESENT_NON_FLAG_FIELDS <- c(
  "temporal", "temporalSequence", "longTermStartDays", "mediumTermStartDays",
  "shortTermStartDays", "endDays", "includedCovariateConceptIds",
  "addDescendantsToInclude", "excludedCovariateConceptIds", "addDescendantsToExclude",
  "includedCovariateIds"
)

# =============================================================================
# (a) + (b): .getDefaultCharacterizationCovariateSettings — prefix-free keys,
# mediumTermStartDays present
# =============================================================================

charSettings <- .getDefaultCharacterizationCovariateSettings()

check(
  !any(grepl("^use", names(charSettings))),
  ".getDefaultCharacterizationCovariateSettings(): no emitted key starts with 'use'"
)

check(
  all(ALWAYS_PRESENT_NON_FLAG_FIELDS %in% names(charSettings)),
  ".getDefaultCharacterizationCovariateSettings(): all 11 always-present non-flag fields present"
)

check(
  identical(charSettings$mediumTermStartDays, -180),
  ".getDefaultCharacterizationCovariateSettings(): mediumTermStartDays == -180"
)

check(
  identical(charSettings$longTermStartDays, -365) &&
    identical(charSettings$shortTermStartDays, -30) &&
    identical(charSettings$endDays, 0),
  ".getDefaultCharacterizationCovariateSettings(): other day-window default VALUES unchanged"
)

check(
  identical(attr(charSettings, "fun"), "getDbCovariateData"),
  ".getDefaultCharacterizationCovariateSettings(): fun attribute NOT touched (still getDbCovariateData)"
)

# =============================================================================
# (c) createDefaultCovariateSettings — empty fields stay zero-length vectors, not NULL
# =============================================================================

defaultSettings <- createDefaultCovariateSettings()

check(
  is.null(defaultSettings$includedCovariateConceptIds) == FALSE &&
    length(defaultSettings$includedCovariateConceptIds) == 0 &&
    "includedCovariateConceptIds" %in% names(defaultSettings),
  "createDefaultCovariateSettings(): includedCovariateConceptIds present as zero-length vector, not NULL/absent"
)

check(
  is.null(defaultSettings$excludedCovariateConceptIds) == FALSE &&
    length(defaultSettings$excludedCovariateConceptIds) == 0 &&
    "excludedCovariateConceptIds" %in% names(defaultSettings),
  "createDefaultCovariateSettings(): excludedCovariateConceptIds present as zero-length vector, not NULL/absent"
)

check(
  is.null(defaultSettings$includedCovariateIds) == FALSE &&
    length(defaultSettings$includedCovariateIds) == 0 &&
    "includedCovariateIds" %in% names(defaultSettings),
  "createDefaultCovariateSettings(): includedCovariateIds present as zero-length vector, not NULL/absent"
)

suppliedSettings <- createDefaultCovariateSettings(includedCovariateConceptIds = c(1, 2, 3))
check(
  identical(suppliedSettings$includedCovariateConceptIds, c(1, 2, 3)),
  "createDefaultCovariateSettings(): a supplied value is preserved"
)

# =============================================================================
# createCovariateSettings(useDemographicsGender = TRUE): exactly DemographicsGender +
# the 11 always-present non-flag fields
# =============================================================================

genderOnly <- createCovariateSettings(useDemographicsGender = TRUE)
check(
  setequal(names(genderOnly), c("DemographicsGender", ALWAYS_PRESENT_NON_FLAG_FIELDS)) &&
    length(names(genderOnly)) == 12,
  "createCovariateSettings(useDemographicsGender = TRUE): emits exactly DemographicsGender + the 11 non-flag fields"
)

# =============================================================================
# (d) .getDefaultTemporalCovariateSettings — valid flag set, VisitConceptCount
# replacement, fun == getDbDefaultCovariateData (scoped to this function only)
# =============================================================================

temporalSettings <- .getDefaultTemporalCovariateSettings()

VALID_TEMPORAL_FLAGS <- c(
  "ConditionEraGroupStart", "ConditionEraGroupOverlap",
  "DrugEraGroupStart", "DrugEraGroupOverlap", "VisitConceptCount"
)

nonFlagFields <- c(
  "temporal", "temporalSequence", "temporalStartDays", "temporalEndDays",
  "includedCovariateConceptIds", "excludedCovariateConceptIds", "includedCovariateIds",
  "addDescendantsToInclude", "addDescendantsToExclude"
)
emittedFlags <- setdiff(names(temporalSettings), nonFlagFields)

check(
  setequal(emittedFlags, VALID_TEMPORAL_FLAGS),
  ".getDefaultTemporalCovariateSettings(): flag set is exactly the 5 valid names"
)

check(
  !("useVisitConceptCountStart" %in% names(temporalSettings)) &&
    !("useVisitConceptCountOverlap" %in% names(temporalSettings)) &&
    !("VisitConceptCountStart" %in% names(temporalSettings)) &&
    !("VisitConceptCountOverlap" %in% names(temporalSettings)),
  ".getDefaultTemporalCovariateSettings(): excludes the two rejected VisitConceptCountStart/Overlap flags"
)

check(
  !any(grepl("^use", names(temporalSettings))),
  ".getDefaultTemporalCovariateSettings(): no emitted key starts with 'use'"
)

check(
  length(temporalSettings$temporalStartDays) == length(temporalSettings$temporalEndDays),
  ".getDefaultTemporalCovariateSettings(): temporalStartDays/temporalEndDays are equal length"
)

check(
  identical(attr(temporalSettings, "fun"), "getDbDefaultCovariateData"),
  ".getDefaultTemporalCovariateSettings(): fun attribute is getDbDefaultCovariateData (the worker), not getDbCovariateData"
)

# =============================================================================

if (failures > 0) {
  cat(sprintf("\n%d check(s) FAILED.\n", failures))
  quit(status = 1, save = "no")
} else {
  cat("\nAll checks PASSED.\n")
  quit(status = 0, save = "no")
}
