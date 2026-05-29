import type {
  CohortDiagnosticsSettings,
  CharacterizationSettings,
  CohortIncidenceSettings,
  CohortMethodSettings,
  CohortMethodAnalysis,
  SccsSettings,
  SccsAnalysis,
  SccsEraWindow,
  PlpSettings,
  PlpValidationSettings,
  TreatmentPatternsSettings,
  EvidenceSynthesisSettings,
} from '../models/ModuleSettings';

export interface TimeAtRiskWindow {
  label: string;
  riskWindowStart: number;
  startAnchor: 'cohort start' | 'cohort end';
  riskWindowEnd: number;
  endAnchor: 'cohort start' | 'cohort end';
}

export function createDefaultTimeAtRisk(): TimeAtRiskWindow {
  return {
    label: 'On treatment',
    riskWindowStart: 1,
    startAnchor: 'cohort start',
    riskWindowEnd: 0,
    endAnchor: 'cohort end',
  };
}

export function createDefaultPlpTimeAtRisk(): TimeAtRiskWindow {
  return {
    label: 'Fixed 365 days',
    riskWindowStart: 1,
    startAnchor: 'cohort start',
    riskWindowEnd: 365,
    endAnchor: 'cohort start',
  };
}

export const DEFAULT_TEMPORAL_COVARIATE_FEATURES: Record<string, boolean> = {
  DemographicsGender: true,
  DemographicsAge: true,
  DemographicsAgeGroup: true,
  DemographicsRace: true,
  DemographicsEthnicity: true,
  DemographicsIndexYear: true,
  DemographicsIndexMonth: true,
  DemographicsPriorObservationTime: true,
  DemographicsPostObservationTime: true,
  DemographicsTimeInCohort: true,
  DemographicsIndexYearMonth: true,
  ConditionEraStart: true,
  ConditionEraGroupStart: true,
  DrugEraStart: true,
  DrugEraGroupStart: true,
  ProcedureOccurrence: true,
  DeviceExposure: true,
  Measurement: true,
  MeasurementValue: true,
  MeasurementRangeGroup: true,
  Observation: true,
  CharlsonIndex: true,
  Dcsi: true,
  Chads2: true,
  Chads2Vasc: true,
};

export function createDefaultCohortDiagnostics(): CohortDiagnosticsSettings {
  return {
    runInclusionStatistics: true,
    runIncludedSourceConcepts: true,
    runOrphanConcepts: true,
    runTimeSeries: false,
    runVisitContext: true,
    runBreakdownIndexEvents: true,
    runIncidenceRate: true,
    runCohortRelationship: true,
    runTemporalCohortCharacterization: true,
    minCharacterizationMean: 0.01,
    irWashoutPeriod: 0,
    temporalStartDays: [-365, -180, -30, -1],
    temporalEndDays: [-181, -31, -1, 0],
    cohortIds: [],
    temporalCovariateFeatures: { ...DEFAULT_TEMPORAL_COVARIATE_FEATURES },
  };
}

export function createDefaultCharacterization(): CharacterizationSettings {
  return {
    includeTimeToEvent: true,
    includeDechallengeRechallenge: true,
    includeTargetBaseline: true,
    includeRiskFactors: true,
    includeCaseSeries: true,
    minCharacterizationMean: 0.01,
    minPriorObservation: 365,
    dechallengeStopInterval: 30,
    dechallengeEvaluationWindow: 30,
    casePreTargetDuration: 365,
    casePostOutcomeDuration: 365,
  };
}

export function createDefaultCohortIncidence(): CohortIncidenceSettings {
  return {
    byAge: true,
    byGender: true,
    byYear: true,
    ageBreaks: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110],
  };
}

export function createDefaultCohortMethodAnalysis(analysisId = 1): CohortMethodAnalysis {
  return {
    analysisId,
    description: 'PS matching 1:1',
    psAdjustmentMethod: 'matching',
    psMatchMaxRatio: 1,
    psStrataCount: 5,
    iptwTruncationFraction: 0.99,
    outcomeModelType: 'cox',
    useCleanWindowForPriorOutcomeLookback: false,
  };
}

