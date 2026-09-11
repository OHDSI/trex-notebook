# HADES object field sets — raw evidence

Captured 2026-09-11 01:28 UTC from the running `alp-dataflow-gen-worker` container.
Every expected key set in the design and plan is transcribed from this output.

**These are `names(<constructor>(...))` — the OBJECT's fields — not `names(formals(...))`.**
The two differ: a field whose value is empty is dropped from the R object, so the object
is routinely smaller than the signature. The object is the contract.

Command (LD_LIBRARY_PATH is required or rJava fails before printing; the SqlRender
"Java library version does not match" warning on stderr is longstanding noise):

```bash
docker exec -w /var/lib/d2e-flows/hades-flow/baked alp-dataflow-gen-worker bash -c '
  B=/var/lib/d2e-flows/hades-flow/baked/.pixi/envs/default
  export LD_LIBRARY_PATH=$(find $B -name libjvm.so|head -1|xargs dirname):$LD_LIBRARY_PATH
  $B/bin/Rscript /tmp/gt.R 2>/dev/null'
```

```
### versions
  CohortMethod             5.5.2
  Cyclops                  3.6.0
  FeatureExtraction        3.11.0
  PatientLevelPrediction   6.5.0
  Strategus                1.4.0

### object field sets  (names(<constructor>(...)), NOT formals)
CM::getDbCohortMethodDataArgs            [args] studyStartDate, studyEndDate, firstExposureOnly, removeDuplicateSubjects, restrictToCommonPeriod, washoutPeriod, maxCohortSize, covariateSettings
CM::createStudyPopulationArgs            [args] firstExposureOnly, restrictToCommonPeriod, washoutPeriod, removeDuplicateSubjects, removeSubjectsWithPriorOutcome, priorOutcomeLookback, minDaysAtRisk, maxDaysAtRisk, riskWindowStart, startAnchor, riskWindowEnd, endAnchor, censorAtNewRiskWindow
CM::createPsArgs                         [args] maxCohortSizeForFitting, errorOnHighCorrelation, stopOnError, prior, control, estimator
CM::trimByPsArgs                         [args] trimFraction
CM::truncateIptwArgs                     [args] maxWeight
CM::matchOnPsArgs                        [args] caliper, caliperScale, maxRatio, allowReverseMatch
CM::stratifyByPsArgs                     [args] numberOfStrata, baseSelection
CM::computeCovariateBalanceArgs          [args] maxCohortSize
CM::fitOutcomeModelArgs                  [args] modelType, stratified, useCovariates, inversePtWeighting, profileBounds, prior, control
CM::cmAnalysis                           [cmAnalysis] analysisId, description, getDbCohortMethodDataArgs, createStudyPopArgs
CM::outcome                              [outcome] outcomeId, outcomeOfInterest, trueEffectSize
CM::targetComparatorOutcomes             [targetComparatorOutcomes] targetId, comparatorId, outcomes
CM::cmDiagnosticThresholds               [CmDiagnosticThresholds] mdrrThreshold, easeThreshold, sdmThreshold, equipoiseThreshold, generalizabilitySdmThreshold
Cyclops::control                         [cyclopsControl] maxIterations, tolerance, convergenceType, autoSearch, fold, lowerLimit, upperLimit, gridSteps, minCVData, cvRepetitions, noiseLevel, threads, seed, resetCoefficients, startingVariance, useKKTSwindle, tuneSwindle, selectorType, initialBound, maxBoundCount, algorithm, doItAll, syncCV
Cyclops::prior                           [cyclopsPrior] priorType, variance, exclude, graph, neighborhood, useCrossValidation, forceIntercept
FE::defaultCovariateSettings             [covariateSettings] temporal, temporalSequence, DemographicsGender, DemographicsAgeGroup, DemographicsRace, DemographicsEthnicity, DemographicsIndexYear, DemographicsIndexMonth, ConditionGroupEraLongTerm, ConditionGroupEraShortTerm, DrugGroupEraLongTerm, DrugGroupEraShortTerm, DrugGroupEraOverlapping, ProcedureOccurrenceLongTerm, ProcedureOccurrenceShortTerm, DeviceExposureLongTerm, DeviceExposureShortTerm, MeasurementLongTerm, MeasurementShortTerm, MeasurementRangeGroupLongTerm, MeasurementRangeGroupShortTerm, MeasurementValueAsConceptLongTerm, MeasurementValueAsConceptShortTerm, ObservationLongTerm, ObservationShortTerm, ObservationValueAsConceptLongTerm, ObservationValueAsConceptShortTerm, CharlsonIndex, Dcsi, Chads2, Chads2Vasc, includedCovariateConceptIds, includedCovariateIds, addDescendantsToInclude, excludedCovariateConceptIds, addDescendantsToExclude, shortTermStartDays, mediumTermStartDays, endDays, longTermStartDays
FE::covariateSettings(gender)            [covariateSettings] temporal, temporalSequence, DemographicsGender, longTermStartDays, mediumTermStartDays, shortTermStartDays, endDays, includedCovariateConceptIds, addDescendantsToInclude, excludedCovariateConceptIds, addDescendantsToExclude, includedCovariateIds
FE::temporalCovariateSettings            [covariateSettings] temporal, temporalSequence, ConditionEraGroupStart, temporalStartDays, temporalEndDays, includedCovariateConceptIds, addDescendantsToInclude, excludedCovariateConceptIds, addDescendantsToExclude, includedCovariateIds
PLP::restrictPlpDataSettings             [restrictPlpDataSettings] studyStartDate, studyEndDate, firstExposureOnly, washoutPeriod, sampleSize
PLP::studyPopulationSettings             [populationSettings] binary, includeAllOutcomes, firstExposureOnly, washoutPeriod, removeSubjectsWithPriorOutcome, priorOutcomeLookback, requireTimeAtRisk, minTimeAtRisk, riskWindowStart, startAnchor, riskWindowEnd, endAnchor, restrictTarToCohortEnd
PLP::preprocessSettings                  [preprocessSettings] minFraction, normalize, removeRedundancy
PLP::defaultSplitSetting                 [splitSettings] test, train, seed, nfold
PLP::executeSettings                     [executeSettings] runSplitData, runSampleData, runFeatureEngineering, runPreprocessData, runModelDevelopment, runCovariateSummary
PLP::lassoLogisticRegression             [modelSettings] fitFunction, param
PLP::modelDesign                         [modelDesign] targetId, outcomeId, restrictPlpDataSettings, covariateSettings, populationSettings, sampleSettings, featureEngineeringSettings, preprocessSettings, modelSettings, splitSettings, executeSettings

### attr(,"fun") values
  FE::defaultCovariateSettings fun         getDbDefaultCovariateData
  FE::temporalCovariateSettings fun        getDbDefaultCovariateData
```
