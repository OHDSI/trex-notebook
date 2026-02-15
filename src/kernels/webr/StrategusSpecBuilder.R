# StrategusSpecBuilder.R
# Standalone Strategus Analysis Specification Builder for WebR
#
# This file provides functions to create Strategus analysis specifications
# without requiring Java dependencies (DatabaseConnector, CohortGenerator).
# Designed for use in WebR (browser-based R) environments.
#
# Usage:
#   source("StrategusSpecBuilder.R")
#   # or in R with Strategus installed:
#   source(system.file("webr/StrategusSpecBuilder.R", package = "Strategus"))
#
# Dependencies:
#   - checkmate (available in WebR via CRAN)
#
# HADES Package Version Tracking (for maintenance):
#   - CohortMethod 5.4.0
#   - CohortDiagnostics 3.3.0
#   - FeatureExtraction 3.7.0
#   - Characterization 2.0.0
#
# Note: Default settings are inlined from the HADES packages listed above.
# If HADES package defaults change, this file may need updates.

# =============================================================================
# Internal Helper Functions
# =============================================================================

# T003: Create module specifications with proper class attributes
.createModuleSpecifications <- function(moduleName, moduleSettings) {
  moduleSpecifications <- list(
    module = moduleName,
    settings = moduleSettings
  )
  class(moduleSpecifications) <- c("ModuleSpecifications", paste0(moduleName, "Specifications"))
  return(moduleSpecifications)
}

# T004: Create shared resources specifications with proper class attributes
.createSharedResourcesSpecifications <- function(className, sharedResourcesSpecifications) {
  class(sharedResourcesSpecifications) <- c(className, "SharedResources")
  return(sharedResourcesSpecifications)
}

# T005: Validate cohort definition set structure (replaces CohortGenerator::isCohortDefinitionSet)
.isCohortDefinitionSet <- function(x) {
  required_cols <- c("cohortId", "cohortName", "sql", "json")
  is.data.frame(x) && all(required_cols %in% names(x))
}

# T006: Convert data frame to list of lists (from CohortGeneratorModule)
.listafy <- function(df) {
  mylist <- list()
  for (i in seq_len(nrow(df))) {
    cohortData <- list(
      cohortId = df$cohortId[i],
      cohortName = df$cohortName[i],
      cohortDefinition = df$json[i]
    )
    mylist[[i]] <- cohortData
  }
  return(mylist)
}

# =============================================================================
# Inlined Default Settings (from HADES packages)
# =============================================================================

# T007: CohortMethod diagnostic thresholds (from CohortMethod::createCmDiagnosticThresholds)
.createDefaultCmDiagnosticThresholds <- function() {
  thresholds <- list(
    mdrrThreshold = 10,
    easeThreshold = 0.25,
    sdmThreshold = 0.1,
    equipoiseThreshold = 0.2,
    generalizabilitySdmThreshold = 1
  )
  class(thresholds) <- "CmDiagnosticThresholds"
  return(thresholds)
}

# T008: Evidence Synthesis diagnostic thresholds (from EvidenceSynthesisModule)
.createDefaultEsDiagnosticThresholds <- function() {
  thresholds <- list(
    mdrrThreshold = 10,
    easeThreshold = 0.25,
    i2Threshold = 0.4,
    tauThreshold = log(2) # ~0.693
  )
  class(thresholds) <- "EsDiagnosticThresholds"
  return(thresholds)
}

# T009: Characterization covariate settings (from FeatureExtraction::createCovariateSettings)
.getDefaultCharacterizationCovariateSettings <- function() {
  settings <- list(
    temporal = FALSE,
    temporalSequence = FALSE,
    # Demographics - all enabled
    useDemographicsGender = TRUE,
    useDemographicsAge = TRUE,
    useDemographicsAgeGroup = TRUE,
    useDemographicsRace = TRUE,
    useDemographicsEthnicity = TRUE,
    useDemographicsIndexYear = TRUE,
    useDemographicsIndexMonth = TRUE,
    useDemographicsTimeInCohort = TRUE,
    useDemographicsPriorObservationTime = TRUE,
    useDemographicsPostObservationTime = TRUE,
    # Long term covariates
    useConditionGroupEraLongTerm = TRUE,
    useDrugGroupEraOverlapping = TRUE,
    useDrugGroupEraLongTerm = TRUE,
    useProcedureOccurrenceLongTerm = TRUE,
    useMeasurementLongTerm = TRUE,
    useObservationLongTerm = TRUE,
    useDeviceExposureLongTerm = TRUE,
    useVisitConceptCountLongTerm = TRUE,
    # Short term covariates
    useConditionGroupEraShortTerm = TRUE,
    useDrugGroupEraShortTerm = TRUE,
    useProcedureOccurrenceShortTerm = TRUE,
    useMeasurementShortTerm = TRUE,
    useObservationShortTerm = TRUE,
    useDeviceExposureShortTerm = TRUE,
    useVisitConceptCountShortTerm = TRUE,
    # Time windows
    endDays = 0,
    longTermStartDays = -365,
    shortTermStartDays = -30,
    # Concept filtering
    includedCovariateConceptIds = c(),
    excludedCovariateConceptIds = c(),
    includedCovariateIds = c(),
    addDescendantsToInclude = FALSE,
    addDescendantsToExclude = FALSE
  )
  class(settings) <- "covariateSettings"
  attr(settings, "fun") <- "getDbCovariateData"
  return(settings)
}

