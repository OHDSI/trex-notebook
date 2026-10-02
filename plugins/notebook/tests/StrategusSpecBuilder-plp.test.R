# StrategusSpecBuilder-plp.test.R
#
# Verifies that the PatientLevelPrediction-facing constructors in StrategusSpecBuilder.R
# emit exactly the field names PatientLevelPrediction 6.5.0 (pinned in the Data2Evidence
# flow-hades renv.lock) accepts, i.e. names(<constructor>(...)), NOT names(formals(...)).
# Confirmed against the installed package inside the alp-dataflow-gen-worker container.
#
# Covers the four known 6.5.0 changes (executeSettings replacing top-level
# runCovariateSummary, hyperparameterSettings removal, skipDiagnostics removal,
# splitSettings carrying no "type" field) plus fixes found while verifying the rest of
# the PLP surface: the modelSettings object shape (fitFunction, param only -- "settings"
# metadata lives as an attribute on param, not a third top-level field),
# createRandomForestFeatureSelection's max_depth (snake_case) field, and
# createPatientLevelPredictionValidationModuleSpecifications's logLevel field.
#
# Run: Rscript plugins/notebook/tests/StrategusSpecBuilder-plp.test.R

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

expect_removed_function <- function(label, fn, ...) {
  result <- tryCatch({ fn(...); NULL }, error = function(e) e)
  check(
    !is.null(result) &&
      grepl("6.5.0", conditionMessage(result), fixed = TRUE),
    sprintf("%s: raises naming '6.5.0'", label)
  )
}

# =============================================================================
# Already-verified: createStudyPopulationSettings (13/13 match) -- assert and move on.
# =============================================================================

check(
  identical(
    names(createStudyPopulationSettings()),
    c("binary", "includeAllOutcomes", "firstExposureOnly", "washoutPeriod",
      "removeSubjectsWithPriorOutcome", "priorOutcomeLookback", "requireTimeAtRisk",
      "minTimeAtRisk", "riskWindowStart", "startAnchor", "riskWindowEnd", "endAnchor",
      "restrictTarToCohortEnd")
  ),
  "createStudyPopulationSettings(): emitted key set/order matches PatientLevelPrediction 6.5.0 object (13/13)"
)

# =============================================================================
# Change 1: createModelDesign emits executeSettings (not top-level runCovariateSummary)
# =============================================================================

modelDesign <- createModelDesign(
  targetId = 1, outcomeId = 2,
  modelSettings = setLassoLogisticRegression()
)

check(
  identical(
    names(modelDesign),
    c("targetId", "outcomeId", "restrictPlpDataSettings", "covariateSettings",
      "populationSettings", "sampleSettings", "featureEngineeringSettings",
      "preprocessSettings", "modelSettings", "splitSettings", "executeSettings")
  ),
  "createModelDesign(): emitted key set/order matches PatientLevelPrediction 6.5.0 object"
)

check(
  !("runCovariateSummary" %in% names(modelDesign)),
  "createModelDesign(): no top-level runCovariateSummary"
)

check(
  identical(
    names(modelDesign$executeSettings),
    c("runSplitData", "runSampleData", "runFeatureEngineering", "runPreprocessData",
      "runModelDevelopment", "runCovariateSummary")
  ),
  "createModelDesign()$executeSettings: emitted key set/order matches PatientLevelPrediction 6.5.0 object"
)

check(
  isTRUE(modelDesign$executeSettings$runCovariateSummary),
  "createModelDesign(): runCovariateSummary default (TRUE) preserved inside executeSettings"
)

check(
  isTRUE(createModelDesign(
    targetId = 1, outcomeId = 2, modelSettings = setLassoLogisticRegression(),
    runCovariateSummary = FALSE
  )$executeSettings$runCovariateSummary == FALSE),
  "createModelDesign(runCovariateSummary = FALSE): threads through into executeSettings"
)

# =============================================================================
# Change 2: hyperparameterSettings removed from createModelDesign; createHyperparameterSettings
# and setRidgeRegression deprecated (absent from PatientLevelPrediction 6.5.0)
# =============================================================================

check(
  !("hyperparameterSettings" %in% names(modelDesign)),
  "createModelDesign(): no hyperparameterSettings field"
)

expect_removed_function("createHyperparameterSettings()", createHyperparameterSettings)
expect_removed_function("setRidgeRegression()", setRidgeRegression)

# =============================================================================
# Change 3: createPatientLevelPredictionModuleSpecifications drops skipDiagnostics;
# createPatientLevelPredictionValidationModuleSpecifications gains logLevel
# =============================================================================

plpModuleSpec <- createPatientLevelPredictionModuleSpecifications(modelDesignList = list(modelDesign))
check(
  identical(names(plpModuleSpec$settings), c("modelDesignList")),
  "createPatientLevelPredictionModuleSpecifications(): settings has only modelDesignList (no skipDiagnostics)"
)

plpValidationModuleSpec <- createPatientLevelPredictionValidationModuleSpecifications(validationList = list())
check(
  identical(names(plpValidationModuleSpec$settings), c("validationList", "logLevel")),
  "createPatientLevelPredictionValidationModuleSpecifications(): settings has validationList, logLevel"
)
check(
  identical(plpValidationModuleSpec$settings$logLevel, "INFO"),
  "createPatientLevelPredictionValidationModuleSpecifications(): logLevel defaults to 'INFO'"
)