export function createDefaultCovariateFeatures(): Record<string, boolean> {
  return {
    DemographicsGender: true,
    DemographicsAge: true,
    DemographicsAgeGroup: true,
    DemographicsRace: true,
    DemographicsEthnicity: true,
    DemographicsIndexYear: true,
    DemographicsIndexMonth: true,
    DemographicsPriorObservationTime: true,
    DemographicsPostObservationTime: true,
    DemographicsTimeInCohort: true,
    DemographicsIndexYearMonth: true,
    ConditionGroupEraLongTerm: true,
    ConditionGroupEraShortTerm: true,
    DrugGroupEraLongTerm: true,
    DrugGroupEraShortTerm: true,
    DrugGroupEraOverlapping: true,
    ProcedureOccurrenceLongTerm: true,
    ProcedureOccurrenceShortTerm: true,
    DeviceExposureLongTerm: true,
    DeviceExposureShortTerm: true,
    MeasurementLongTerm: true,
    MeasurementShortTerm: true,
    MeasurementRangeGroupLongTerm: true,
    ObservationLongTerm: true,
    ObservationShortTerm: true,
    CharlsonIndex: true,
    Dcsi: true,
    Chads2: true,
    Chads2Vasc: true,
    VisitCountLongTerm: true,
    VisitCountShortTerm: true,
    VisitConceptCountLongTerm: true,
    VisitConceptCountShortTerm: true,
  };
}

export function createDefaultCohortMethod(): CohortMethodSettings {
  return {
    analyses: [createDefaultCohortMethodAnalysis(1)],
    maxCohortSizeForFitting: 250000,
    maxCovBalanceCohortSize: 250000,
    restrictToCommonPeriod: false,
    firstExposureOnly: false,
    useEmpiricalCalibration: true,
    includedCovariateConceptIds: [],
    customCovariateGroupName: 'Custom',
    addDescendantsToInclude: false,
    covariateFeatures: createDefaultCovariateFeatures(),
    covariateWindows: {
      longTermStartDays: -365,
      shortTermStartDays: -30,
      endDays: 0,
    },
  };
}

export function createDefaultSccsEraWindows(): SccsEraWindow[] {
  return [
    {
      label: 'Pre-exposure',
      start: -30,
      end: -1,
      startAnchor: 'era start',
      endAnchor: 'era start',
      exposureOfInterest: false,
      profileLikelihood: false,
    },
    {
      label: 'Main',
      start: 0,
      end: 0,
      startAnchor: 'era start',
      endAnchor: 'era end',
      exposureOfInterest: true,
      profileLikelihood: true,
    },
  ];
}

export function createDefaultSccsAnalysis(analysisId = 1): SccsAnalysis {
  return {
    analysisId,
    description: 'SCCS',
    eraWindows: createDefaultSccsEraWindows(),
    naivePeriod: 365,
    calendarTimeKnots: 5,
    seasonalityKnots: 5,
    includeAgeEffect: false,
    includeSeasonality: true,
    includeCalendarTime: true,
  };
}

export function createDefaultSccs(): SccsSettings {
  return {
    analyses: [createDefaultSccsAnalysis(1)],
    maxCasesPerOutcome: 100000,
    useEmpiricalCalibration: true,
  };
}

export function createDefaultPlp(): PlpSettings {
  return {
    modelType: 'lassoLogisticRegression',
    useDemographicsGender: true,
    useDemographicsAgeGroup: true,
    useConditionGroupEraLongTerm: true,
    useDrugGroupEraLongTerm: true,
    useVisitConceptCountLongTerm: true,
    useProcedureGroupEraLongTerm: false,
    useMeasurementValueLongTerm: false,
    useObservationEraLongTerm: false,
    maxSampleSize: 1000000,
    testFraction: 0.25,
    nfold: 3,
    minFraction: 0.001,
    normalize: true,
    removeRedundancy: true,
    removeSubjectsWithPriorOutcome: true,
    requireTimeAtRisk: true,
    washoutPeriod: 365,
    priorOutcomeLookback: 99999,
    samplingStrategy: 'none',
    samplingNumberOutcomesToSampleTo: 10000,
    splitType: 'subject',
    runCalibration: true,
    calibrationBins: 10,
  };
}

export function createDefaultPlpValidation(): PlpValidationSettings {
  return {
    validationDesigns: [],
  };
}

export function createDefaultTreatmentPatterns(): TreatmentPatternsSettings {
  return {
    cohortRoles: [],
    maxPathLength: 5,
    combinationWindow: 30,
    eraCollapseSize: 30,
    minEraDuration: 0,
    minPostCombinationDuration: 30,
    filterTreatments: 'First',
    minCellCount: 5,
    ageWindow: 5,
    stratify: false,
    concatTargets: false,
    includeTreatments: 'First',
    indexDateOffset: 0,
    censorType: 'minCellCount',
  };
}

export function createDefaultEvidenceSynthesis(): EvidenceSynthesisSettings {
  return {
    analyses: [],
    mdrrThreshold: 10,
    easeThreshold: 0.25,
    i2Threshold: 0.4,
    tauThreshold: Math.log(2),
    alpha: 0.05,
  };
}