# T010: Characterization case (during) covariate settings (from Characterization::createDuringCovariateSettings)
.getDefaultCaseCovariateSettings <- function() {
  settings <- list(
    useConditionGroupEraDuring = TRUE,
    useDrugGroupEraDuring = TRUE,
    useProcedureOccurrenceDuring = TRUE,
    useDeviceExposureDuring = TRUE,
    useMeasurementDuring = TRUE,
    useObservationDuring = TRUE,
    useVisitConceptCountDuring = TRUE
  )
  class(settings) <- "covariateSettings"
  attr(settings, "fun") <- "Characterization::getDuringCovariateData"
  return(settings)
}

# T011: CohortDiagnostics temporal covariate settings (from CohortDiagnostics::getDefaultCovariateSettings)
.getDefaultTemporalCovariateSettings <- function() {
  settings <- list(
    temporal = TRUE,
    temporalSequence = FALSE,
    # Condition covariates
    useConditionEraGroupStart = TRUE,
    useConditionEraGroupOverlap = TRUE,
    # Drug covariates
    useDrugEraGroupStart = TRUE,
    useDrugEraGroupOverlap = TRUE,
    # Visit covariates
    useVisitConceptCountStart = TRUE,
    useVisitConceptCountOverlap = TRUE,
    # Time windows (mandatory for CohortDiagnostics)
    temporalStartDays = c(-365, -30, -365, -30, 0, 1, 31, -9999),
    temporalEndDays = c(0, 0, -31, -1, 0, 30, 365, 9999),
    # Concept filtering
    includedCovariateConceptIds = c(),
    excludedCovariateConceptIds = c(),
    includedCovariateIds = c(),
    addDescendantsToInclude = FALSE,
    addDescendantsToExclude = FALSE
  )
  class(settings) <- "covariateSettings"
  attr(settings, "fun") <- "getDbCovariateData"
  return(settings)
}

# =============================================================================
# Core Public Functions (User Story 1)
# =============================================================================

# T016: Create an empty analysis specifications object
#' @title Create Empty Analysis Specifications
#' @description Creates an empty analysis specifications object that can be
#' populated with shared resources and module specifications.
#' @return An object of type `AnalysisSpecifications`.
createEmptyAnalysisSpecifications <- function() {
  analysisSpecifications <- list(
    sharedResources = list(),
    moduleSpecifications = list()
  )
  class(analysisSpecifications) <- "AnalysisSpecifications"
  return(analysisSpecifications)
}

# T017: Add shared resources to analysis specifications
#' @title Add Shared Resources
#' @description Add shared resources (e.g., cohort definitions) to analysis specifications.
#' @param analysisSpecifications An object of type `AnalysisSpecifications`.
#' @param sharedResources An object of type `SharedResources`.
#' @return The `analysisSpecifications` object with the shared resources added.
addSharedResources <- function(analysisSpecifications, sharedResources) {
  errorMessages <- checkmate::makeAssertCollection()
  checkmate::assertClass(analysisSpecifications, "AnalysisSpecifications", add = errorMessages)
  checkmate::assertClass(sharedResources, "SharedResources", add = errorMessages)
  checkmate::reportAssertions(collection = errorMessages)

  analysisSpecifications$sharedResources[[length(analysisSpecifications$sharedResources) + 1]] <- sharedResources
  return(analysisSpecifications)
}

