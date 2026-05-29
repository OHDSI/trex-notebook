import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useStrategusStore } from '../src/store/useStrategusStore';
import { serializeSpec } from '../src/services/SpecSerializer';
import { deserializeSpec } from '../src/services/SpecDeserializer';
import type { AnalysisSpecification } from '../src/models/AnalysisSpec';

// Helper to create a minimal valid spec
function makeMinimalSpec(): AnalysisSpecification {
  return {
    attr_class: 'AnalysisSpecifications',
    sharedResources: [
      {
        cohortDefinitions: [],
        attr_class: ['CohortDefinitionSharedResources', 'SharedResources'],
      },
    ],
    moduleSpecifications: [
      {
        module: 'CohortGeneratorModule',
        settings: { generateStats: true },
        attr_class: ['CohortGeneratorModuleSpecifications', 'ModuleSpecifications'],
      },
    ],
  };
}

describe('SpecDeserializer', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  // 1. round-trips cohorts
  it('round-trips cohorts', () => {
    const store = useStrategusStore();
    store.cohorts = [
      { cohortId: 1, cohortName: 'Target A', role: 'Target', subjectCount: 100, cohortDefinition: '{"foo":1}' },
      { cohortId: 2, cohortName: 'Outcome B', role: 'Outcome', subjectCount: null, cohortDefinition: '{"bar":2}' },
    ];

    const spec = serializeSpec(store);

    // Reset the store to verify deserialize restores it
    store.resetToDefaults();
    expect(store.cohorts).toHaveLength(0);

    deserializeSpec(spec, store);

    // Cohorts are restored (role defaults to Target on import, subjectCount to null)
    expect(store.cohorts).toHaveLength(2);
    expect(store.cohorts[0].cohortId).toBe(1);
    expect(store.cohorts[0].cohortName).toBe('Target A');
    expect(store.cohorts[0].cohortDefinition).toBe('{"foo":1}');
    expect(store.cohorts[1].cohortId).toBe(2);
    expect(store.cohorts[1].cohortName).toBe('Outcome B');
  });

  // 2. round-trips negative controls
  it('round-trips negative controls', () => {
    const store = useStrategusStore();
    store.negativeControls = [
      { cohortId: 99, cohortName: 'NC 1', outcomeConceptId: 7777777 },
      { cohortId: 100, cohortName: 'NC 2', outcomeConceptId: 8888888 },
    ];
    store.ncOccurrenceType = 'all';
    store.ncDetectOnDescendants = false;

    const spec = serializeSpec(store);
    store.resetToDefaults();

    deserializeSpec(spec, store);

    expect(store.negativeControls).toHaveLength(2);
    expect(store.negativeControls[0].cohortId).toBe(99);
    expect(store.negativeControls[0].outcomeConceptId).toBe(7777777);
    expect(store.negativeControls[1].cohortId).toBe(100);
    expect(store.ncOccurrenceType).toBe('all');
    expect(store.ncDetectOnDescendants).toBe(false);
  });

  // 3. enables only modules present in the spec
  it('enables only modules present in the spec', () => {
    const store = useStrategusStore();
    // Enable only CohortDiagnostics
    store.enabledModules.CohortDiagnostics = true;
    store.enabledModules.Characterization = false;
    store.enabledModules.CohortIncidence = false;
    store.enabledModules.CohortMethod = false;
    store.enabledModules.SCCS = false;
    store.enabledModules.PLP = false;
    store.enabledModules.PLPValidation = false;
    store.enabledModules.TreatmentPatterns = false;
    store.enabledModules.EvidenceSynthesis = false;

    const spec = serializeSpec(store);

    // Use a fresh store
    const store2 = useStrategusStore();
    // Pre-set some enabled state that should be overwritten
    store2.enabledModules.CohortMethod = true;
    store2.enabledModules.SCCS = true;

    deserializeSpec(spec, store2);

    expect(store2.enabledModules.CohortDiagnostics).toBe(true);
    expect(store2.enabledModules.Characterization).toBe(false);
    expect(store2.enabledModules.CohortIncidence).toBe(false);
    expect(store2.enabledModules.CohortMethod).toBe(false);
    expect(store2.enabledModules.SCCS).toBe(false);
    expect(store2.enabledModules.PLP).toBe(false);
  });

  // 4. round-trips cohort diagnostics settings
  it('round-trips cohort diagnostics settings', () => {
    const store = useStrategusStore();
    store.cohortDiagnosticsSettings.runTimeSeries = true;
    store.cohortDiagnosticsSettings.irWashoutPeriod = 180;
    store.cohortDiagnosticsSettings.minCharacterizationMean = 0.05;
    store.cohortDiagnosticsSettings.runInclusionStatistics = false;
    store.enabledModules.CohortDiagnostics = true;

    const spec = serializeSpec(store);
    store.resetToDefaults();

    // Confirm defaults are different
    expect(store.cohortDiagnosticsSettings.runTimeSeries).toBe(false);
    expect(store.cohortDiagnosticsSettings.irWashoutPeriod).toBe(0);

    deserializeSpec(spec, store);

    expect(store.cohortDiagnosticsSettings.runTimeSeries).toBe(true);
    expect(store.cohortDiagnosticsSettings.irWashoutPeriod).toBe(180);
    expect(store.cohortDiagnosticsSettings.minCharacterizationMean).toBe(0.05);
    expect(store.cohortDiagnosticsSettings.runInclusionStatistics).toBe(false);
  });

  // 5. round-trips characterization settings
  it('round-trips characterization settings', () => {
    const store = useStrategusStore();
    store.characterizationSettings.minCharacterizationMean = 0.05;
    store.characterizationSettings.includeTimeToEvent = true;
    store.characterizationSettings.includeDechallengeRechallenge = true;
    store.characterizationSettings.includeTargetBaseline = true;
    store.characterizationSettings.includeRiskFactors = false;
    store.characterizationSettings.includeCaseSeries = false;
    store.characterizationSettings.dechallengeStopInterval = 45;
    store.characterizationSettings.dechallengeEvaluationWindow = 60;
    store.enabledModules.Characterization = true;
    store.cohorts = [
      { cohortId: 1, cohortName: 'Target', role: 'Target', subjectCount: null, cohortDefinition: '' },
    ];
    store.outcomes = [{ cohortId: 10, cleanWindow: 30 }];

    const spec = serializeSpec(store);
    store.resetToDefaults();

    deserializeSpec(spec, store);

    expect(store.characterizationSettings.minCharacterizationMean).toBe(0.05);
    // includeTimeToEvent: timeToEventSettings array present → true
    expect(store.characterizationSettings.includeTimeToEvent).toBe(true);
    // includeDechallengeRechallenge: DR array present → true
    expect(store.characterizationSettings.includeDechallengeRechallenge).toBe(true);
    // includeTargetBaseline: aggregateCovariateSettings with outcomeIds=[] → true
    expect(store.characterizationSettings.includeTargetBaseline).toBe(true);
    // includeRiskFactors=false: no outcome-linked aggregateCovariateSettings → false
    expect(store.characterizationSettings.includeRiskFactors).toBe(false);
    // DR numeric fields round-trip
    expect(store.characterizationSettings.dechallengeStopInterval).toBe(45);
    expect(store.characterizationSettings.dechallengeEvaluationWindow).toBe(60);
  });

  // 6. sets activePanel to 'overview' after import
  it("sets activePanel to 'overview' after import", () => {
    const store = useStrategusStore();
    store.activePanel = 'cohortDiagnostics' as typeof store.activePanel;

    const spec = makeMinimalSpec();
    deserializeSpec(spec, store);

    expect(store.activePanel).toBe('overview');
  });

  // 7. resets store before populating
  it('resets store before populating', () => {
    const store = useStrategusStore();
    // Put some state in
    store.negativeControls = [{ cohortId: 1, cohortName: 'NC', outcomeConceptId: 999 }];
    store.cohorts = [{ cohortId: 5, cohortName: 'Old', role: 'Target', subjectCount: null, cohortDefinition: '' }];

    // Import a minimal spec with no cohorts and no NCs
    const spec = makeMinimalSpec();
    deserializeSpec(spec, store);

    // Old data should be gone
    expect(store.negativeControls).toHaveLength(0);
    expect(store.cohorts).toHaveLength(0);
  });

  // 8. handles spec with multiple modules
  it('handles spec with multiple modules', () => {
    const store = useStrategusStore();
    store.enabledModules.CohortDiagnostics = true;
    store.enabledModules.Characterization = true;
    store.enabledModules.CohortIncidence = true;
    store.enabledModules.CohortMethod = false;
    store.enabledModules.SCCS = false;
    store.enabledModules.PLP = false;

    const spec = serializeSpec(store);
    store.resetToDefaults();

    deserializeSpec(spec, store);

    expect(store.enabledModules.CohortDiagnostics).toBe(true);
    expect(store.enabledModules.Characterization).toBe(true);
    expect(store.enabledModules.CohortIncidence).toBe(true);
    expect(store.enabledModules.CohortMethod).toBe(false);
    expect(store.enabledModules.SCCS).toBe(false);
    expect(store.enabledModules.PLP).toBe(false);
  });

  // 9. gracefully handles spec with no negative controls
  it('gracefully handles spec with no negative controls', () => {
    const store = useStrategusStore();
    store.negativeControls = [];

    const spec = serializeSpec(store);
    store.resetToDefaults();

    // Should not throw
    expect(() => deserializeSpec(spec, store)).not.toThrow();
    expect(store.negativeControls).toHaveLength(0);
  });

  // 10. full round-trip produces same spec structure (module count)
  it('full round-trip produces same spec structure', () => {
    const store = useStrategusStore();
    store.cohorts = [
      { cohortId: 1, cohortName: 'Target', role: 'Target', subjectCount: null, cohortDefinition: '{}' },
    ];
    store.negativeControls = [{ cohortId: 99, cohortName: 'NC', outcomeConceptId: 111 }];
    store.enabledModules.CohortDiagnostics = true;
    store.enabledModules.Characterization = true;
    store.enabledModules.CohortMethod = false;
    store.enabledModules.SCCS = false;

    const spec1 = serializeSpec(store);
    store.resetToDefaults();
    deserializeSpec(spec1, store);
    const spec2 = serializeSpec(store);

    // Same number of module specifications
    expect(spec2.moduleSpecifications.length).toBe(spec1.moduleSpecifications.length);
    // Same modules present
    const names1 = spec1.moduleSpecifications.map((m) => m.module).sort();
    const names2 = spec2.moduleSpecifications.map((m) => m.module).sort();
    expect(names2).toEqual(names1);
  });

  // 11. round-trip CohortMethod settings (psMatchMaxRatio via analyses[0])
  it('round-trips CohortMethod psMatchMaxRatio', () => {
    const store = useStrategusStore();
    store.cohortMethodSettings.analyses[0].psMatchMaxRatio = 5;
    store.cohortMethodSettings.maxCohortSizeForFitting = 150000;
    store.cohortMethodSettings.firstExposureOnly = true;
    store.comparisons = [
      { targetId: 1, comparatorId: 2, indicationId: null, genderConceptIds: [], minAge: null, maxAge: null, excludedCovariateConceptIds: [] },
    ];
    store.enabledModules.CohortMethod = true;
    store.enabledModules.CohortDiagnostics = false;
    store.enabledModules.Characterization = false;
    store.enabledModules.CohortIncidence = false;
    store.enabledModules.SCCS = false;

    const spec = serializeSpec(store);
    store.resetToDefaults();

    deserializeSpec(spec, store);

    expect(store.cohortMethodSettings.analyses[0].psMatchMaxRatio).toBe(5);
    expect(store.cohortMethodSettings.maxCohortSizeForFitting).toBe(150000);
    expect(store.cohortMethodSettings.firstExposureOnly).toBe(true);
  });

  // 12. round-trip SCCS settings
  it('round-trips SCCS settings including era windows', () => {
    const store = useStrategusStore();
    store.sccsSettings.maxCasesPerOutcome = 50000;
    store.sccsSettings.analyses[0].naivePeriod = 180;
    store.sccsSettings.analyses[0].eraWindows = [
      { label: 'Pre-exposure', start: -60, end: -2, startAnchor: 'era start', endAnchor: 'era start', exposureOfInterest: false, profileLikelihood: false },
      { label: 'Main', start: 0, end: 0, startAnchor: 'era start', endAnchor: 'era end', exposureOfInterest: true, profileLikelihood: true },
    ];
    store.sccsSettings.analyses[0].calendarTimeKnots = 7;
    store.sccsSettings.analyses[0].seasonalityKnots = 3;
    store.sccsSettings.analyses[0].includeCalendarTime = true;
    store.sccsSettings.analyses[0].includeSeasonality = true;
    store.enabledModules.SCCS = true;
    store.enabledModules.CohortDiagnostics = false;
    store.enabledModules.Characterization = false;
    store.enabledModules.CohortIncidence = false;
    store.enabledModules.CohortMethod = false;

    const spec = serializeSpec(store);
    store.resetToDefaults();

    deserializeSpec(spec, store);

    expect(store.sccsSettings.maxCasesPerOutcome).toBe(50000);
    expect(store.sccsSettings.analyses).toHaveLength(1);
    expect(store.sccsSettings.analyses[0].naivePeriod).toBe(180);
    expect(store.sccsSettings.analyses[0].eraWindows).toHaveLength(2);
    expect(store.sccsSettings.analyses[0].eraWindows[0].label).toBe('Pre-exposure');
    expect(store.sccsSettings.analyses[0].eraWindows[0].start).toBe(-60);
    expect(store.sccsSettings.analyses[0].eraWindows[0].end).toBe(-2);
    expect(store.sccsSettings.analyses[0].eraWindows[1].exposureOfInterest).toBe(true);
    expect(store.sccsSettings.analyses[0].calendarTimeKnots).toBe(7);
    expect(store.sccsSettings.analyses[0].seasonalityKnots).toBe(3);
    expect(store.sccsSettings.analyses[0].includeCalendarTime).toBe(true);
    expect(store.sccsSettings.analyses[0].includeSeasonality).toBe(true);
  });

  // 13. round-trip PLP settings (modelType)
  it('round-trips PLP modelType and key settings', () => {
    const store = useStrategusStore();
    store.cohorts = [
      { cohortId: 1, cohortName: 'Target', role: 'Target', subjectCount: null, cohortDefinition: '' },
    ];
    store.outcomes = [{ cohortId: 10, cleanWindow: 30 }];
    store.plpSettings.modelType = 'gradientBoosting';
    store.plpSettings.maxSampleSize = 500000;
    store.plpSettings.testFraction = 0.3;
    store.plpSettings.nfold = 5;
    store.plpSettings.useDemographicsGender = false;
    store.enabledModules.PLP = true;
    store.enabledModules.CohortDiagnostics = false;
    store.enabledModules.Characterization = false;
    store.enabledModules.CohortIncidence = false;
    store.enabledModules.CohortMethod = false;
    store.enabledModules.SCCS = false;

    const spec = serializeSpec(store);
    store.resetToDefaults();

    deserializeSpec(spec, store);

    expect(store.plpSettings.modelType).toBe('gradientBoosting');
    expect(store.plpSettings.maxSampleSize).toBe(500000);
    expect(store.plpSettings.testFraction).toBe(0.3);
    expect(store.plpSettings.nfold).toBe(5);
    expect(store.plpSettings.useDemographicsGender).toBe(false);
  });

  // 14. round-trip TreatmentPatterns (cohortRoles)
  it('round-trips TreatmentPatterns cohortRoles and numeric settings', () => {
    const store = useStrategusStore();
    store.treatmentPatternsSettings.cohortRoles = [
      { cohortId: 1, cohortName: 'Drug A', type: 'event' },
      { cohortId: 2, cohortName: 'Drug B', type: 'exit' },
    ];
    store.treatmentPatternsSettings.maxPathLength = 4;
    store.treatmentPatternsSettings.combinationWindow = 45;
    store.treatmentPatternsSettings.filterTreatments = 'All';
    store.treatmentPatternsSettings.stratify = true;
    store.enabledModules.TreatmentPatterns = true;
    store.enabledModules.CohortDiagnostics = false;
    store.enabledModules.Characterization = false;
    store.enabledModules.CohortIncidence = false;
    store.enabledModules.CohortMethod = false;
    store.enabledModules.SCCS = false;

    const spec = serializeSpec(store);
    store.resetToDefaults();

    deserializeSpec(spec, store);

    expect(store.treatmentPatternsSettings.cohortRoles).toHaveLength(2);
    expect(store.treatmentPatternsSettings.cohortRoles[0].cohortId).toBe(1);
    expect(store.treatmentPatternsSettings.cohortRoles[0].type).toBe('event');
    expect(store.treatmentPatternsSettings.cohortRoles[1].type).toBe('exit');
    expect(store.treatmentPatternsSettings.maxPathLength).toBe(4);
    expect(store.treatmentPatternsSettings.combinationWindow).toBe(45);
    expect(store.treatmentPatternsSettings.filterTreatments).toBe('All');
    expect(store.treatmentPatternsSettings.stratify).toBe(true);
  });

  // Task 12: round-trips TreatmentPatterns new fields
  it('round-trips TreatmentPatterns includeTreatments, indexDateOffset, censorType', () => {
    const store = useStrategusStore();
    store.treatmentPatternsSettings.includeTreatments = 'All';
    store.treatmentPatternsSettings.indexDateOffset = 10;
    store.treatmentPatternsSettings.censorType = 'mean';
    store.enabledModules.TreatmentPatterns = true;
    store.enabledModules.CohortDiagnostics = false;
    store.enabledModules.Characterization = false;
    store.enabledModules.CohortIncidence = false;
    store.enabledModules.CohortMethod = false;
    store.enabledModules.SCCS = false;

    const spec = serializeSpec(store);
    store.resetToDefaults();

    deserializeSpec(spec, store);

    expect(store.treatmentPatternsSettings.includeTreatments).toBe('All');
    expect(store.treatmentPatternsSettings.indexDateOffset).toBe(10);
    expect(store.treatmentPatternsSettings.censorType).toBe('mean');
  });

  // 15. round-trip EvidenceSynthesis (analyses)
  it('round-trips EvidenceSynthesis analyses and thresholds', () => {
    const store = useStrategusStore();
    store.evidenceSynthesisSettings.analyses = [
      {
        evidenceSynthesisAnalysisId: 1,
        description: 'Random effects',
        analysisType: 'RandomEffects',
        sourceMethod: 'CohortMethod',
        likelihoodApproximation: 'adaptive grid',
        controlType: 'outcome',
        alpha: 0.05,
      },
      {
        evidenceSynthesisAnalysisId: 2,
        description: 'Fixed effects SCCS',
        analysisType: 'FixedEffects',
        sourceMethod: 'SelfControlledCaseSeries',
        likelihoodApproximation: 'normal',
        controlType: 'exposure',
        alpha: 0.05,
      },
    ];
    store.evidenceSynthesisSettings.mdrrThreshold = 8;
    store.evidenceSynthesisSettings.easeThreshold = 0.1;
    store.evidenceSynthesisSettings.alpha = 0.01;
    store.enabledModules.EvidenceSynthesis = true;
    store.enabledModules.CohortDiagnostics = false;
    store.enabledModules.Characterization = false;
    store.enabledModules.CohortIncidence = false;
    store.enabledModules.CohortMethod = false;
    store.enabledModules.SCCS = false;

    const spec = serializeSpec(store);
    store.resetToDefaults();

    deserializeSpec(spec, store);

    expect(store.evidenceSynthesisSettings.analyses).toHaveLength(2);
    expect(store.evidenceSynthesisSettings.analyses[0].evidenceSynthesisAnalysisId).toBe(1);
    expect(store.evidenceSynthesisSettings.analyses[0].description).toBe('Random effects');
    expect(store.evidenceSynthesisSettings.analyses[0].analysisType).toBe('RandomEffects');
    expect(store.evidenceSynthesisSettings.analyses[0].sourceMethod).toBe('CohortMethod');
    expect(store.evidenceSynthesisSettings.analyses[0].likelihoodApproximation).toBe('adaptive grid');
    expect(store.evidenceSynthesisSettings.analyses[0].controlType).toBe('outcome');
    expect(store.evidenceSynthesisSettings.analyses[1].analysisType).toBe('FixedEffects');
    expect(store.evidenceSynthesisSettings.analyses[1].sourceMethod).toBe('SelfControlledCaseSeries');
    expect(store.evidenceSynthesisSettings.mdrrThreshold).toBe(8);
    expect(store.evidenceSynthesisSettings.easeThreshold).toBe(0.1);
    expect(store.evidenceSynthesisSettings.alpha).toBe(0.01);
  });

  // Task 13: round-trips Bayesian analysis with Bayesian-specific fields
  it('round-trips EvidenceSynthesis Bayesian analysis with Bayesian-specific fields', () => {
    const store = useStrategusStore();
    store.evidenceSynthesisSettings.analyses = [
      {
        evidenceSynthesisAnalysisId: 1,
        description: 'Bayesian MCMC',
        analysisType: 'Bayesian',
        sourceMethod: 'CohortMethod',
        likelihoodApproximation: 'adaptive grid',
        controlType: 'outcome',
        alpha: 0.05,
        chainLength: 1100000,
        burnIn: 100000,
        subSampleFrequency: 100,
        priorSd: [2, 0.5],
        robust: false,
        df: 4,
        seed: 1,
      },
    ];
    store.enabledModules.EvidenceSynthesis = true;
    store.enabledModules.CohortDiagnostics = false;
    store.enabledModules.Characterization = false;
    store.enabledModules.CohortIncidence = false;
    store.enabledModules.CohortMethod = false;
    store.enabledModules.SCCS = false;

    const spec = serializeSpec(store);
    store.resetToDefaults();

    deserializeSpec(spec, store);

    const analysis = store.evidenceSynthesisSettings.analyses[0];
    expect(analysis.analysisType).toBe('Bayesian');
    expect(analysis.chainLength).toBe(1100000);
    expect(analysis.burnIn).toBe(100000);
    expect(analysis.subSampleFrequency).toBe(100);
    expect(analysis.priorSd).toEqual([2, 0.5]);
    expect(analysis.robust).toBe(false);
    expect(analysis.df).toBe(4);
    expect(analysis.seed).toBe(1);
  });

  // 16. round-trips PLPValidation validationDesigns
  it('round-trips PLPValidation validationDesigns', () => {
    const store = useStrategusStore();
    store.plpValidationSettings.validationDesigns = [
      { plpModelPath: '/models/model1', targetId: 1, outcomeId: 10, recalibrate: 'weakRecalibration', runCovariateSummary: true },
      { plpModelPath: '/models/model2', targetId: 2, outcomeId: 11, recalibrate: 'none', runCovariateSummary: false },
    ];
    store.enabledModules.PLPValidation = true;
    store.enabledModules.CohortDiagnostics = false;
    store.enabledModules.Characterization = false;
    store.enabledModules.CohortIncidence = false;
    store.enabledModules.CohortMethod = false;
    store.enabledModules.SCCS = false;

    const spec = serializeSpec(store);
    store.resetToDefaults();

    deserializeSpec(spec, store);

    expect(store.plpValidationSettings.validationDesigns).toHaveLength(2);
    expect(store.plpValidationSettings.validationDesigns[0].plpModelPath).toBe('/models/model1');
    expect(store.plpValidationSettings.validationDesigns[0].targetId).toBe(1);
    expect(store.plpValidationSettings.validationDesigns[0].outcomeId).toBe(10);
    expect(store.plpValidationSettings.validationDesigns[0].recalibrate).toBe('weakRecalibration');
    expect(store.plpValidationSettings.validationDesigns[0].runCovariateSummary).toBe(true);
    expect(store.plpValidationSettings.validationDesigns[1].recalibrate).toBe('none');
    expect(store.plpValidationSettings.validationDesigns[1].runCovariateSummary).toBe(false);
  });

  // 17b. subsetDefs are JSON strings in serialized spec
  it('subsetDefs are serialized as JSON strings', () => {
    const store = useStrategusStore();
    store.cohortSubsetDefinitions = [
      {
        id: 1000,
        name: 'First-time use',
        operators: [{ type: 'LimitSubsetOperator', priorTime: 365, followUpTime: 1, limitTo: 'firstEver' }],
      },
    ];
    store.cohortSubsetAssignments = [{ cohortId: 5, subsetIds: [1000] }];

    const spec = serializeSpec(store);
    const cohortSR = spec.sharedResources[0] as { subsetDefs?: unknown[] };
    expect(cohortSR.subsetDefs).toBeDefined();
    expect(cohortSR.subsetDefs!.length).toBeGreaterThan(0);
    // Each entry should be a string
    expect(typeof cohortSR.subsetDefs![0]).toBe('string');
    // The string should parse to an object with definitionId
    const parsed = JSON.parse(cohortSR.subsetDefs![0] as string) as Record<string, unknown>;
    expect(parsed['definitionId']).toBe(1000);
  });

  // 17c. round-trips user-defined cohortSubsetDefinitions via deserializer
  it('round-trips user-defined cohortSubsetDefinitions from JSON-string subsetDefs', () => {
    const store = useStrategusStore();
    store.cohorts = [
      { cohortId: 5, cohortName: 'Target A', role: 'Target', subjectCount: null, cohortDefinition: '{}' },
    ];
    store.cohortSubsetDefinitions = [
      {
        id: 1000,
        name: 'First-time use',
        operators: [{ type: 'LimitSubsetOperator', priorTime: 365, followUpTime: 1, limitTo: 'firstEver' }],
      },
    ];
    store.cohortSubsetAssignments = [{ cohortId: 5, subsetIds: [1000] }];

    const spec = serializeSpec(store);
    store.resetToDefaults();

    deserializeSpec(spec, store);

    expect(store.cohortSubsetDefinitions).toHaveLength(1);
    expect(store.cohortSubsetDefinitions[0].id).toBe(1000);
    expect(store.cohortSubsetDefinitions[0].name).toBe('First-time use');
    expect(store.cohortSubsetDefinitions[0].operators).toHaveLength(1);
    expect(store.cohortSubsetDefinitions[0].operators[0].type).toBe('LimitSubsetOperator');
    expect(store.cohortSubsetAssignments).toHaveLength(1);
    expect(store.cohortSubsetAssignments[0].cohortId).toBe(5);
    expect(store.cohortSubsetAssignments[0].subsetIds).toContain(1000);
  });

  // 17d. round-trips study dates through CM via YYYYMMDD conversion
  it('round-trips study dates through CohortMethod (ISO → YYYYMMDD → ISO)', () => {
    const store = useStrategusStore();
    store.studyStartDate = '2017-12-01';
    store.studyEndDate = '2022-12-31';
    store.enabledModules.CohortMethod = true;
    store.enabledModules.CohortDiagnostics = false;
    store.enabledModules.Characterization = false;
    store.enabledModules.CohortIncidence = false;
    store.enabledModules.SCCS = false;

    const spec = serializeSpec(store);
    store.resetToDefaults();

    deserializeSpec(spec, store);

    expect(store.studyStartDate).toBe('2017-12-01');
    expect(store.studyEndDate).toBe('2022-12-31');
  });

  // 17. round-trips CohortIncidence strataSettings
  it('round-trips CohortIncidence strataSettings', () => {
    const store = useStrategusStore();
    store.cohorts = [
      { cohortId: 1, cohortName: 'Target', role: 'Target', subjectCount: null, cohortDefinition: '' },
    ];
    store.outcomes = [{ cohortId: 10, cleanWindow: 365 }];
    store.cohortIncidenceSettings.byAge = true;
    store.cohortIncidenceSettings.byGender = true;
    store.cohortIncidenceSettings.byYear = false;
    store.cohortIncidenceSettings.ageBreaks = [0, 10, 20, 30];
    store.enabledModules.CohortIncidence = true;
    store.enabledModules.CohortDiagnostics = false;
    store.enabledModules.Characterization = false;
    store.enabledModules.CohortMethod = false;
    store.enabledModules.SCCS = false;

    const spec = serializeSpec(store);
    store.resetToDefaults();

    deserializeSpec(spec, store);

    expect(store.cohortIncidenceSettings.byAge).toBe(true);
    expect(store.cohortIncidenceSettings.byGender).toBe(true);
    expect(store.cohortIncidenceSettings.byYear).toBe(false);
    expect(store.cohortIncidenceSettings.ageBreaks).toEqual([0, 10, 20, 30]);
  });

  // Task 11: round-trips CohortDiagnostics cohortIds and temporal covariate features
  it('round-trips CohortDiagnostics cohortIds and temporal covariate features', () => {
    const store = useStrategusStore();
    store.cohorts = [
      { cohortId: 5, cohortName: 'Target A', role: 'Target', subjectCount: null, cohortDefinition: '' },
      { cohortId: 6, cohortName: 'Target B', role: 'Target', subjectCount: null, cohortDefinition: '' },
    ];
    (store.cohortDiagnosticsSettings as Record<string, unknown>)['cohortIds'] = [5];
    (store.cohortDiagnosticsSettings as Record<string, unknown>)['temporalCovariateFeatures'] = {
      DemographicsGender: true,
      DemographicsAge: false,
      ConditionEraStart: true,
    };
    store.enabledModules.CohortDiagnostics = true;
    store.enabledModules.Characterization = false;
    store.enabledModules.CohortIncidence = false;
    store.enabledModules.CohortMethod = false;
    store.enabledModules.SCCS = false;

    const spec = serializeSpec(store);
    store.resetToDefaults();

    deserializeSpec(spec, store);

    // cohortIds round-trips
    expect((store.cohortDiagnosticsSettings as Record<string, unknown>)['cohortIds']).toEqual([5]);
    // temporal covariate features round-trip
    const features = (store.cohortDiagnosticsSettings as Record<string, unknown>)['temporalCovariateFeatures'] as Record<string, boolean>;
    expect(features['DemographicsGender']).toBe(true);
    expect(features['DemographicsAge']).toBe(false);
    expect(features['ConditionEraStart']).toBe(true);
  });
});
