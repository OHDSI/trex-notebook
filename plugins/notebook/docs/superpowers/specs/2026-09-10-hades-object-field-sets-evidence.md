# HADES object field sets — raw evidence

Captured 2026-09-16 from the running `alp-dataflow-gen-worker` container, at the branch's
final state (after all six builder-alignment tasks and the Milestone A/B guard-hardening
pass). Every expected key set in the design, the plan, and the builders' version-tracking
headers is transcribed from this output. This regenerates the 2026-09-11 capture with the
same command and adds SelfControlledCaseSeries' installed version and the leaf-class values
its constructors report — the class values referenced by
`tests/StrategusSpecBuilder-cohortmethod-classes.test.R` and
`tests/strategus_spec_builder_classes.test.py`, and by `milestone-ab-fix-report.md`.

**These are `names(<constructor>(...))` — the OBJECT's fields — not `names(formals(...))`.**
The two differ: a field whose value is empty is dropped from the R object, so the object
is routinely smaller than the signature. The object is the contract.

Command (LD_LIBRARY_PATH is required or rJava fails before printing; the SqlRender
"Java library version does not match" warning on stderr is longstanding noise):

```bash
docker exec -w /var/lib/d2e-flows/hades-flow/baked alp-dataflow-gen-worker bash -c '
  B=/var/lib/d2e-flows/hades-flow/baked/.pixi/envs/default
  export LD_LIBRARY_PATH=$(find $B -name libjvm.so|head -1|xargs dirname):$LD_LIBRARY_PATH
  $B/bin/Rscript /tmp/gt2.R 2>/dev/null'
```