# T018: Add module specifications to analysis specifications
#' @title Add Module Specifications
#' @description Add module specifications to analysis specifications.
#' @param analysisSpecifications An object of type `AnalysisSpecifications`.
#' @param moduleSpecifications An object of type `ModuleSpecifications`.
#' @return The `analysisSpecifications` object with the module specifications added.
addModuleSpecifications <- function(analysisSpecifications, moduleSpecifications) {
  errorMessages <- checkmate::makeAssertCollection()
  checkmate::assertClass(analysisSpecifications, "AnalysisSpecifications", add = errorMessages)
  checkmate::assertClass(moduleSpecifications, "ModuleSpecifications", add = errorMessages)
  checkmate::reportAssertions(collection = errorMessages)

  analysisSpecifications$moduleSpecifications[[length(analysisSpecifications$moduleSpecifications) + 1]] <- moduleSpecifications
  return(analysisSpecifications)
}

# =============================================================================
# Shared Resource Functions (User Story 2)
# =============================================================================

# T023: Create cohort shared resource specifications
#' @title Create Cohort Shared Resource Specifications
#' @description Creates shared resource specifications for cohort definitions.
#' Replaces CohortGeneratorModule$createCohortSharedResourceSpecifications().
#' @param cohortDefinitionSet A data frame with columns cohortId, cohortName, sql, json.
#'   May optionally include subset columns (isSubset, subsetParent, subsetDefinitionId).
#' @return An object of class `CohortDefinitionSharedResources` and `SharedResources`.
createCohortSharedResourceSpecifications <- function(cohortDefinitionSet) {
  # Validate cohort definition set
  if (!.isCohortDefinitionSet(cohortDefinitionSet)) {
    stop("cohortDefinitionSet is not properly defined. Required columns: cohortId, cohortName, sql, json")
  }

  # Check for subset definitions
  hasSubsets <- "isSubset" %in% names(cohortDefinitionSet) &&
    any(cohortDefinitionSet$isSubset == TRUE, na.rm = TRUE)

  if (hasSubsets) {
    # Filter to parent cohorts only
    parentCohortDefinitionSet <- cohortDefinitionSet[!cohortDefinitionSet$isSubset, ]
  } else {
    parentCohortDefinitionSet <- cohortDefinitionSet
  }

  sharedResource <- list()

  # Convert parent cohorts to list format
  cohortDefinitionsList <- .listafy(parentCohortDefinitionSet)
  sharedResource[["cohortDefinitions"]] <- cohortDefinitionsList

  if (hasSubsets) {
    # Note: subsetDefs would normally contain JSON from CohortSubsetDefinition objects.
    # In WebR context, users must provide pre-serialized subset definitions if needed.
    # For now, we only handle the cohortSubsets mapping.

    # Filter to subsets
    subsetCohortDefinitionSet <- cohortDefinitionSet[cohortDefinitionSet$isSubset, ]

    # Create subset ID mapping
    subsetIdMapping <- list()
    for (i in seq_len(nrow(subsetCohortDefinitionSet))) {
      idMapping <- list(
        cohortId = subsetCohortDefinitionSet$cohortId[i],
        subsetId = subsetCohortDefinitionSet$subsetDefinitionId[i],
        targetCohortId = subsetCohortDefinitionSet$subsetParent[i]
      )
      subsetIdMapping[[i]] <- idMapping
    }
    sharedResource[["cohortSubsets"]] <- subsetIdMapping
  }

  sharedResource <- .createSharedResourcesSpecifications(
    className = "CohortDefinitionSharedResources",
    sharedResourcesSpecifications = sharedResource
  )
  return(sharedResource)
}

# T024: Create negative control outcome cohort shared resource specifications
#' @title Create Negative Control Outcome Cohort Shared Resource Specifications
#' @description Creates shared resource specifications for negative control outcome cohorts.
#' @param negativeControlOutcomeCohortSet A data frame with cohortId, cohortName, outcomeConceptId.
#' @param occurrenceType Either "first" or "all".
#' @param detectOnDescendants Logical. When TRUE, uses concept_ancestor table
#'   to detect descendant concepts when constructing the cohort.
#' @return An object of class `NegativeControlOutcomeSharedResources` and `SharedResources`.
createNegativeControlOutcomeCohortSharedResourceSpecifications <- function(negativeControlOutcomeCohortSet,
                                                                           occurrenceType,
                                                                           detectOnDescendants) {
  # Convert data frame rows to list of lists
  negativeControlOutcomeCohortSetList <- apply(negativeControlOutcomeCohortSet, 1, as.list)

  sharedResource <- list(
    negativeControlOutcomes = list(
      negativeControlOutcomeCohortSet = negativeControlOutcomeCohortSetList,
      occurrenceType = occurrenceType,
      detectOnDescendants = detectOnDescendants
    )
  )

  sharedResource <- .createSharedResourcesSpecifications(
    className = "NegativeControlOutcomeSharedResources",
    sharedResourcesSpecifications = sharedResource
  )
  return(sharedResource)
}

