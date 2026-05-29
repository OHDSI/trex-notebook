export interface CohortDiagnosticsSettings {
  runInclusionStatistics: boolean;
  runIncludedSourceConcepts: boolean;
  runOrphanConcepts: boolean;
  runTimeSeries: boolean;
  runVisitContext: boolean;
  runBreakdownIndexEvents: boolean;
  runIncidenceRate: boolean;
  runCohortRelationship: boolean;
  runTemporalCohortCharacterization: boolean;
  minCharacterizationMean: number;
  irWashoutPeriod: number;
  temporalStartDays: number[];
  temporalEndDays: number[];
  cohortIds: number[];
  temporalCovariateFeatures: Record<string, boolean>;
}

export interface CharacterizationSettings {
  includeTimeToEvent: boolean;
  includeDechallengeRechallenge: boolean;
  includeTargetBaseline: boolean;
  includeRiskFactors: boolean;
  includeCaseSeries: boolean;
  minCharacterizationMean: number;
  minPriorObservation: number;
  dechallengeStopInterval: number;
  dechallengeEvaluationWindow: number;
  casePreTargetDuration: number;
  casePostOutcomeDuration: number;
}

export interface CohortIncidenceSettings {
  byAge: boolean;
  byGender: boolean;
  byYear: boolean;
  ageBreaks: number[];
}

export interface CohortMethodAnalysis {
  analysisId: number;
  description: string;
  psAdjustmentMethod: 'matching' | 'stratification' | 'iptw' | 'trimming' | 'none';
  psMatchMaxRatio: number;
  psStrataCount: number;
  iptwTruncationFraction: number;
  outcomeModelType: 'cox' | 'logistic' | 'poisson';
  useCleanWindowForPriorOutcomeLookback: boolean;
}

export interface CohortMethodSettings {
  analyses: CohortMethodAnalysis[];
  maxCohortSizeForFitting: number;
  maxCovBalanceCohortSize: number;
  restrictToCommonPeriod: boolean;
  firstExposureOnly: boolean;
  useEmpiricalCalibration: boolean;
  includedCovariateConceptIds: number[];
  customCovariateGroupName: string;
  addDescendantsToInclude: boolean;
  covariateFeatures: Record<string, boolean>;
  covariateWindows: {
    longTermStartDays: number;
    shortTermStartDays: number;
    endDays: number;
  };
}

export interface SccsEraWindow {
  label: string;
  start: number;
  end: number;
  startAnchor: 'era start' | 'era end';
  endAnchor: 'era start' | 'era end';
  exposureOfInterest: boolean;
  profileLikelihood: boolean;
}

export interface SccsAnalysis {
  analysisId: number;
  description: string;
  eraWindows: SccsEraWindow[];
  naivePeriod: number;
  calendarTimeKnots: number;
  seasonalityKnots: number;
  includeAgeEffect: boolean;
  includeSeasonality: boolean;
  includeCalendarTime: boolean;
}

export interface SccsSettings {
  analyses: SccsAnalysis[];
  maxCasesPerOutcome: number;
  useEmpiricalCalibration: boolean;
  // Legacy flat fields — kept for backward-compat but shadowed by analyses[]
  eraWindows?: SccsEraWindow[];
  naivePeriod?: number;
  calendarTimeKnots?: number;
  seasonalityKnots?: number;
  includeAgeEffect?: boolean;
  includeSeasonality?: boolean;
  includeCalendarTime?: boolean;
}

export interface PlpSettings {
  modelType: 'lassoLogisticRegression' | 'gradientBoosting' | 'randomForest' | 'adaBoost' | 'decisionTree' | 'mlp';
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
}

export interface PlpValidationDesign {
  plpModelPath: string;
  targetId: number | null;
  outcomeId: number | null;
  recalibrate: 'weakRecalibration' | 'none';
  runCovariateSummary: boolean;
}

export interface PlpValidationSettings {
  validationDesigns: PlpValidationDesign[];
}

export interface TreatmentPatternsSettings {
  cohortRoles: TreatmentPatternsCohortRole[];
  maxPathLength: number;
  combinationWindow: number;
  eraCollapseSize: number;
  minEraDuration: number;
  minPostCombinationDuration: number;
  filterTreatments: 'First' | 'Changes' | 'All';
  minCellCount: number;
  ageWindow: number;
  stratify: boolean;
  concatTargets: boolean;
  includeTreatments: 'All' | 'First' | 'Changes';
  indexDateOffset: number;
  censorType: 'minCellCount' | 'remove' | 'mean';
}

export interface TreatmentPatternsCohortRole {
  cohortId: number;
  cohortName: string;
  type: 'target' | 'event' | 'exit';
}

export type EsAnalysisType = 'FixedEffects' | 'RandomEffects' | 'Bayesian';

export interface EvidenceSynthesisAnalysis {
  evidenceSynthesisAnalysisId: number;
  description: string;
  analysisType: EsAnalysisType;
  sourceMethod: 'CohortMethod' | 'SelfControlledCaseSeries';
  likelihoodApproximation: 'adaptive grid' | 'normal';
  controlType: 'outcome' | 'exposure';
  alpha: number;
  // Bayesian-only fields
  chainLength?: number;
  burnIn?: number;
  subSampleFrequency?: number;
  priorSd?: [number, number];
  robust?: boolean;
  df?: number;
  seed?: number;
}

export interface EvidenceSynthesisSettings {
  analyses: EvidenceSynthesisAnalysis[];
  mdrrThreshold: number;
  easeThreshold: number;
  i2Threshold: number;
  tauThreshold: number;
  alpha: number;
}
