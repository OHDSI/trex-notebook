import type {
  AnalysisSpecification,
  SharedResource,
  ModuleSpecification,
  CohortDefinitionSharedResources,
  NegativeControlOutcomeSharedResources,
  CohortSubset,
} from '../models/AnalysisSpec';
import type { TimeAtRiskWindow } from './DefaultsFactory';
import { createDefaultCovariateSettings } from './CovariateDefaults';
import { createPlpModelSettings } from './PlpModelDefaults';
import { overlay, overlayArrayByIndex, overlayScalarArrayKeepTail, isPlainObject } from './mergeSettings';

// The store type — we use a duck-typed interface so we don't create a circular dep
interface StrategusStoreSnapshot {
  cohorts: Array<{
    cohortId: number;
    cohortName: string;
    cohortDefinition: string;
    role: string;
  }>;
  outcomes: Array<{ cohortId: number; cleanWindow: number; outcomeName?: string }>;
  negativeControls: Array<{
    cohortId: number;
    cohortName: string;
    outcomeConceptId: number;
    standardConcept?: string;
    standardConceptCaption?: string;
    invalidReason?: string;
    invalidReasonCaption?: string;
    conceptCode?: string;
    domainId?: string;
    vocabularyId?: string;
    conceptClassId?: string;
    validStartDate?: string;
    validEndDate?: string;
  }>;
  ncOccurrenceType: 'first' | 'all';
  ncDetectOnDescendants: boolean;
  timeAtRisk: TimeAtRiskWindow[];
  sccsTimeAtRiskOverride: TimeAtRiskWindow[] | null;
  plpTimeAtRiskOverride: TimeAtRiskWindow[];
  cohortIncidenceTars: TimeAtRiskWindow[];
  cohortIncidenceAnalyses: Array<{
    targets: number[];
    outcomes: number[];
    tars: number[];
  }>;
  enabledModules: Record<string, boolean>;
  cohortDiagnosticsSettings: Record<string, unknown>;
  characterizationSettings: Record<string, unknown>;
  cohortIncidenceSettings: {
    byAge: boolean;
    byGender: boolean;
    byYear: boolean;
    ageBreaks: number[];
  };
  comparisons: Array<{
    targetId: number;
    comparatorId: number;
    indicationId: number | null;
    genderConceptIds: number[];
    minAge: number | null;
    maxAge: number | null;
    excludedCovariateConceptIds: number[];
  }>;
  studyStartDate: string | null;
  studyEndDate: string | null;
  cohortMethodSettings: {
    analyses: Array<{
      analysisId: number;
      description: string;
      psAdjustmentMethod: 'matching' | 'stratification' | 'iptw' | 'trimming' | 'none';
      psMatchMaxRatio: number;
      psStrataCount: number;
      iptwTruncationFraction: number;
      outcomeModelType: 'cox' | 'logistic' | 'poisson';
      useCleanWindowForPriorOutcomeLookback: boolean;
      riskWindowStart: number;
      startAnchor: 'cohort start' | 'cohort end';
      riskWindowEnd: number;
      endAnchor: 'cohort start' | 'cohort end';
      minDaysAtRisk: number;
      priorOutcomeLookback: number;
    }>;
    maxCohortSizeForFitting: number;
    maxCovBalanceCohortSize: number;
    restrictToCommonPeriod: boolean;
    firstExposureOnly: boolean;
    useEmpiricalCalibration: boolean;
    includedCovariateConceptIds: number[];
    customCovariateGroupName: string;
    addDescendantsToInclude: boolean;
    covariateFeatures: Record<string, boolean>;
    covariateWindows: { longTermStartDays: number; shortTermStartDays: number; endDays: number };
  };
  sccsSettings: {
    analyses: Array<{
      analysisId: number;
      description: string;
      eraWindows: Array<{
        label: string;
        start: number;
        end: number;
        startAnchor: 'era start' | 'era end';
        endAnchor: 'era start' | 'era end';
        exposureOfInterest: boolean;
        profileLikelihood: boolean;
      }>;
      naivePeriod: number;
      calendarTimeKnots: number;
      seasonalityKnots: number;
      includeAgeEffect: boolean;
      includeSeasonality: boolean;
      includeCalendarTime: boolean;
    }>;
    maxCasesPerOutcome: number;
    useEmpiricalCalibration: boolean;
  };
  plpSettings: {
    modelType: string;
    useDemographicsGender: boolean;
    useDemographicsAgeGroup: boolean;
    useConditionGroupEraLongTerm: boolean;
    useDrugGroupEraLongTerm: boolean;
    useVisitConceptCountLongTerm: boolean;
    useProcedureGroupEraLongTerm: boolean;
    useMeasurementValueLongTerm: boolean;
    useObservationEraLongTerm: boolean;
    maxSampleSize: number;
    testFraction: number;
    nfold: number;
    minFraction: number;
    normalize: boolean;
    removeRedundancy: boolean;
    removeSubjectsWithPriorOutcome: boolean;
    requireTimeAtRisk: boolean;
    washoutPeriod: number;
    priorOutcomeLookback: number;
    samplingStrategy: 'none' | 'underSample' | 'overSample';
    samplingNumberOutcomesToSampleTo: number;
    splitType: 'time' | 'subject' | 'stratified';
    runCalibration: boolean;
    calibrationBins: number;
    runFeatureEngineering: boolean;
    runSampleData: boolean;
    runPreprocessData: boolean;
    runModelDevelopment: boolean;
    runCovariateSummary: boolean;
    skipDiagnostics: boolean;
  };
  plpValidationSettings: {
    validationDesigns: Array<{
      plpModelPath: string;
      targetId: number | null;
      outcomeId: number | null;
      recalibrate: string;
      runCovariateSummary: boolean;
    }>;
  };
  treatmentPatternsSettings: {
    cohortRoles: Array<{ cohortId: number; cohortName: string; type: string }>;
    maxPathLength: number;
    combinationWindow: number;
    eraCollapseSize: number;
    minEraDuration: number;
    minPostCombinationDuration: number;
    filterTreatments: string;
    minCellCount: number;
    ageWindow: number;
    stratify: boolean;
    concatTargets: boolean;
    includeTreatments: string;
    indexDateOffset: number;
    censorType: string;
  };
  evidenceSynthesisSettings: {
    analyses: Array<{
      evidenceSynthesisAnalysisId: number;
      description: string;
      analysisType: 'FixedEffects' | 'RandomEffects' | 'Bayesian';
      sourceMethod: string;
      likelihoodApproximation: string;
      controlType: string;
      alpha: number;
      chainLength?: number;
      burnIn?: number;
      subSampleFrequency?: number;
      priorSd?: [number, number];
      robust?: boolean;
      df?: number;
      seed?: number;
    }>;
    mdrrThreshold: number;
    easeThreshold: number;
    i2Threshold: number;
    tauThreshold: number;
    alpha: number;
  };
  cohortSubsetDefinitions: Array<{
    id: number;
    name: string;
    operators: Array<{
      type: 'LimitSubsetOperator' | 'DemographicSubsetOperator' | 'CohortSubsetOperator';
      priorTime?: number;
      followUpTime?: number;
      limitTo?: string;
      calendarStartDate?: string;
      calendarEndDate?: string;
      ageMin?: number;
      ageMax?: number;
      gender?: number[];
      cohortIds?: number[];
      negate?: boolean;
    }>;
  }>;
  cohortSubsetAssignments: Array<{
    cohortId: number;
    subsetIds: number[];
  }>;
  moduleRawSettings: Record<string, Record<string, unknown>>;
  moduleRawProvenance: Record<string, Record<string, unknown>>;
  cohortsByRole: (role: string) => Array<{ cohortId: number; cohortName: string }>;
}