Script (`/tmp/gt2.R` inside the container; `docker cp`'d from a local scratch file):

```r
cat("### versions\n")
for (pkg in c("CohortMethod", "Cyclops", "FeatureExtraction", "PatientLevelPrediction",
              "Strategus", "SelfControlledCaseSeries")) {
  v <- tryCatch(as.character(packageVersion(pkg)), error = function(e) paste("ERROR:", conditionMessage(e)))
  cat(sprintf("  %-25s %s\n", pkg, v))
}

show <- function(label, obj) {
  cls <- paste(class(obj), collapse = "/")
  nm <- paste(names(obj), collapse = ", ")
  cat(sprintf("%-42s [%s] %s\n", label, cls, nm))
}

show("CM::getDbCohortMethodDataArgs", CohortMethod::createGetDbCohortMethodDataArgs(
  covariateSettings = FeatureExtraction::createCovariateSettings(useDemographicsGender = TRUE)))
show("CM::createStudyPopulationArgs", CohortMethod::createCreateStudyPopulationArgs())
show("CM::createPsArgs", CohortMethod::createCreatePsArgs())
show("CM::trimByPsArgs", CohortMethod::createTrimByPsArgs())
show("CM::truncateIptwArgs", CohortMethod::createTruncateIptwArgs())
show("CM::matchOnPsArgs", CohortMethod::createMatchOnPsArgs())
show("CM::stratifyByPsArgs", CohortMethod::createStratifyByPsArgs())
show("CM::computeCovariateBalanceArgs", CohortMethod::createComputeCovariateBalanceArgs())
show("CM::fitOutcomeModelArgs", CohortMethod::createFitOutcomeModelArgs())

show("Cyclops::control", Cyclops::createControl())
show("Cyclops::prior", Cyclops::createPrior(priorType = "laplace"))

show("FE::defaultCovariateSettings", FeatureExtraction::createDefaultCovariateSettings())
show("FE::covariateSettings(gender)", FeatureExtraction::createCovariateSettings(useDemographicsGender = TRUE))
show("FE::temporalCovariateSettings", FeatureExtraction::createTemporalCovariateSettings(useConditionEraGroupStart = TRUE))

show("PLP::restrictPlpDataSettings", PatientLevelPrediction::createRestrictPlpDataSettings())
show("PLP::studyPopulationSettings", PatientLevelPrediction::createStudyPopulationSettings())
show("PLP::preprocessSettings", PatientLevelPrediction::createPreprocessSettings())
show("PLP::defaultSplitSetting", PatientLevelPrediction::createDefaultSplitSetting())
show("PLP::executeSettings", PatientLevelPrediction::createExecuteSettings())
show("PLP::lassoLogisticRegression", PatientLevelPrediction::setLassoLogisticRegression())

scciSettings <- SelfControlledCaseSeries::createControlIntervalSettings()
show("SCCS::getDbSccsDataArgs", SelfControlledCaseSeries::createGetDbSccsDataArgs())
show("SCCS::createStudyPopulationArgs", SelfControlledCaseSeries::createCreateStudyPopulationArgs())
show("SCCS::createSccsIntervalDataArgs",
     SelfControlledCaseSeries::createCreateSccsIntervalDataArgs(eraCovariateSettings = list()))
show("SCCS::createScriIntervalDataArgs",
     SelfControlledCaseSeries::createCreateScriIntervalDataArgs(eraCovariateSettings = list(),
                                                                 controlIntervalSettings = scciSettings))
show("SCCS::fitSccsModelArgs", SelfControlledCaseSeries::createFitSccsModelArgs())
```

```
### versions
  CohortMethod              5.5.2
  Cyclops                   3.6.0
  FeatureExtraction         3.11.0
  PatientLevelPrediction    6.5.0
  Strategus                 1.4.0
  SelfControlledCaseSeries  6.1.0

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

### SCCS class values  (leaf class, verified against installed SelfControlledCaseSeries 6.1.0)
SCCS::getDbSccsDataArgs                  [GetDbSccsDataArgs/AbstractSerializableSettings/R6] .__enclos_env__, customCovariateIds, exposureIds, maxCasesPerOutcome, studyEndDates, studyStartDates, deleteCovariatesSmallCount, nestingCohortId, clone, validate, fromList, toJson, toList, initialize
SCCS::createStudyPopulationArgs          [CreateStudyPopulationArgs/AbstractSerializableSettings/R6] .__enclos_env__, restrictTimeToEraId, genderConceptIds, maxAge, minAge, naivePeriod, firstOutcomeOnly, clone, validate, fromList, toJson, toList, initialize
SCCS::createSccsIntervalDataArgs         [CreateSccsIntervalDataArgs/AbstractSerializableSettings/R6] .__enclos_env__, eventDependentObservation, endOfObservationEraLength, minCasesForTimeCovariates, calendarTimeCovariateSettings, seasonalityCovariateSettings, ageCovariateSettings, eraCovariateSettings, clone, fromList, validate, toJson, toList, initialize
SCCS::createScriIntervalDataArgs         [CreateScriIntervalDataArgs/AbstractSerializableSettings/R6] .__enclos_env__, controlIntervalSettings, eraCovariateSettings, clone, fromList, validate, toJson, toList, initialize
SCCS::fitSccsModelArgs                   [FitSccsModelArgs/AbstractSerializableSettings/R6] .__enclos_env__, profileBounds, profileGrid, control, prior, clone, fromList, validate, toJson, toList, initialize
```

## What this confirms

- The five HADES package versions (CohortMethod 5.5.2, Cyclops 3.6.0, FeatureExtraction
  3.11.0, PatientLevelPrediction 6.5.0, Strategus 1.4.0) and every CohortMethod,
  FeatureExtraction covariate-settings, Cyclops control/prior, and PatientLevelPrediction
  field set are unchanged from the 2026-09-11 capture — the builders' target has not moved.
- SelfControlledCaseSeries 6.1.0's five `*Args` constructors return R6 objects
  (`AbstractSerializableSettings`/`R6`) whose **leaf class** is the exact CamelCase name
  already used in both builders (`GetDbSccsDataArgs`, `CreateStudyPopulationArgs`,
  `CreateSccsIntervalDataArgs`, `CreateScriIntervalDataArgs`, `FitSccsModelArgs`) — not
  `"args"` the way the CohortMethod family is. This is why the SCCS class values were left
  unchanged (see `milestone-ab-fix-report.md`, item 3, and the corresponding test comments
  in `tests/StrategusSpecBuilder-cohortmethod-classes.test.R` and
  `tests/strategus_spec_builder_classes.test.py`).
- SCCS **argument names** (the field lists inside those five R6 objects, e.g.
  `getDbSccsDataArgs`'s `customCovariateIds`/`exposureIds`/…) were captured above for the
  record but were not diffed against the builders' emitted keys in this branch — that
  remains out of scope, per the design doc's "Out of scope, with reasons" section.

### attr(,"fun") values

Unchanged from the 2026-09-11 capture (not re-queried in this run; no code path touching
`attr(,"fun")` changed on this branch):

```
  FE::defaultCovariateSettings fun         getDbDefaultCovariateData
  FE::temporalCovariateSettings fun        getDbDefaultCovariateData
```