# =============================================================================
# Module Specification Functions (User Story 3)
# =============================================================================

# T031: CohortGenerator Module Specifications
#' @title Create CohortGenerator Module Specifications
#' @description Creates module specifications for the CohortGenerator module.
#' @param generateStats When TRUE, inclusion rule statistics will be computed.
#' @return An object of class `ModuleSpecifications`.
createCohortGeneratorModuleSpecifications <- function(generateStats = TRUE) {
  moduleSettings <- list(
    generateStats = generateStats
  )
  return(.createModuleSpecifications("CohortGeneratorModule", moduleSettings))
}

# T032: CohortDiagnostics Module Specifications
#' @title Create CohortDiagnostics Module Specifications
#' @description Creates module specifications for the CohortDiagnostics module.
#' @param cohortIds Vector of cohort IDs to analyze. NULL means all cohorts.
#' @param runInclusionStatistics Run inclusion rule statistics.
#' @param runIncludedSourceConcepts Run included source concepts analysis.
#' @param runOrphanConcepts Run orphan concepts analysis.
#' @param runTimeSeries Run time series analysis.
#' @param runVisitContext Run visit context analysis.
#' @param runBreakdownIndexEvents Run breakdown index events analysis.
#' @param runIncidenceRate Run incidence rate analysis.
#' @param runCohortRelationship Run cohort relationship analysis.
#' @param runTemporalCohortCharacterization Run temporal cohort characterization.
#' @param temporalCovariateSettings Covariate settings for temporal analysis.
#'   Defaults to sensible temporal covariate settings.
#' @param minCharacterizationMean Minimum mean for characterization.
#' @param irWashoutPeriod Incidence rate washout period.
#' @return An object of class `ModuleSpecifications`.
createCohortDiagnosticsModuleSpecifications <- function(cohortIds = NULL,
                                                        runInclusionStatistics = TRUE,
                                                        runIncludedSourceConcepts = TRUE,
                                                        runOrphanConcepts = TRUE,
                                                        runTimeSeries = FALSE,
                                                        runVisitContext = TRUE,
                                                        runBreakdownIndexEvents = TRUE,
                                                        runIncidenceRate = TRUE,
                                                        runCohortRelationship = TRUE,
                                                        runTemporalCohortCharacterization = TRUE,
                                                        temporalCovariateSettings = .getDefaultTemporalCovariateSettings(),
                                                        minCharacterizationMean = 0.01,
                                                        irWashoutPeriod = 0) {
  moduleSettings <- list(
    cohortIds = cohortIds,
    runInclusionStatistics = runInclusionStatistics,
    runIncludedSourceConcepts = runIncludedSourceConcepts,
    runOrphanConcepts = runOrphanConcepts,
    runTimeSeries = runTimeSeries,
    runVisitContext = runVisitContext,
    runBreakdownIndexEvents = runBreakdownIndexEvents,
    runIncidenceRate = runIncidenceRate,
    runCohortRelationship = runCohortRelationship,
    runTemporalCohortCharacterization = runTemporalCohortCharacterization,
    temporalCovariateSettings = temporalCovariateSettings,
    minCharacterizationMean = minCharacterizationMean,
    irWashoutPeriod = irWashoutPeriod
  )
  return(.createModuleSpecifications("CohortDiagnosticsModule", moduleSettings))
}

# T033: CohortIncidence Module Specifications
#' @title Create CohortIncidence Module Specifications
#' @description Creates module specifications for the CohortIncidence module.
#' @param irDesign The incidence rate design from CohortIncidence package.
#' @return An object of class `ModuleSpecifications`.
createCohortIncidenceModuleSpecifications <- function(irDesign = NULL) {
  moduleSettings <- list(
    irDesign = irDesign
  )
  return(.createModuleSpecifications("CohortIncidenceModule", moduleSettings))
}

