library(Strategus)
library(CohortGenerator)
library(CohortMethod)
library(FeatureExtraction)
library(PatientLevelPrediction)
library(Cyclops)
library(jsonlite)

# --- Shared resources ---
cohortDefinitionSet <- CohortGenerator::getCohortDefinitionSet(
  settingsFileName = "testdata/Cohorts.csv",
  jsonFolder = "testdata/cohorts",
  sqlFolder = "testdata/sql",
  packageName = "Strategus"
)

cohortGeneratorModule <- Strategus::CohortGeneratorModule$new()

cohortDefinitionSharedResource <- cohortGeneratorModule$createCohortSharedResourceSpecifications(
  cohortDefinitionSet = cohortDefinitionSet
)

# --- CohortGenerator module ---
cohortGeneratorModuleSpecifications <- cohortGeneratorModule$createModuleSpecifications(
  generateStats = TRUE
)

# --- CohortMethod module ---
outcomesOfInterest <- lapply(
  X = 3,
  FUN = CohortMethod::createOutcome,
  outcomeOfInterest = TRUE
)

tcos1 <- CohortMethod::createTargetComparatorOutcomes(
  targetId = 1,
  comparatorId = 2,
  outcomes = outcomesOfInterest,
  excludedCovariateConceptIds = c(1118084, 1124300)
)

targetComparatorOutcomesList <- list(tcos1)

covarSettings <- FeatureExtraction::createDefaultCovariateSettings(
  addDescendantsToExclude = TRUE
)

getDbCmDataArgs <- CohortMethod::createGetDbCohortMethodDataArgs(
  washoutPeriod = 183,
  firstExposureOnly = TRUE,
  removeDuplicateSubjects = "remove all",
  maxCohortSize = 100000,
  covariateSettings = covarSettings
)

createStudyPopArgs <- CohortMethod::createCreateStudyPopulationArgs(
  minDaysAtRisk = 1,
  riskWindowStart = 0,
  startAnchor = "cohort start",
  riskWindowEnd = 30,
  endAnchor = "cohort end"
)

fitOutcomeModelArgs <- CohortMethod::createFitOutcomeModelArgs(modelType = "cox")

cmAnalysis1 <- CohortMethod::createCmAnalysis(
  analysisId = 1,
  description = "No matching, simple outcome model",
  getDbCohortMethodDataArgs = getDbCmDataArgs,
  createStudyPopArgs = createStudyPopArgs,
  fitOutcomeModelArgs = fitOutcomeModelArgs
)

cmAnalysisList <- list(cmAnalysis1)

cohortMethodModuleSpecifications <- Strategus::CohortMethodModule$new()$createModuleSpecifications(
  cmAnalysisList = cmAnalysisList,
  targetComparatorOutcomesList = targetComparatorOutcomesList,
  analysesToExclude = NULL
)

# --- PatientLevelPrediction module ---
plpPopulationSettings <- PatientLevelPrediction::createStudyPopulationSettings(
  startAnchor = "cohort start",
  riskWindowStart = 1,
  endAnchor = "cohort start",
  riskWindowEnd = 365,
  minTimeAtRisk = 1
)
plpCovarSettings <- FeatureExtraction::createDefaultCovariateSettings()

modelDesign1 <- PatientLevelPrediction::createModelDesign(
  targetId = 1,
  outcomeId = 3,
  restrictPlpDataSettings = PatientLevelPrediction::createRestrictPlpDataSettings(),
  populationSettings = plpPopulationSettings,
  covariateSettings = plpCovarSettings,
  preprocessSettings = PatientLevelPrediction::createPreprocessSettings(),
  modelSettings = PatientLevelPrediction::setLassoLogisticRegression(),
  splitSettings = PatientLevelPrediction::createDefaultSplitSetting(),
  runCovariateSummary = TRUE
)

plpModuleSpecifications <- Strategus::PatientLevelPredictionModule$new()$createModuleSpecifications(
  modelDesignList = list(modelDesign1)
)

# --- Assembly ---
analysisSpecifications <- Strategus::createEmptyAnalysisSpecificiations()
analysisSpecifications <- Strategus::addSharedResources(analysisSpecifications, cohortDefinitionSharedResource)
analysisSpecifications <- Strategus::addModuleSpecifications(analysisSpecifications, cohortGeneratorModuleSpecifications)
analysisSpecifications <- Strategus::addModuleSpecifications(analysisSpecifications, cohortMethodModuleSpecifications)
analysisSpecifications <- Strategus::addModuleSpecifications(analysisSpecifications, plpModuleSpecifications)

# Strategus attaches S3 classes (AnalysisSpecifications, SharedResources, etc.)
# at every nesting level with no jsonlite::asJSON method; strip classes
# recursively so jsonlite serializes the underlying plain lists/data.frames.
stripClasses <- function(x) {
  if (is.data.frame(x)) {
    return(x)
  }
  if (is.list(x)) {
    x <- lapply(x, stripClasses)
  }
  attr(x, "class") <- NULL
  x
}

jsonlite::write_json(
  stripClasses(analysisSpecifications),
  path = "/tmp/strategus-baseline.json",
  auto_unbox = TRUE,
  pretty = TRUE,
  null = "null"
)