// Default gender concept IDs representing "no gender restriction"
const ALL_GENDER_IDS = [8507, 8532];

function isoToYyyymmdd(iso: string | null | undefined): string {
  if (!iso) return '';
  return iso.replace(/-/g, '');
}

function yyyymmddToIso(yyyymmdd: string): string | null {
  if (!yyyymmdd) return null;
  if (yyyymmdd.length !== 8) return yyyymmdd;
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

// Export for use in deserializer tests
export { isoToYyyymmdd, yyyymmddToIso };

function getSubsetCohortId(originalId: number, subsetDefId: number): number {
  return originalId * 1000 + subsetDefId;
}

function buildSubsetDefKey(tci: StrategusStoreSnapshot['comparisons'][number]): string {
  return JSON.stringify({
    indicationId: tci.indicationId,
    genderConceptIds: [...tci.genderConceptIds].sort(),
    minAge: tci.minAge,
    maxAge: tci.maxAge,
  });
}

/**
 * Returns a Map from restriction key -> subset definition ID (1-based).
 * Every TCI always gets a subset (for the LimitSubsetOperator / firstEver restriction).
 */
function buildSubsetDefIdMap(comparisons: StrategusStoreSnapshot['comparisons']): Map<string, number> {
  const seen = new Map<string, number>();
  let nextId = 1;
  for (const tci of comparisons) {
    const key = buildSubsetDefKey(tci);
    if (!seen.has(key)) {
      seen.set(key, nextId++);
    }
  }
  return seen;
}

/**
 * Builds the subset definition objects and cohort subset entries for the shared resources.
 */
function buildSubsetsForComparisons(comparisons: StrategusStoreSnapshot['comparisons']): {
  subsetDefs: unknown[];
  cohortSubsets: CohortSubset[];
} {
  if (comparisons.length === 0) {
    return { subsetDefs: [], cohortSubsets: [] };
  }

  const subsetDefIdMap = buildSubsetDefIdMap(comparisons);
  const subsetDefs: unknown[] = [];
  const cohortSubsets: CohortSubset[] = [];

  // Build one subset def per unique restriction combination
  const processedKeys = new Set<string>();
  for (const tci of comparisons) {
    const key = buildSubsetDefKey(tci);
    if (processedKeys.has(key)) continue;
    processedKeys.add(key);

    const subsetDefId = subsetDefIdMap.get(key)!;
    const operators: unknown[] = [];

    // Always add the LimitSubsetOperator (firstEver)
    operators.push({
      subsetType: 'LimitSubsetOperator',
      priorTime: 365,
      followUpTime: 1,
      limitTo: 'firstEver',
    });

    // If indication, add CohortSubsetOperator
    if (tci.indicationId !== null) {
      operators.push({
        subsetType: 'CohortSubsetOperator',
        cohortIds: [tci.indicationId],
      });
    }

    // If gender restricted (not both genders)
    const sortedGender = [...tci.genderConceptIds].sort();
    const isGenderRestricted =
      sortedGender.length !== ALL_GENDER_IDS.length ||
      !sortedGender.every((id, i) => id === [...ALL_GENDER_IDS].sort()[i]);
    if (isGenderRestricted && tci.genderConceptIds.length > 0) {
      operators.push({
        subsetType: 'DemographicSubsetOperator',
        gender: tci.genderConceptIds,
      });
    }

    // If age restricted
    if (tci.minAge !== null || tci.maxAge !== null) {
      operators.push({
        subsetType: 'DemographicSubsetOperator',
        ageMin: tci.minAge,
        ageMax: tci.maxAge,
      });
    }

    subsetDefs.push({
      definitionId: subsetDefId,
      name: `Subset ${subsetDefId}`,
      subsetOperators: operators,
    });
  }

  // Build cohort subset entries for each TCI's target and comparator
  const processedPairs = new Set<string>();
  for (const tci of comparisons) {
    const key = buildSubsetDefKey(tci);
    const subsetDefId = subsetDefIdMap.get(key)!;

    for (const originalCohortId of [tci.targetId, tci.comparatorId]) {
      const pairKey = `${originalCohortId}:${subsetDefId}`;
      if (processedPairs.has(pairKey)) continue;
      processedPairs.add(pairKey);

      cohortSubsets.push({
        cohortId: getSubsetCohortId(originalCohortId, subsetDefId),
        subsetId: subsetDefId,
        targetCohortId: originalCohortId,
      });
    }
  }

  return { subsetDefs, cohortSubsets };
}

// Mapping from SHORT store names to LONG JSON module names
const SHORT_TO_LONG: Record<string, string> = {
  CohortDiagnostics: 'CohortDiagnosticsModule',
  Characterization: 'CharacterizationModule',
  CohortIncidence: 'CohortIncidenceModule',
  CohortMethod: 'CohortMethodModule',
  SCCS: 'SelfControlledCaseSeriesModule',
  PLP: 'PatientLevelPredictionModule',
  PLPValidation: 'PatientLevelPredictionValidationModule',
  TreatmentPatterns: 'TreatmentPatternsModule',
  EvidenceSynthesis: 'EvidenceSynthesisModule',
};

/**
 * Builds subset definition objects for user-defined subset definitions.
 * User-defined subsets use IDs ≥ 1000 to avoid collision with TCI-generated ones (1..N).
 */
function buildUserDefinedSubsets(store: StrategusStoreSnapshot): {
  subsetDefs: unknown[];
  cohortSubsets: CohortSubset[];
} {
  const subsetDefs: unknown[] = [];
  const cohortSubsets: CohortSubset[] = [];

  for (const def of store.cohortSubsetDefinitions) {
    const subsetOperators = def.operators.map((op) => {
      if (op.type === 'LimitSubsetOperator') {
        return {
          name: 'limit',
          ...(op.priorTime !== undefined ? { priorTime: op.priorTime } : {}),
          ...(op.followUpTime !== undefined ? { followUpTime: op.followUpTime } : {}),
          ...(op.limitTo !== undefined ? { limitTo: op.limitTo } : {}),
          ...(op.calendarStartDate ? { calendarStartDate: op.calendarStartDate } : {}),
          ...(op.calendarEndDate ? { calendarEndDate: op.calendarEndDate } : {}),
          attr_class: ['LimitSubsetOperator', 'SubsetOperator'],
        };
      } else if (op.type === 'DemographicSubsetOperator') {
        return {
          name: 'demographic',
          ...(op.ageMin !== undefined ? { ageMin: op.ageMin } : {}),
          ...(op.ageMax !== undefined ? { ageMax: op.ageMax } : {}),
          ...(op.gender !== undefined ? { gender: op.gender } : {}),
          attr_class: ['DemographicSubsetOperator', 'SubsetOperator'],
        };
      } else {
        // CohortSubsetOperator
        return {
          name: 'cohort',
          cohortIds: op.cohortIds ?? [],
          negate: op.negate ?? false,
          attr_class: ['CohortSubsetOperator', 'SubsetOperator'],
        };
      }
    });

    subsetDefs.push({
      name: def.name,
      definitionId: def.id,
      subsetOperators,
      subsetCohortNameTemplate: '@baseCohortName - @subsetDefinitionName',
      attr_class: ['CohortSubsetDefinition'],
    });
  }

  // Build cohort subset entries from assignments
  const processedPairs = new Set<string>();
  for (const assignment of store.cohortSubsetAssignments) {
    for (const subsetId of assignment.subsetIds) {
      const pairKey = `${assignment.cohortId}:${subsetId}`;
      if (processedPairs.has(pairKey)) continue;
      processedPairs.add(pairKey);

      cohortSubsets.push({
        cohortId: getSubsetCohortId(assignment.cohortId, subsetId),
        subsetId,
        targetCohortId: assignment.cohortId,
      });
    }
  }

  return { subsetDefs, cohortSubsets };
}

function buildCohortDefinitionSharedResources(
  store: StrategusStoreSnapshot
): CohortDefinitionSharedResources {
  const { subsetDefs: tciSubsetDefs, cohortSubsets: tciCohortSubsets } = buildSubsetsForComparisons(store.comparisons);
  const { subsetDefs: userSubsetDefs, cohortSubsets: userCohortSubsets } = buildUserDefinedSubsets(store);

  // Real Strategus expects subsetDefs as JSON-encoded strings, not bare objects
  const allSubsetDefs = [...tciSubsetDefs, ...userSubsetDefs].map((def) => JSON.stringify(def));
  const allCohortSubsets = [...tciCohortSubsets, ...userCohortSubsets];

  const result: CohortDefinitionSharedResources = {
    cohortDefinitions: store.cohorts.map((c) => ({
      cohortId: c.cohortId,
      cohortName: c.cohortName,
      cohortDefinition: c.cohortDefinition,
    })),
    attr_class: ['CohortDefinitionSharedResources', 'SharedResources'],
  };
  if (allSubsetDefs.length > 0) {
    result.subsetDefs = allSubsetDefs;
    result.cohortSubsets = allCohortSubsets;
  }
  return result;
}

function buildNegativeControlSharedResources(
  store: StrategusStoreSnapshot
): NegativeControlOutcomeSharedResources {
  const META_KEYS = [
    'standardConcept', 'standardConceptCaption',
    'invalidReason', 'invalidReasonCaption',
    'conceptCode', 'domainId', 'vocabularyId', 'conceptClassId',
    'validStartDate', 'validEndDate',
  ] as const;

  return {
    negativeControlOutcomes: {
      negativeControlOutcomeCohortSet: store.negativeControls.map((nc) => {
        const entry: Record<string, unknown> = {
          cohortId: nc.cohortId,
          cohortName: nc.cohortName,
          outcomeConceptId: nc.outcomeConceptId,
        };
        // Round-trip any concept metadata captured at import time
        for (const k of META_KEYS) {
          const v = (nc as Record<string, unknown>)[k];
          if (v !== undefined) entry[k] = v;
        }
        return entry as { cohortId: number; cohortName: string; outcomeConceptId: number };
      }),
      occurrenceType: store.ncOccurrenceType,
      detectOnDescendants: store.ncDetectOnDescendants,
    },
    attr_class: ['NegativeControlOutcomeSharedResources', 'SharedResources'],
  };
}

function buildCohortGeneratorModule(): ModuleSpecification {
  return {
    module: 'CohortGeneratorModule',
    settings: { generateStats: true },
    attr_class: ['CohortGeneratorModuleSpecifications', 'ModuleSpecifications'],
  };
}

function buildCohortDiagnosticsModule(store: StrategusStoreSnapshot): ModuleSpecification {
  const cds = store.cohortDiagnosticsSettings as Record<string, unknown> & {
    temporalStartDays?: number[];
    temporalEndDays?: number[];
    cohortIds?: number[];
    temporalCovariateFeatures?: Record<string, boolean>;
  };
  const { temporalStartDays, temporalEndDays, cohortIds, temporalCovariateFeatures, ...rest } = cds;

  // cohortIds: emit actual IDs if specified, otherwise all cohort IDs (Strategus default is all)
  const resolvedCohortIds = (cohortIds && cohortIds.length > 0)
    ? cohortIds
    : store.cohorts.map((c) => c.cohortId);

  return {
    module: 'CohortDiagnosticsModule',
    settings: {
      ...rest,
      cohortIds: resolvedCohortIds,
      temporalCovariateSettings: {
        temporalStartDays: temporalStartDays ?? [-365, -180, -30, -1],
        temporalEndDays: temporalEndDays ?? [-181, -31, -1, 0],
        ...(temporalCovariateFeatures ?? {}),
        // Strategus defaults — pass these through so real specs round-trip cleanly
        includedCovariateConceptIds: [],
        excludedCovariateConceptIds: [],
        includedCovariateIds: [],
        attr_class: 'covariateSettings',
        attr_fun: 'getDbDefaultCovariateData',
      },
      incremental: false,
    },
    attr_class: ['CohortDiagnosticsModuleSpecifications', 'ModuleSpecifications'],
  };
}

function buildCharacterizationModule(store: StrategusStoreSnapshot): ModuleSpecification {
  // Include original target cohort IDs plus subset cohort IDs for each comparison TCI
  const baseTargetIds = store.cohortsByRole('Target').map((c) => c.cohortId);
  const subsetDefIdMap = buildSubsetDefIdMap(store.comparisons);
  const subsetCohortIds: number[] = [];
  for (const tci of store.comparisons) {
    const key = buildSubsetDefKey(tci);
    const subsetDefId = subsetDefIdMap.get(key);
    if (subsetDefId !== undefined) {
      const subsetTargetId = getSubsetCohortId(tci.targetId, subsetDefId);
      const subsetComparatorId = getSubsetCohortId(tci.comparatorId, subsetDefId);
      if (!baseTargetIds.includes(subsetTargetId) && !subsetCohortIds.includes(subsetTargetId)) {
        subsetCohortIds.push(subsetTargetId);
      }
      if (!baseTargetIds.includes(subsetComparatorId) && !subsetCohortIds.includes(subsetComparatorId)) {
        subsetCohortIds.push(subsetComparatorId);
      }
    }
  }
  const targetIds = [...baseTargetIds, ...subsetCohortIds];
  const outcomeIds = store.outcomes.map((o) => o.cohortId);
  const cs = store.characterizationSettings as Record<string, unknown>;

  const includeTargetBaseline = !!cs['includeTargetBaseline'];
  const includeRiskFactors = !!cs['includeRiskFactors'];
  const includeCaseSeries = !!cs['includeCaseSeries'];
  const includeTimeToEvent = !!cs['includeTimeToEvent'];
  const includeDechallengeRechallenge = !!cs['includeDechallengeRechallenge'];

  const dechallengeStopInterval = typeof cs['dechallengeStopInterval'] === 'number' ? cs['dechallengeStopInterval'] : 30;
  const dechallengeEvaluationWindow = typeof cs['dechallengeEvaluationWindow'] === 'number' ? cs['dechallengeEvaluationWindow'] : 30;

  const defaultCovariateSettings = {
    useDemographicsGender: true,
    useDemographicsAge: true,
    useDemographicsAgeGroup: true,
    useDemographicsRace: true,
    useDemographicsEthnicity: true,
    useDemographicsIndexYear: true,
    useDemographicsIndexMonth: true,
    useDemographicsIndexYearMonth: true,
    useDemographicsPriorObservationTime: true,
    useDemographicsPostObservationTime: true,
    useDemographicsTimeInCohort: true,
    useConditionOccurrenceLongTerm: true,
    useConditionOccurrenceShortTerm: true,
    useDrugExposureLongTerm: true,
    useDrugExposureShortTerm: true,
    useProcedureOccurrenceLongTerm: true,
    useProcedureOccurrenceShortTerm: true,
    attr_class: 'covariateSettings',
  };

  const minPriorObservation = typeof cs['minPriorObservation'] === 'number' ? cs['minPriorObservation'] : 365;
  const casePreTargetDuration = typeof cs['casePreTargetDuration'] === 'number' ? cs['casePreTargetDuration'] : 365;
  const casePostOutcomeDuration = typeof cs['casePostOutcomeDuration'] === 'number' ? cs['casePostOutcomeDuration'] : 365;

  // Strategus default caseCovariateSettings — pass-through to match real specs
  const defaultCaseCovariateSettings = {
    temporal: false,
    temporalSequence: false,
    ConditionGroupEraDuring: true,
    DrugGroupEraDuring: true,
    ProcedureOccurrenceDuring: true,
    DeviceExposureDuring: true,
    MeasurementDuring: true,
    ObservationDuring: true,
    VisitConceptCountDuring: true,
    includedCovariateConceptIds: [],
    addDescendantsToInclude: false,
    excludedCovariateConceptIds: [],
    addDescendantsToExclude: false,
    includedCovariateIds: [],
    attr_class: 'covariateSettings',
    attr_fun: 'Characterization::getDbDuringCovariateData',
  };

  // Common per-aggregate-settings Strategus defaults (round-trip passthrough)
  const aggExtras = {
    minPriorObservation,
    outcomeWashoutDays: minPriorObservation,
    casePreTargetDuration,
    casePostOutcomeDuration,
    extractNonCaseCovariates: true,
    caseCovariateSettings: defaultCaseCovariateSettings,
  };

  const aggregateCovariateSettings: unknown[] = [];
  if (includeTargetBaseline) {
    aggregateCovariateSettings.push({
      targetIds,
      outcomeIds: [],
      riskWindowStart: 1,
      startAnchor: 'cohort start',
      riskWindowEnd: 0,
      endAnchor: 'cohort end',
      covariateSettings: defaultCovariateSettings,
      ...aggExtras,
      attr_class: ['AggregateCovariateSettings', 'AnalysisSettings'],
    });
  }
  if (includeRiskFactors) {
    aggregateCovariateSettings.push({
      targetIds,
      outcomeIds,
      riskWindowStart: -365,
      startAnchor: 'cohort start',
      riskWindowEnd: -1,
      endAnchor: 'cohort start',
      covariateSettings: defaultCovariateSettings,
      ...aggExtras,
      attr_class: ['AggregateCovariateSettings', 'AnalysisSettings'],
    });
  }
  if (includeCaseSeries) {
    aggregateCovariateSettings.push({
      targetIds,
      outcomeIds,
      riskWindowStart: 0,
      startAnchor: 'cohort start',
      riskWindowEnd: 0,
      endAnchor: 'cohort end',
      covariateSettings: defaultCovariateSettings,
      ...aggExtras,
      attr_class: ['AggregateCovariateSettings', 'AnalysisSettings'],
    });
  }

  const timeToEventSettings: unknown[] = [];
  if (includeTimeToEvent) {
    timeToEventSettings.push({
      targetIds,
      outcomeIds,
      attr_class: ['TimeToEventSettings', 'AnalysisSettings'],
    });
  }

  const dechallengeRechallengeSettings: unknown[] = [];
  if (includeDechallengeRechallenge) {
    dechallengeRechallengeSettings.push({
      targetCohortDefinitionIds: targetIds,
      outcomeCohortDefinitionIds: outcomeIds,
      dechallengeStopInterval,
      dechallengeEvaluationWindow,
      attr_class: ['DechallengeRechallengeSettings', 'AnalysisSettings'],
    });
  }

  const analysis: Record<string, unknown> = {};
  if (aggregateCovariateSettings.length > 0) analysis['aggregateCovariateSettings'] = aggregateCovariateSettings;
  if (timeToEventSettings.length > 0) analysis['timeToEventSettings'] = timeToEventSettings;
  if (dechallengeRechallengeSettings.length > 0) analysis['dechallengeRechallengeSettings'] = dechallengeRechallengeSettings;

  const minCharacterizationMean = typeof cs['minCharacterizationMean'] === 'number' ? cs['minCharacterizationMean'] : 0.01;

  return {
    module: 'CharacterizationModule',
    settings: {
      analysis,
      minCharacterizationMean,
      mode: 'CohortIncidence',
      minSMD: 0.01,
      minCovariateCount: 5,
      outputTable: 'characterization_cohorts',
    },
    attr_class: ['CharacterizationModuleSpecifications', 'ModuleSpecifications'],
  };
}

function anchorToDateField(anchor: string): 'start' | 'end' {
  return anchor === 'cohort start' ? 'start' : 'end';
}

function buildCohortIncidenceModule(store: StrategusStoreSnapshot): ModuleSpecification {
  const targets = store.cohortsByRole('Target');
  const outcomes = store.outcomes;
  // Use per-CI TARs if non-empty, otherwise fall back to global timeAtRisk
  const tars = store.cohortIncidenceTars.length > 0 ? store.cohortIncidenceTars : store.timeAtRisk;
  const ciSettings = store.cohortIncidenceSettings;
  const ciCohortLookup = new Map(store.cohorts.map((c) => [c.cohortId, c.cohortName]));
  const subsetDefIdMap = buildSubsetDefIdMap(store.comparisons);

  // Cohort name lookup (best-effort) so outcomeDefs carries the real cohort name
  // instead of a generic placeholder.
  const outcomeNameFor = (cohortId: number, outcomeName?: string): string =>
    outcomeName ?? ciCohortLookup.get(cohortId) ?? `Outcome ${cohortId}`;

  // Strategus CohortIncidence references each target by its subset-cohort ID (target × subset),
  // which matches the IDs referenced in TCOs/cmAnalysisList. This makes CI defs round-trip cleanly
  // against real specs.
  const targetSubsetIds = new Map<number, number>(); // original cohortId -> subset cohort id (first subset)
  for (const tci of store.comparisons) {
    const key = buildSubsetDefKey(tci);
    const sid = subsetDefIdMap.get(key)!;
    for (const cid of [tci.targetId, tci.comparatorId]) {
      if (!targetSubsetIds.has(cid)) {
        targetSubsetIds.set(cid, getSubsetCohortId(cid, sid));
      }
    }
  }

  const targetDefs = targets.map((t) => {
    const id = targetSubsetIds.get(t.cohortId) ?? t.cohortId;
    return { id, name: t.cohortName, cohortId: id };
  });
  // outcomeDefs uses sequential 1-based IDs (id: index+1) separate from cohortId
  const outcomeDefs = outcomes.map((o, i) => ({
    id: i + 1,
    name: outcomeNameFor(o.cohortId, o.outcomeName),
    cohortId: o.cohortId,
    cleanWindow: o.cleanWindow,
  }));
  const timeAtRiskDefs = tars.map((tar, i) => ({
    id: i + 1,
    label: tar.label,
    start: { dateField: anchorToDateField(tar.startAnchor), offset: tar.riskWindowStart },
    end: { dateField: anchorToDateField(tar.endAnchor), offset: tar.riskWindowEnd },
  }));

  // Build analysisList from stored analyses if non-empty, otherwise default: all targets × all outcomes × all TARs
  let analysisList: unknown[];
  if (store.cohortIncidenceAnalyses.length > 0) {
    analysisList = store.cohortIncidenceAnalyses.map((a) => ({
      targets: a.targets,
      outcomes: a.outcomes,
      tars: a.tars,
    }));
  } else {
    analysisList = [{
      targets: targetDefs.map((t) => t.id),
      outcomes: outcomeDefs.map((o) => o.id),
      tars: timeAtRiskDefs.map((t) => t.id),
    }];
  }

  const strataSettings = {
    byAge: ciSettings.byAge,
    byGender: ciSettings.byGender,
    byYear: ciSettings.byYear,
    ageBreaks: ciSettings.ageBreaks,
  };

  const irDesign: Record<string, unknown> = {
    targetDefs,
    outcomeDefs,
    timeAtRiskDefs,
    analysisList,
    strataSettings,
  };

  if (store.studyStartDate || store.studyEndDate) {
    irDesign['studyWindow'] = {
      startDate: isoToYyyymmdd(store.studyStartDate),
      endDate: isoToYyyymmdd(store.studyEndDate),
    };
  }

  return {
    module: 'CohortIncidenceModule',
    settings: { irDesign },
    attr_class: ['CohortIncidenceModuleSpecifications', 'ModuleSpecifications'],
  };
}

function buildCohortMethodModule(store: StrategusStoreSnapshot): ModuleSpecification {
  const cms = store.cohortMethodSettings;
  const tars = store.timeAtRisk;
  const subsetDefIdMap = buildSubsetDefIdMap(store.comparisons);

  // Negative controls in outcome list only when empirical calibration is on and NCs are present
  const includeNcOutcomes = cms.useEmpiricalCalibration && store.negativeControls.length > 0;

  // One outcome list per analysis (useCleanWindowForPriorOutcomeLookback may differ)
  function buildOutcomeList(useCleanWindow: boolean) {
    return [
      ...store.outcomes.map((o) => ({
        outcomeId: o.cohortId,
        outcomeOfInterest: true,
        trueEffectSize: null,
        priorOutcomeLookback: useCleanWindow ? o.cleanWindow : 99999,
      })),
      ...(includeNcOutcomes ? store.negativeControls.map((nc) => ({
        outcomeId: nc.cohortId,
        outcomeOfInterest: false,
        trueEffectSize: 1,
        priorOutcomeLookback: null,
      })) : []),
    ];
  }

  const targetComparatorOutcomesList = store.comparisons.map((tci) => {
    const key = buildSubsetDefKey(tci);
    const subsetDefId = subsetDefIdMap.get(key)!;
    // Use the first analysis's clean-window setting for TCO list (shared across analyses)
    const firstAnalysis = cms.analyses[0];
    const useCleanWindow = firstAnalysis?.useCleanWindowForPriorOutcomeLookback ?? false;
    return {
      targetId: getSubsetCohortId(tci.targetId, subsetDefId),
      comparatorId: getSubsetCohortId(tci.comparatorId, subsetDefId),
      outcomes: buildOutcomeList(useCleanWindow),
      excludedCovariateConceptIds: tci.excludedCovariateConceptIds,
    };
  });

  // Build PS adjustment args based on method
  function buildPsAdjustmentArgs(analysis: StrategusStoreSnapshot['cohortMethodSettings']['analyses'][number]) {
    const method = analysis.psAdjustmentMethod;
    return {
      // Strategus Cohort Method matchOnPsArgs defaults preserved for round-trip
      matchOnPsArgs: method === 'matching' ? {
        caliper: 0.2,
        caliperScale: 'standardized logit',
        maxRatio: analysis.psMatchMaxRatio,
        allowReverseMatch: false,
      } : null,
      stratifyByPsArgs: method === 'stratification' ? { numberOfStrata: analysis.psStrataCount, baseSelection: 'all' } : null,
      truncateIptwArgs: method === 'iptw' ? { upperLimit: analysis.iptwTruncationFraction, lowerLimit: 1 - analysis.iptwTruncationFraction } : null,
      trimByPsArgs: method === 'trimming' ? {} : null,
    };
  }

  // cmAnalysisList: analyses.length × tars.length entries, sequential analysisId
  const cmAnalysisList: unknown[] = [];
  let analysisId = 1;
  for (const analysis of cms.analyses) {
    const psArgs = buildPsAdjustmentArgs(analysis);
    for (const tar of tars) {
      const tarDesc = tars.length > 1 ? `, ${tar.label}` : '';
      cmAnalysisList.push({
        analysisId: analysisId++,
        description: `${analysis.description}${tarDesc}`,
        getDbCohortMethodDataArgs: {
          firstExposureOnly: cms.firstExposureOnly,
          restrictToCommonPeriod: cms.restrictToCommonPeriod,
          studyStartDate: isoToYyyymmdd(store.studyStartDate),
          studyEndDate: isoToYyyymmdd(store.studyEndDate),
          // Strategus defaults — preserved for round-trip
          removeDuplicateSubjects: 'keep all',
          washoutPeriod: 0,
          maxCohortSize: 0,
          covariateSettings: createDefaultCovariateSettings({
            addDescendantsToExclude: true,
            includedCovariateConceptIds: cms.includedCovariateConceptIds,
            addDescendantsToInclude: cms.addDescendantsToInclude,
            features: cms.covariateFeatures,
            longTermStartDays: cms.covariateWindows?.longTermStartDays,
            shortTermStartDays: cms.covariateWindows?.shortTermStartDays,
            endDays: cms.covariateWindows?.endDays,
          }),
        },
        createStudyPopulationArgs: {
          riskWindowStart: tar.riskWindowStart,
          startAnchor: tar.startAnchor,
          riskWindowEnd: tar.riskWindowEnd,
          endAnchor: tar.endAnchor,
        },
        createStudyPopArgs: {
          firstExposureOnly: cms.firstExposureOnly,
          restrictToCommonPeriod: cms.restrictToCommonPeriod,
          washoutPeriod: 0,
          removeDuplicateSubjects: 'keep all',
          removeSubjectsWithPriorOutcome: true,
          priorOutcomeLookback: analysis.priorOutcomeLookback,
          minDaysAtRisk: analysis.minDaysAtRisk,
          maxDaysAtRisk: 99999,
          riskWindowStart: analysis.riskWindowStart,
          startAnchor: analysis.startAnchor,
          riskWindowEnd: analysis.riskWindowEnd,
          endAnchor: analysis.endAnchor,
          censorAtNewRiskWindow: false,
          attr_fun: 'createStudyPopulation',
        },
        createPsArgs: {
          maxCohortSizeForFitting: cms.maxCohortSizeForFitting,
          errorOnHighCorrelation: true,
          stopOnError: false,
          prior: {
            priorType: 'laplace',
            variance: 1,
            exclude: 0,
            graph: null,
            neighborhood: null,
            useCrossValidation: true,
            forceIntercept: false,
            attr_class: 'cyclopsPrior',
          },
          control: {
            maxIterations: 1000,
            tolerance: 2e-07,
            convergenceType: 'gradient',
            autoSearch: true,
            fold: 10,
            lowerLimit: 0.01,
            upperLimit: 20,
            gridSteps: 10,
            minCVData: 100,
            cvRepetitions: 1,
            noiseLevel: 'silent',
            threads: 1,
            seed: 1,
            resetCoefficients: true,
            startingVariance: 0.01,
            useKKTSwindle: false,
            tuneSwindle: 10,
            selectorType: 'auto',
            initialBound: 2,
            maxBoundCount: 5,
            algorithm: 'ccd',
            doItAll: true,
            syncCV: false,
            attr_class: 'cyclopsControl',
          },
          estimator: 'att',
        },
        ...psArgs,
        computeCovariateBalanceArgs: { maxCohortSize: cms.maxCovBalanceCohortSize, covariateFilter: null },
        computeSharedCovariateBalanceArgs: {
          maxCohortSize: cms.maxCovBalanceCohortSize,
        },
        fitOutcomeModelArgs: {
          modelType: analysis.outcomeModelType,
          stratified: analysis.psAdjustmentMethod !== 'none',
          useCovariates: false,
          inversePtWeighting: analysis.psAdjustmentMethod === 'iptw',
          // Match Strategus default profileBounds (log(10)≈2.3026) — keeps real specs round-tripping
          profileBounds: [-2.3026, 2.3026],
          // Full Strategus Cyclops prior — preserved for round-trip
          prior: {
            priorType: 'laplace',
            variance: 1,
            exclude: null,
            graph: null,
            neighborhood: null,
            useCrossValidation: true,
            forceIntercept: false,
            attr_class: 'cyclopsPrior',
          },
          // Full Strategus Cyclops control — preserved for round-trip
          control: {
            maxIterations: 1000,
            tolerance: 2e-07,
            convergenceType: 'gradient',
            autoSearch: true,
            fold: 10,
            lowerLimit: 0.01,
            upperLimit: 20,
            gridSteps: 10,
            minCVData: 100,
            cvRepetitions: 1,
            noiseLevel: 'quiet',
            threads: 1,
            seed: 1,
            resetCoefficients: true,
            startingVariance: 0.01,
            useKKTSwindle: false,
            tuneSwindle: 10,
            selectorType: 'auto',
            initialBound: 2,
            maxBoundCount: 5,
            algorithm: 'ccd',
            doItAll: true,
            syncCV: false,
            attr_class: 'cyclopsControl',
          },
        },
      });
    }
  }

  return {
    module: 'CohortMethodModule',
    settings: {
      cmAnalysisList,
      targetComparatorOutcomesList,
      refitPsForEveryOutcome: false,
      refitPsForEveryStudyPopulation: true,
      analysesToExclude: null,
      cmDiagnosticThresholds: {
        mdrrThreshold: 10,
        easeThreshold: 0.25,
        sdmThreshold: 0.1,
        equipoiseThreshold: 0.2,
        generalizabilitySdmThreshold: 999,
      },
    },
    attr_class: ['CohortMethodModuleSpecifications', 'ModuleSpecifications'],
  };
}

function buildSccsModule(store: StrategusStoreSnapshot): ModuleSpecification {
  const sccs = store.sccsSettings;
  const subsetDefIdMap = buildSubsetDefIdMap(store.comparisons);

  // Find the first indicationId across TCIs (used for nestingCohortId in getDbSccsDataArgs)
  const firstIndicationId = store.comparisons.find((tci) => tci.indicationId !== null)?.indicationId ?? null;

  // Find age/gender restrictions from the first TCI that has them
  const firstTciWithAge = store.comparisons.find((tci) => tci.minAge !== null || tci.maxAge !== null);
  const sccsMinAge = firstTciWithAge?.minAge ?? null;
  const sccsMaxAge = firstTciWithAge?.maxAge ?? null;

  const exposuresOutcomeList: unknown[] = [];
  for (const tci of store.comparisons) {
    const key = buildSubsetDefKey(tci);
    const subsetDefId = subsetDefIdMap.get(key)!;
    for (const originalExposureId of [tci.targetId, tci.comparatorId]) {
      const exposureId = getSubsetCohortId(originalExposureId, subsetDefId);
      for (const outcome of store.outcomes) {
        const baseEntry: Record<string, unknown> = {
          outcomeId: outcome.cohortId,
          exposures: [{ exposureId, exposureIdRef: 'exposureId', trueEffectSize: null }],
        };
        if (tci.indicationId !== null) baseEntry.nestingCohortId = tci.indicationId;
        exposuresOutcomeList.push(baseEntry);
      }
      if (sccs.useEmpiricalCalibration) {
        for (const nc of store.negativeControls) {
          const baseEntry: Record<string, unknown> = {
            outcomeId: nc.cohortId,
            exposures: [{ exposureId, exposureIdRef: 'exposureId', trueEffectSize: 1 }],
          };
          if (tci.indicationId !== null) baseEntry.nestingCohortId = tci.indicationId;
          exposuresOutcomeList.push(baseEntry);
        }
      }
    }
  }

  // Build sccsAnalysisList from analyses[] — one entry per analysis
  const sccsAnalysisList = sccs.analyses.map((analysis, idx) => {
    const eraCovariateSettings = analysis.eraWindows.map((w) => ({
      label: w.label,
      includeEraIds: 'exposureId',
      start: w.start,
      end: w.end,
      startAnchor: w.startAnchor,
      endAnchor: w.endAnchor,
      // Strategus defaults — passthrough so real specs round-trip cleanly
      stratifyById: false,
      firstOccurrenceOnly: false,
      allowRegularization: false,
      isControlInterval: false,
      exposureOfInterest: w.exposureOfInterest,
      profileLikelihood: w.profileLikelihood,
    }));

    const createIntervalDataArgs: Record<string, unknown> = {
      eraCovariateSettings,
    };
    if (analysis.includeCalendarTime) {
      createIntervalDataArgs['calendarTimeCovariateSettings'] = {
        calendarTimeKnots: analysis.calendarTimeKnots,
        allowRegularization: false,
        computeConfidenceIntervals: true,
      };
    }
    if (analysis.includeSeasonality) {
      createIntervalDataArgs['seasonalityCovariateSettings'] = {
        seasonKnots: analysis.seasonalityKnots,
        allowRegularization: false,
        computeConfidenceIntervals: true,
      };
    }
    if (analysis.includeAgeEffect) {
      createIntervalDataArgs['ageCovariateSettings'] = { ageKnots: 5, computeConfidenceIntervals: false };
    }
    // Always emit these Strategus defaults
    createIntervalDataArgs['minCasesForTimeCovariates'] = 100000;
    createIntervalDataArgs['eventDependentObservation'] = false;

    // Build getDbSccsDataArgs — include nestingCohortId when TCIs have indication
    const getDbSccsDataArgs: Record<string, unknown> = {
      useCustomCovariates: false,
      useNestingCohort: firstIndicationId !== null,
      deleteCovariatesSmallCount: 0,
      // Strategus uses studyStartDate/studyEndDate (singular) in newer schema
      studyStartDate: store.studyStartDate ? isoToYyyymmdd(store.studyStartDate) : '',
      studyEndDate: store.studyEndDate ? isoToYyyymmdd(store.studyEndDate) : '',
      maxCasesPerOutcome: sccs.maxCasesPerOutcome,
      exposureIds: 'exposureId',
      customCovariateIds: '',
    };
    if (firstIndicationId !== null) {
      getDbSccsDataArgs['nestingCohortId'] = firstIndicationId;
    }

    // createStudyPopulationArgs — include age restrictions and firstOutcomeOnly
    const createStudyPopulationArgs: Record<string, unknown> = {
      firstOutcomeOnly: true,
      naivePeriod: analysis.naivePeriod,
    };
    if (sccsMinAge !== null) createStudyPopulationArgs['minAge'] = sccsMinAge;
    if (sccsMaxAge !== null) createStudyPopulationArgs['maxAge'] = sccsMaxAge;
    createStudyPopulationArgs['genderConceptIds'] = null;

    return {
      analysisId: idx + 1,
      description: analysis.description,
      getDbSccsDataArgs,
      createStudyPopulationArgs,
      createIntervalDataArgs,
      fitSccsModelArgs: {
        prior: {
          priorType: 'laplace',
          variance: 1,
          exclude: null,
          graph: null,
          neighborhood: null,
          useCrossValidation: true,
          forceIntercept: false,
          attr_class: 'cyclopsPrior',
        },
        control: {
          maxIterations: 1000,
          tolerance: 1e-06,
          convergenceType: 'gradient',
          autoSearch: true,
          fold: 10,
          lowerLimit: 0.01,
          upperLimit: 20,
          gridSteps: 10,
          minCVData: 100,
          cvRepetitions: 1,
          noiseLevel: 'quiet',
          threads: 1,
          seed: 1,
          resetCoefficients: true,
          startingVariance: 0.1,
          useKKTSwindle: false,
          tuneSwindle: 10,
          selectorType: 'byPid',
          initialBound: 2,
          maxBoundCount: 5,
          algorithm: 'ccd',
          doItAll: true,
          syncCV: false,
          attr_class: 'cyclopsControl',
        },
        profileBounds: [-2.3026, 2.3026],
      },
    };
  });

  return {
    module: 'SelfControlledCaseSeriesModule',
    settings: {
      sccsAnalysisList,
      exposuresOutcomeList,
      combineDataFetchAcrossOutcomes: false,
      analysesToExclude: null,
      controlType: 'outcome',
      sccsDiagnosticThresholds: {
        mdrrThreshold: 10,
        easeThreshold: 0.25,
        timeTrendMaxRatio: 1.1,
        rareOutcomeMaxPrevalence: 0.1,
      },
    },
    attr_class: ['SelfControlledCaseSeriesModuleSpecifications', 'ModuleSpecifications'],
  };
}

function buildPlpModule(store: StrategusStoreSnapshot): ModuleSpecification {
  const plp = store.plpSettings;
  const targets = store.cohortsByRole('Target');
  const plpTars = store.plpTimeAtRiskOverride;
  const modelDesignList = [];
  for (const target of targets) {
    for (const outcome of store.outcomes) {
      for (const plpTar of plpTars) {
        const sampleSettings = plp.samplingStrategy === 'none'
          ? [{ numberOutcomestoNonOutcomes: 1, sampleSeed: 1, attr_class: 'sampleSettings', attr_fun: 'sameData' }]
          : [{ type: plp.samplingStrategy, numberOutcomesToSampleTo: plp.samplingNumberOutcomesToSampleTo, attr_class: 'sampleSettings' }];

        const featureEngineeringSettings = [
          { attr_class: 'featureEngineeringSettings', attr_fun: 'sameData' },
        ];

        modelDesignList.push({
          targetId: target.cohortId,
          outcomeId: outcome.cohortId,
          restrictPlpDataSettings: { studyStartDate: isoToYyyymmdd(store.studyStartDate), studyEndDate: isoToYyyymmdd(store.studyEndDate), firstExposureOnly: false, washoutPeriod: plp.washoutPeriod, sampleSize: plp.maxSampleSize },
          populationSettings: {
            binary: true,
            includeAllOutcomes: true,
            firstExposureOnly: false,
            washoutPeriod: 0,
            removeSubjectsWithPriorOutcome: plp.removeSubjectsWithPriorOutcome,
            priorOutcomeLookback: plp.priorOutcomeLookback,
            requireTimeAtRisk: plp.requireTimeAtRisk,
            minTimeAtRisk: Math.max(0, plpTar.riskWindowEnd - plpTar.riskWindowStart - 1),
            restrictTarToCohortEnd: false,
            riskWindowStart: plpTar.riskWindowStart,
            startAnchor: plpTar.startAnchor,
            riskWindowEnd: plpTar.riskWindowEnd,
            endAnchor: plpTar.endAnchor,
          },
          covariateSettings: {
            // PLP covariate settings — Strategus format (no "use" prefix in real specs)
            temporal: false,
            temporalSequence: false,
            DemographicsGender: plp.useDemographicsGender,
            DemographicsAgeGroup: plp.useDemographicsAgeGroup,
            ConditionGroupEraLongTerm: plp.useConditionGroupEraLongTerm,
            DrugGroupEraLongTerm: plp.useDrugGroupEraLongTerm,
            VisitConceptCountLongTerm: plp.useVisitConceptCountLongTerm,
            longTermStartDays: -365,
            mediumTermStartDays: -180,
            shortTermStartDays: -30,
            endDays: 0,
            includedCovariateConceptIds: [],
            addDescendantsToInclude: false,
            excludedCovariateConceptIds: [],
            addDescendantsToExclude: false,
            includedCovariateIds: [],
            attr_class: 'covariateSettings',
            attr_fun: 'getDbDefaultCovariateData',
          },
          preprocessSettings: { minFraction: plp.minFraction, normalize: plp.normalize, removeRedundancy: plp.removeRedundancy },
          modelSettings: createPlpModelSettings(plp.modelType),
          splitSettings: { type: plp.splitType, test: plp.testFraction, train: 1 - plp.testFraction, nfold: plp.nfold, seed: 1234, attr_fun: 'randomSplitter' },
          sampleSettings,
          featureEngineeringSettings,
          executeSettings: {
            runSplitData: true,
            runSampleData: plp.runSampleData,
            runFeatureEngineering: plp.runFeatureEngineering,
            runPreprocessData: plp.runPreprocessData,
            runModelDevelopment: plp.runModelDevelopment,
            runCovariateSummary: plp.runCovariateSummary,
            runCalibration: plp.runCalibration,
            calibrationBins: plp.calibrationBins,
          },
        });
      }
    }
  }
  return {
    module: 'PatientLevelPredictionModule',
    settings: { modelDesignList, skipDiagnostics: plp.skipDiagnostics },
    attr_class: ['PatientLevelPredictionModuleSpecifications', 'ModuleSpecifications'],
  };
}

function buildPlpValidationModule(store: StrategusStoreSnapshot): ModuleSpecification {
  return {
    module: 'PatientLevelPredictionValidationModule',
    settings: {
      validationList: store.plpValidationSettings.validationDesigns.map((d) => ({
        plpModelList: [d.plpModelPath],
        targetId: d.targetId,
        outcomeId: d.outcomeId,
        recalibrate: d.recalibrate,
        runCovariateSummary: d.runCovariateSummary,
      })),
    },
    attr_class: ['PatientLevelPredictionValidationModuleSpecifications', 'ModuleSpecifications'],
  };
}

function buildTreatmentPatternsModule(store: StrategusStoreSnapshot): ModuleSpecification {
  const tp = store.treatmentPatternsSettings;
  return {
    module: 'TreatmentPatternsModule',
    settings: {
      cohorts: tp.cohortRoles.map((r) => ({ cohortId: r.cohortId, cohortName: r.cohortName, type: r.type })),
      maxPathLength: tp.maxPathLength,
      combinationWindow: tp.combinationWindow,
      eraCollapseSize: tp.eraCollapseSize,
      minEraDuration: tp.minEraDuration,
      minPostCombinationDuration: tp.minPostCombinationDuration,
      filterTreatments: tp.filterTreatments,
      minCellCount: tp.minCellCount,
      ageWindow: tp.ageWindow,
      stratify: tp.stratify,
      concatTargets: tp.concatTargets,
      includeTreatments: tp.includeTreatments,
      indexDateOffset: tp.indexDateOffset,
      censorType: tp.censorType,
    },
    attr_class: ['TreatmentPatternsModuleSpecifications', 'ModuleSpecifications'],
  };
}

function buildEvidenceSynthesisModule(store: StrategusStoreSnapshot): ModuleSpecification {
  const es = store.evidenceSynthesisSettings;
  return {
    module: 'EvidenceSynthesisModule',
    settings: {
      evidenceSynthesisAnalysisList: es.analyses.map((a) => {
        const entry: Record<string, unknown> = {
          evidenceSynthesisAnalysisId: a.evidenceSynthesisAnalysisId,
          evidenceSynthesisDescription: a.description,
          evidenceSynthesisSource: { sourceMethod: a.sourceMethod, likelihoodApproximation: a.likelihoodApproximation },
          controlType: a.controlType,
          alpha: a.alpha,
          attr_class: [`${a.analysisType}MetaAnalysis`, 'EvidenceSynthesisAnalysis'],
        };
        if (a.analysisType === 'Bayesian') {
          if (a.chainLength !== undefined) entry['chainLength'] = a.chainLength;
          if (a.burnIn !== undefined) entry['burnIn'] = a.burnIn;
          if (a.subSampleFrequency !== undefined) entry['subSampleFrequency'] = a.subSampleFrequency;
          if (a.priorSd !== undefined) entry['priorSd'] = a.priorSd;
          if (a.robust !== undefined) entry['robust'] = a.robust;
          if (a.df !== undefined) entry['df'] = a.df;
          if (a.seed !== undefined) entry['seed'] = a.seed;
        }
        return entry;
      }),
      esDiagnosticThresholds: { mdrrThreshold: es.mdrrThreshold, easeThreshold: es.easeThreshold, i2Threshold: es.i2Threshold, tauThreshold: es.tauThreshold, alpha: es.alpha },
    },
    attr_class: ['EvidenceSynthesisModuleSpecifications', 'ModuleSpecifications'],
  };
}

// For each module, the settings keys whose VALUE is an array the editor
// rebuilds element-by-element. These need index-wise overlay against the raw
// array so unmodeled fields nested INSIDE each element survive (the top-level
// overlay replaces arrays wholesale, which would drop them).
//
// `keepRawTail` arrays are DERIVED from the model (the editor re-emits a subset
// of what was imported), so we preserve raw tail elements beyond the built
// length. Arrays without it are count-owned by the editor (removing an analysis
// must not resurrect it from the raw).
const ARRAY_OVERLAY_KEYS: Record<string, Array<{ key: string; keepRawTail?: boolean }>> = {
  CohortMethodModule: [{ key: 'cmAnalysisList' }, { key: 'targetComparatorOutcomesList' }],
  SelfControlledCaseSeriesModule: [{ key: 'sccsAnalysisList' }, { key: 'exposuresOutcomeList' }],
  PatientLevelPredictionModule: [{ key: 'modelDesignList', keepRawTail: true }],
};

// Characterization analysis.* sub-arrays carry derived cohort-id lists
// (targetIds / outcomeIds / targetCohortDefinitionIds / outcomeCohortDefinitionIds)
// the editor re-derives as a subset of the import. Preserve raw tail ids so
// imported targets/outcomes are not dropped.
const CHAR_ANALYSIS_ID_KEYS = [
  'targetIds',
  'outcomeIds',
  'targetCohortDefinitionIds',
  'outcomeCohortDefinitionIds',
];

/**
 * Overlay nested derived arrays inside a built settings object against the raw
 * captured settings, preserving raw-only elements/ids the editor re-derives as
 * a subset (CohortIncidence irDesign.targetDefs, Characterization analysis.*
 * cohort-id lists). Editor values win at shared indices; raw tail is kept.
 */
function overlayDerivedNestedArrays(
  longName: string,
  settings: Record<string, unknown>,
  raw: Record<string, unknown>,
): void {
  if (longName === 'CohortIncidenceModule') {
    const builtDesign = settings['irDesign'];
    const rawDesign = raw['irDesign'];
    if (isPlainObject(builtDesign) && isPlainObject(rawDesign)) {
      const builtTd = builtDesign['targetDefs'];
      const rawTd = rawDesign['targetDefs'];
      if (Array.isArray(builtTd) && Array.isArray(rawTd)) {
        builtDesign['targetDefs'] = overlayArrayByIndex(rawTd, builtTd, { keepRawTail: true });
      }
    }
  }

  if (longName === 'CharacterizationModule') {
    const builtAnalysis = settings['analysis'];
    const rawAnalysis = raw['analysis'];
    if (isPlainObject(builtAnalysis) && isPlainObject(rawAnalysis)) {
      for (const [groupKey, builtGroup] of Object.entries(builtAnalysis)) {
        const rawGroup = rawAnalysis[groupKey];
        if (!Array.isArray(builtGroup) || !Array.isArray(rawGroup)) continue;
        builtAnalysis[groupKey] = builtGroup.map((builtEl, i) => {
          const rawEl = rawGroup[i];
          if (!isPlainObject(builtEl) || !isPlainObject(rawEl)) return builtEl;
          const merged = overlay(rawEl, builtEl);
          for (const idKey of CHAR_ANALYSIS_ID_KEYS) {
            if (Array.isArray(builtEl[idKey]) && Array.isArray(rawEl[idKey])) {
              merged[idKey] = overlayScalarArrayKeepTail(rawEl[idKey], builtEl[idKey] as unknown[]);
            }
          }
          return merged;
        });
        // keep raw tail entries (extra analysis settings entries) too
        if (rawGroup.length > builtGroup.length) {
          for (let i = builtGroup.length; i < rawGroup.length; i++) {
            (builtAnalysis[groupKey] as unknown[]).push(rawGroup[i]);
          }
        }
      }
    }
  }
}

/**
 * Finalize a built module spec by overlaying its editor-managed settings onto
 * the RAW captured settings (so no imported option is dropped), re-emitting any
 * module-level provenance (version/remoteRepo/remoteUsername), and handling
 * array-nested unmodeled fields via per-element overlay.
 */
function finalizeModule(mod: ModuleSpecification, store: StrategusStoreSnapshot): ModuleSpecification {
  const longName = mod.module;
  const raw = store.moduleRawSettings[longName];
  const provenance = store.moduleRawProvenance[longName];

  let settings = mod.settings as Record<string, unknown>;

  if (raw) {
    // Overlay nested derived arrays in-place on the built settings BEFORE the
    // top-level overlay (which replaces these arrays wholesale).
    overlayDerivedNestedArrays(longName, settings, raw as Record<string, unknown>);

    // Base = raw captured settings; managed (built) fields overlaid on top.
    const merged = overlay(raw, settings);

    // For array-valued keys the editor rebuilds, overlay each built element
    // onto the corresponding raw element by index so nested unmodeled fields
    // survive while editor values win.
    for (const { key, keepRawTail } of ARRAY_OVERLAY_KEYS[longName] ?? []) {
      const builtArr = settings[key];
      const rawArr = (raw as Record<string, unknown>)[key];
      if (Array.isArray(builtArr) && Array.isArray(rawArr)) {
        merged[key] = overlayArrayByIndex(rawArr, builtArr, { keepRawTail });
      }
    }
    settings = merged;
  }

  const result: ModuleSpecification = {
    ...mod,
    settings,
  };

  // Re-emit module-level provenance captured at import time.
  if (provenance) {
    Object.assign(result as unknown as Record<string, unknown>, provenance);
  }

  return result;
}

export function serializeSpec(store: StrategusStoreSnapshot): AnalysisSpecification {
  // Build shared resources
  const sharedResources: SharedResource[] = [buildCohortDefinitionSharedResources(store)];

  if (store.negativeControls.length > 0) {
    sharedResources.push(buildNegativeControlSharedResources(store));
  }

  // Always include CohortGeneratorModule first
  const moduleSpecifications: ModuleSpecification[] = [buildCohortGeneratorModule()];

  // Add enabled modules
  for (const [shortName, longName] of Object.entries(SHORT_TO_LONG)) {
    if (!store.enabledModules[shortName]) {
      continue;
    }

    switch (shortName) {
      case 'CohortDiagnostics':
        moduleSpecifications.push(finalizeModule(buildCohortDiagnosticsModule(store), store));
        break;
      case 'Characterization':
        moduleSpecifications.push(finalizeModule(buildCharacterizationModule(store), store));
        break;
      case 'CohortIncidence':
        moduleSpecifications.push(finalizeModule(buildCohortIncidenceModule(store), store));
        break;
      case 'CohortMethod':
        moduleSpecifications.push(finalizeModule(buildCohortMethodModule(store), store));
        break;
      case 'SCCS':
        moduleSpecifications.push(finalizeModule(buildSccsModule(store), store));
        break;
      case 'PLP':
        moduleSpecifications.push(finalizeModule(buildPlpModule(store), store));
        break;
      case 'PLPValidation':
        moduleSpecifications.push(finalizeModule(buildPlpValidationModule(store), store));
        break;
      case 'TreatmentPatterns':
        moduleSpecifications.push(finalizeModule(buildTreatmentPatternsModule(store), store));
        break;
      case 'EvidenceSynthesis':
        moduleSpecifications.push(finalizeModule(buildEvidenceSynthesisModule(store), store));
        break;
      default:
        // Unknown module — skip (longName available for debugging)
        void longName;
        break;
    }
  }

  return {
    sharedResources,
    moduleSpecifications,
    attr_class: 'AnalysisSpecifications',
  };
}