# =============================================================================
# Change 4: splitSettings carries no "type" field (it's a constructor argument only)
# =============================================================================

check(
  identical(names(createDefaultSplitSetting()), c("test", "train", "seed", "nfold")),
  "createDefaultSplitSetting(): emitted key set/order matches PatientLevelPrediction 6.5.0 object (no 'type')"
)

# =============================================================================
# Rest of the PLP surface: verified matches
# =============================================================================

check(
  identical(
    names(createRestrictPlpDataSettings()),
    c("studyStartDate", "studyEndDate", "firstExposureOnly", "washoutPeriod", "sampleSize")
  ),
  "createRestrictPlpDataSettings(): emitted key set/order matches PatientLevelPrediction 6.5.0 object"
)

check(
  identical(names(createPreprocessSettings()), c("minFraction", "normalize", "removeRedundancy")),
  "createPreprocessSettings(): emitted key set/order matches PatientLevelPrediction 6.5.0 object"
)

check(
  identical(names(createSampleSettings()), c("numberOutcomestoNonOutcomes", "sampleSeed")),
  "createSampleSettings(): emitted key set/order matches PatientLevelPrediction 6.5.0 object"
)

check(
  length(createFeatureEngineeringSettings()) == 0,
  "createFeatureEngineeringSettings(type='none'): emits an empty object, matching PatientLevelPrediction 6.5.0"
)

check(
  identical(names(createUnivariateFeatureSelection()), c("k")),
  "createUnivariateFeatureSelection(): emitted key set matches PatientLevelPrediction 6.5.0 object (k only)"
)

cohortCovariateSettings <- createCohortCovariateSettings(
  cohortName = "test", settingId = 1, cohortId = 2, cohortTable = "test_table"
)
check(
  identical(
    names(cohortCovariateSettings),
    c("covariateName", "covariateId", "cohortDatabaseSchema", "cohortTable", "cohortIds",
      "startDay", "endDays", "count", "ageInteraction", "lnAgeInteraction", "analysisId")
  ),
  "createCohortCovariateSettings(): emitted key set/order matches PatientLevelPrediction 6.5.0 object"
)

validationDesign <- createValidationDesign(targetId = 1, outcomeId = 2, plpModelList = list("dummy"))
check(
  identical(
    names(validationDesign),
    c("targetId", "outcomeId", "populationSettings", "plpModelList", "restrictPlpDataSettings",
      "recalibrate", "runCovariateSummary")
  ),
  "createValidationDesign(): emitted key set/order matches PatientLevelPrediction 6.5.0 object"
)

# =============================================================================
# Fix found while verifying the rest of the surface: createRandomForestFeatureSelection's
# object field is max_depth (snake_case), not maxDepth.
# =============================================================================

check(
  identical(names(createRandomForestFeatureSelection()), c("ntrees", "max_depth")),
  "createRandomForestFeatureSelection(): emitted key set/order matches PatientLevelPrediction 6.5.0 object (max_depth, not maxDepth)"
)

# =============================================================================
# Fix found while verifying the rest of the surface: every modelSettings object is
# {fitFunction, param} only -- the "settings" metadata PLP attaches lives as an
# attribute on param, not as a third top-level field.
# =============================================================================

expect_model_settings_shape <- function(label, obj) {
  check(
    identical(names(obj), c("fitFunction", "param")),
    sprintf("%s: modelSettings object has only {fitFunction, param}", label)
  )
  check(
    !is.null(attr(obj$param, "settings")),
    sprintf("%s: settings metadata carried as an attribute on param", label)
  )
}

expect_model_settings_shape("setLassoLogisticRegression()", setLassoLogisticRegression())
expect_model_settings_shape("setCoxModel()", setCoxModel())
expect_model_settings_shape("setIterativeHardThresholding()", setIterativeHardThresholding())
expect_model_settings_shape("setNaiveBayes()", setNaiveBayes())

check(
  identical(setLassoLogisticRegression()$fitFunction, "fitCyclopsModel"),
  "setLassoLogisticRegression(): fitFunction unchanged ('fitCyclopsModel')"
)
check(
  identical(setNaiveBayes()$fitFunction, "fitSklearn"),
  "setNaiveBayes(): fitFunction is 'fitSklearn' (previously missing entirely)"
)

# =============================================================================
# Pinned default VALUES -- never change these
# =============================================================================

check(
  createStudyPopulationSettings()$minTimeAtRisk == 364,
  "createStudyPopulationSettings: minTimeAtRisk default is still 364"
)

check(
  createDefaultSplitSetting()$nfold == 3,
  "createDefaultSplitSetting: nfold default is still 3"
)

check(
  createRandomForestFeatureSelection()$ntrees == 2000,
  "createRandomForestFeatureSelection: ntrees default is still 2000"
)

# =============================================================================

if (failures > 0) {
  cat(sprintf("\n%d check(s) FAILED.\n", failures))
  quit(status = 1, save = "no")
} else {
  cat("\nAll checks PASSED.\n")
  quit(status = 0, save = "no")
}