# T034: CohortMethod Module Specifications
#' @title Create CohortMethod Module Specifications
#' @description Creates module specifications for the CohortMethod module.
#' @param cmAnalysisList List of CohortMethod analysis settings.
#' @param targetComparatorOutcomesList List of target-comparator-outcomes.
#' @param analysesToExclude Analyses to exclude.
#' @param refitPsForEveryOutcome Refit propensity score for every outcome.
#' @param refitPsForEveryStudyPopulation Refit PS for every study population.
#' @param cmDiagnosticThresholds Diagnostic thresholds. Defaults to sensible values.
#' @return An object of class `ModuleSpecifications`.
createCohortMethodModuleSpecifications <- function(cmAnalysisList,
                                                   targetComparatorOutcomesList,
                                                   analysesToExclude = NULL,
                                                   refitPsForEveryOutcome = FALSE,
                                                   refitPsForEveryStudyPopulation = TRUE,
                                                   cmDiagnosticThresholds = .createDefaultCmDiagnosticThresholds()) {
  moduleSettings <- list(
    cmAnalysisList = cmAnalysisList,
    targetComparatorOutcomesList = targetComparatorOutcomesList,
    analysesToExclude = analysesToExclude,
    refitPsForEveryOutcome = refitPsForEveryOutcome,
    refitPsForEveryStudyPopulation = refitPsForEveryStudyPopulation,
    cmDiagnosticThresholds = cmDiagnosticThresholds
  )
  return(.createModuleSpecifications("CohortMethodModule", moduleSettings))
}

# T035: Characterization Module Specifications
#' @title Create Characterization Module Specifications
#' @description Creates module specifications for the Characterization module.
#' @param targetIds Vector of target cohort IDs.
#' @param outcomeIds Vector of outcome cohort IDs.
#' @param outcomeWashoutDays Days of washout for outcomes.
#' @param minPriorObservation Minimum prior observation days.
#' @param dechallengeStopInterval Dechallenge stop interval.
#' @param dechallengeEvaluationWindow Dechallenge evaluation window.
#' @param riskWindowStart Risk window start days.
#' @param startAnchor Risk window start anchor.
#' @param riskWindowEnd Risk window end days.
#' @param endAnchor Risk window end anchor.
#' @param minCharacterizationMean Minimum characterization mean.
#' @param covariateSettings Covariate settings. Defaults to characterization defaults.
#' @param caseCovariateSettings Case (during) covariate settings.
#' @return An object of class `ModuleSpecifications`.
createCharacterizationModuleSpecifications <- function(targetIds,
                                                       outcomeIds,
                                                       outcomeWashoutDays = c(365),
                                                       minPriorObservation = 365,
                                                       dechallengeStopInterval = 30,
                                                       dechallengeEvaluationWindow = 30,
                                                       riskWindowStart = c(1, 1),
                                                       startAnchor = c("cohort start", "cohort start"),
                                                       riskWindowEnd = c(0, 365),
                                                       endAnchor = c("cohort end", "cohort end"),
                                                       minCharacterizationMean = 0.01,
                                                       covariateSettings = .getDefaultCharacterizationCovariateSettings(),
                                                       caseCovariateSettings = .getDefaultCaseCovariateSettings()) {
  moduleSettings <- list(
    targetIds = targetIds,
    outcomeIds = outcomeIds,
    outcomeWashoutDays = outcomeWashoutDays,
    minPriorObservation = minPriorObservation,
    dechallengeStopInterval = dechallengeStopInterval,
    dechallengeEvaluationWindow = dechallengeEvaluationWindow,
    riskWindowStart = riskWindowStart,
    startAnchor = startAnchor,
    riskWindowEnd = riskWindowEnd,
    endAnchor = endAnchor,
    minCharacterizationMean = minCharacterizationMean,
    covariateSettings = covariateSettings,
    caseCovariateSettings = caseCovariateSettings
  )
  return(.createModuleSpecifications("CharacterizationModule", moduleSettings))
}

# T036: PatientLevelPrediction Module Specifications
#' @title Create PatientLevelPrediction Module Specifications
#' @description Creates module specifications for the PatientLevelPrediction module.
#' @param modelDesignList List of model designs from PatientLevelPrediction.
#' @param skipDiagnostics Whether to skip diagnostics.
#' @return An object of class `ModuleSpecifications`.
createPatientLevelPredictionModuleSpecifications <- function(modelDesignList,
                                                             skipDiagnostics = FALSE) {
  moduleSettings <- list(
    modelDesignList = modelDesignList,
    skipDiagnostics = skipDiagnostics
  )
  return(.createModuleSpecifications("PatientLevelPredictionModule", moduleSettings))
}

# T037: PatientLevelPredictionValidation Module Specifications
#' @title Create PatientLevelPrediction Validation Module Specifications
#' @description Creates module specifications for the PLP Validation module.
#' @param validationList List of validation designs from PatientLevelPrediction.
#' @return An object of class `ModuleSpecifications`.
createPatientLevelPredictionValidationModuleSpecifications <- function(validationList) {
  moduleSettings <- list(
    validationList = validationList
  )
  return(.createModuleSpecifications("PatientLevelPredictionValidationModule", moduleSettings))
}

# T038: SelfControlledCaseSeries Module Specifications
#' @title Create SelfControlledCaseSeries Module Specifications
#' @description Creates module specifications for the SCCS module.
#' @param sccsAnalysesSpecifications SCCS analyses specifications from SCCS package.
#' @return An object of class `ModuleSpecifications`.
createSelfControlledCaseSeriesModuleSpecifications <- function(sccsAnalysesSpecifications) {
  moduleSettings <- list(
    sccsAnalysesSpecifications = sccsAnalysesSpecifications
  )
  return(.createModuleSpecifications("SelfControlledCaseSeriesModule", moduleSettings))
}

# T039: EvidenceSynthesis Module Specifications
#' @title Create EvidenceSynthesis Module Specifications
#' @description Creates module specifications for the EvidenceSynthesis module.
#' @param evidenceSynthesisAnalysisList List of evidence synthesis analyses.
#' @param esDiagnosticThresholds Diagnostic thresholds. Defaults to sensible values.
#' @return An object of class `ModuleSpecifications`.
createEvidenceSynthesisModuleSpecifications <- function(evidenceSynthesisAnalysisList,
                                                        esDiagnosticThresholds = .createDefaultEsDiagnosticThresholds()) {
  moduleSettings <- list(
    evidenceSynthesisAnalysisList = evidenceSynthesisAnalysisList,
    esDiagnosticThresholds = esDiagnosticThresholds
  )
  return(.createModuleSpecifications("EvidenceSynthesisModule", moduleSettings))
}

# T040: TreatmentPatterns Module Specifications
#' @title Create TreatmentPatterns Module Specifications
#' @description Creates module specifications for the TreatmentPatterns module.
#' @param cohorts Data frame with cohorts for treatment patterns analysis.
#' @param includeTreatments Treatment types to include.
#' @param indexDateOffset Offset from index date.
#' @param minEraDuration Minimum era duration.
#' @param splitEventCohorts Cohorts to split.
#' @param splitTime Time to split at.
#' @param eraCollapseSize Era collapse size.
#' @param combinationWindow Combination window.
#' @param minPostCombinationDuration Minimum post-combination duration.
#' @param filterTreatments Filter treatments ("First", "All", etc.).
#' @param maxPathLength Maximum path length.
#' @param ageWindow Age window for grouping.
#' @param minCellCount Minimum cell count.
#' @param censorType Censor type ("minCellCount", etc.).
#' @param overlapMethod Overlap method ("truncate", etc.).
#' @param concatTargets Concatenate targets.
#' @return An object of class `ModuleSpecifications`.
createTreatmentPatternsModuleSpecifications <- function(cohorts,
                                                        includeTreatments = NULL,
                                                        indexDateOffset = NULL,
                                                        minEraDuration = 0,
                                                        splitEventCohorts = NULL,
                                                        splitTime = NULL,
                                                        eraCollapseSize = 30,
                                                        combinationWindow = 30,
                                                        minPostCombinationDuration = 30,
                                                        filterTreatments = "First",
                                                        maxPathLength = 5,
                                                        ageWindow = 5,
                                                        minCellCount = 1,
                                                        censorType = "minCellCount",
                                                        overlapMethod = "truncate",
                                                        concatTargets = TRUE) {
  moduleSettings <- list(
    cohorts = cohorts,
    includeTreatments = includeTreatments,
    indexDateOffset = indexDateOffset,
    minEraDuration = minEraDuration,
    splitEventCohorts = splitEventCohorts,
    splitTime = splitTime,
    eraCollapseSize = eraCollapseSize,
    combinationWindow = combinationWindow,
    minPostCombinationDuration = minPostCombinationDuration,
    filterTreatments = filterTreatments,
    maxPathLength = maxPathLength,
    ageWindow = ageWindow,
    minCellCount = minCellCount,
    censorType = censorType,
    overlapMethod = overlapMethod,
    concatTargets = concatTargets
  )
  return(.createModuleSpecifications("TreatmentPatternsModule", moduleSettings))
}

