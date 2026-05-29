import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useStrategusStore } from '../src/store/useStrategusStore';
import { serializeSpec } from '../src/services/SpecSerializer';

describe('SpecSerializer', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  // 1. produces valid top-level structure
  it('produces valid top-level structure', () => {
    const store = useStrategusStore();
    const spec = serializeSpec(store);

    expect(spec.attr_class).toBe('AnalysisSpecifications');
    expect(Array.isArray(spec.sharedResources)).toBe(true);
    expect(Array.isArray(spec.moduleSpecifications)).toBe(true);
  });

  // 2. always includes CohortGeneratorModule
  it('always includes CohortGeneratorModule', () => {
    const store = useStrategusStore();
    const spec = serializeSpec(store);

    const cgm = spec.moduleSpecifications.find((m) => m.module === 'CohortGeneratorModule');
    expect(cgm).toBeDefined();
    expect(cgm?.settings).toEqual({ generateStats: true });
  });

  // 3. CohortGeneratorModule is always first
  it('CohortGeneratorModule is always first', () => {
    const store = useStrategusStore();
    const spec = serializeSpec(store);

    expect(spec.moduleSpecifications[0].module).toBe('CohortGeneratorModule');
  });

  // 4. always includes CohortDefinitionSharedResources
  it('always includes CohortDefinitionSharedResources', () => {
    const store = useStrategusStore();
    store.cohorts = [
      {
        cohortId: 1,
        cohortName: 'Target A',
        role: 'Target',
        subjectCount: null,
        cohortDefinition: '{}',
      },
    ];

    const spec = serializeSpec(store);

    const cohortSR = spec.sharedResources.find((sr) =>
      (sr.attr_class as string[]).includes('CohortDefinitionSharedResources')
    );
    expect(cohortSR).toBeDefined();
    expect((cohortSR as { cohortDefinitions: unknown[] }).cohortDefinitions).toHaveLength(1);
    expect((cohortSR as { cohortDefinitions: Array<{ cohortId: number }> }).cohortDefinitions[0].cohortId).toBe(1);
  });

  // 5. includes negative controls shared resource when present
  it('includes negative controls shared resource when present', () => {
    const store = useStrategusStore();
    store.negativeControls = [
      { cohortId: 99, cohortName: 'NC 1', outcomeConceptId: 1234567 },
    ];
    store.ncOccurrenceType = 'all';
    store.ncDetectOnDescendants = false;

    const spec = serializeSpec(store);

    const ncSR = spec.sharedResources.find((sr) =>
      (sr.attr_class as string[]).includes('NegativeControlOutcomeSharedResources')
    );
    expect(ncSR).toBeDefined();
    const nc = (ncSR as { negativeControlOutcomes: { negativeControlOutcomeCohortSet: unknown[]; occurrenceType: string; detectOnDescendants: boolean } }).negativeControlOutcomes;
    expect(nc.negativeControlOutcomeCohortSet).toHaveLength(1);
    expect(nc.occurrenceType).toBe('all');
    expect(nc.detectOnDescendants).toBe(false);
  });

  // 6. does NOT include negative controls shared resource when none present
  it('does not include negative controls shared resource when none present', () => {
    const store = useStrategusStore();
    store.negativeControls = [];

    const spec = serializeSpec(store);

    const ncSR = spec.sharedResources.find((sr) =>
      (sr.attr_class as string[]).includes('NegativeControlOutcomeSharedResources')
    );
    expect(ncSR).toBeUndefined();
  });

  // 7. excludes disabled modules
  it('excludes disabled modules', () => {
    const store = useStrategusStore();
    // Disable CohortDiagnostics
    store.enabledModules.CohortDiagnostics = false;

    const spec = serializeSpec(store);

    const cdm = spec.moduleSpecifications.find((m) => m.module === 'CohortDiagnosticsModule');
    expect(cdm).toBeUndefined();
  });

  // 8. includes enabled modules
  it('includes enabled modules', () => {
    const store = useStrategusStore();
    store.enabledModules.CohortDiagnostics = true;
    store.enabledModules.Characterization = true;

    const spec = serializeSpec(store);

    const cdm = spec.moduleSpecifications.find((m) => m.module === 'CohortDiagnosticsModule');
    const cm = spec.moduleSpecifications.find((m) => m.module === 'CharacterizationModule');
    expect(cdm).toBeDefined();
    expect(cm).toBeDefined();
  });

  // 9. builds characterization with analysis object containing targetIds
  it('builds characterization with nested analysis object containing targetIds', () => {
    const store = useStrategusStore();
    store.cohorts = [
      { cohortId: 10, cohortName: 'Target A', role: 'Target', subjectCount: null, cohortDefinition: '' },
      { cohortId: 20, cohortName: 'Target B', role: 'Target', subjectCount: null, cohortDefinition: '' },
      { cohortId: 30, cohortName: 'Comparator', role: 'Comparator', subjectCount: null, cohortDefinition: '' },
      { cohortId: 40, cohortName: 'Outcome', role: 'Outcome', subjectCount: null, cohortDefinition: '' },
    ];
    store.outcomes = [
      { cohortId: 40, cleanWindow: 30 },
    ];
    store.enabledModules.Characterization = true;
    // All include* defaults true → analysis should contain all sub-arrays
    store.characterizationSettings.includeTargetBaseline = true;
    store.characterizationSettings.includeRiskFactors = true;
    store.characterizationSettings.includeCaseSeries = true;
    store.characterizationSettings.includeTimeToEvent = true;
    store.characterizationSettings.includeDechallengeRechallenge = true;

    const spec = serializeSpec(store);

    const cm = spec.moduleSpecifications.find((m) => m.module === 'CharacterizationModule');
    expect(cm).toBeDefined();
    const settings = cm!.settings as Record<string, unknown>;
    const analysis = settings['analysis'] as Record<string, unknown>;
    expect(analysis).toBeDefined();
    // aggregateCovariateSettings should have targetBaseline + riskFactors + caseSeries = 3 entries
    const aggCov = analysis['aggregateCovariateSettings'] as Array<Record<string, unknown>>;
    expect(aggCov.length).toBeGreaterThanOrEqual(1);
    // targetBaseline entry has outcomeIds=[]
    const targetBaselineEntry = aggCov.find((e) => Array.isArray(e['outcomeIds']) && (e['outcomeIds'] as unknown[]).length === 0);
    expect(targetBaselineEntry).toBeDefined();
    expect(targetBaselineEntry!['targetIds']).toEqual([10, 20]);
    // timeToEvent and dechallengeRechallenge arrays
    expect(Array.isArray(analysis['timeToEventSettings'])).toBe(true);
    expect((analysis['timeToEventSettings'] as unknown[]).length).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(analysis['dechallengeRechallengeSettings'])).toBe(true);
    expect((analysis['dechallengeRechallengeSettings'] as unknown[]).length).toBeGreaterThanOrEqual(1);
    // top-level flat fields
    expect(settings['mode']).toBe('CohortIncidence');
    expect(settings['outputTable']).toBe('characterization_cohorts');
    // legacy flat targetIds/outcomeIds should NOT be at top level
    expect(settings['targetIds']).toBeUndefined();
    expect(settings['outcomeIds']).toBeUndefined();
  });

  // 10. characterization settings are passed through
  it('characterization settings are passed through', () => {
    const store = useStrategusStore();
    store.characterizationSettings.minCharacterizationMean = 0.05;
    store.enabledModules.Characterization = true;

    const spec = serializeSpec(store);

    const cm = spec.moduleSpecifications.find((m) => m.module === 'CharacterizationModule');
    const settings = cm!.settings as Record<string, unknown>;
    expect(settings.minCharacterizationMean).toBe(0.05);
    // minSMD, minCovariateCount, outputTable are fixed defaults
    expect(settings.minSMD).toBe(0.01);
    expect(settings.minCovariateCount).toBe(5);
  });

  // 11. CohortDiagnostics settings are passed through
  it('CohortDiagnostics settings are passed through', () => {
    const store = useStrategusStore();
    store.cohortDiagnosticsSettings.runTimeSeries = true;
    store.cohortDiagnosticsSettings.irWashoutPeriod = 180;
    store.enabledModules.CohortDiagnostics = true;

    const spec = serializeSpec(store);

    const cdm = spec.moduleSpecifications.find((m) => m.module === 'CohortDiagnosticsModule');
    const settings = cdm!.settings as Record<string, unknown>;
    expect(settings.runTimeSeries).toBe(true);
    expect(settings.irWashoutPeriod).toBe(180);
  });

  // 12. disabled-by-default PLP module excluded
  it('PLP module excluded when disabled', () => {
    const store = useStrategusStore();
    // PLP is disabled by default
    expect(store.enabledModules.PLP).toBe(false);

    const spec = serializeSpec(store);

    const plp = spec.moduleSpecifications.find((m) => m.module === 'PatientLevelPredictionModule');
    expect(plp).toBeUndefined();
  });

  // 13. PLP module included when enabled
  it('PLP module included when enabled', () => {
    const store = useStrategusStore();
    store.enabledModules.PLP = true;

    const spec = serializeSpec(store);

    const plp = spec.moduleSpecifications.find((m) => m.module === 'PatientLevelPredictionModule');
    expect(plp).toBeDefined();
  });

  // 14. CohortMethod produces flat settings with correct TCO list
  it('CohortMethod produces flat settings with correct TCO list', () => {
    const store = useStrategusStore();
    store.cohorts = [
      { cohortId: 1, cohortName: 'Target', role: 'Target', subjectCount: null, cohortDefinition: '' },
      { cohortId: 2, cohortName: 'Comparator', role: 'Comparator', subjectCount: null, cohortDefinition: '' },
    ];
    store.comparisons = [
      { targetId: 1, comparatorId: 2, indicationId: null, genderConceptIds: [], minAge: null, maxAge: null, excludedCovariateConceptIds: [123] },
    ];
    store.outcomes = [{ cohortId: 10, cleanWindow: 30 }];
    store.enabledModules.CohortMethod = true;
    store.enabledModules.CohortDiagnostics = false;
    store.enabledModules.Characterization = false;
    store.enabledModules.CohortIncidence = false;
    store.enabledModules.SCCS = false;

    const spec = serializeSpec(store);
    const mod = spec.moduleSpecifications.find((m) => m.module === 'CohortMethodModule');
    expect(mod).toBeDefined();

    const settings = mod!.settings as Record<string, unknown>;
    // Flat schema — no cmAnalysesSpecifications wrapper
    expect(settings['cmAnalysesSpecifications']).toBeUndefined();

    const tcoList = settings['targetComparatorOutcomesList'] as Array<Record<string, unknown>>;
    expect(tcoList).toHaveLength(1);
    // IDs are subset cohort IDs (originalId * 1000 + subsetDefId)
    expect(tcoList[0]['targetId']).toBe(1001);
    expect(tcoList[0]['comparatorId']).toBe(2001);
    expect(tcoList[0]['excludedCovariateConceptIds']).toEqual([123]);

    const outcomes = tcoList[0]['outcomes'] as Array<Record<string, unknown>>;
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]['outcomeId']).toBe(10);
    expect(outcomes[0]['outcomeOfInterest']).toBe(true);
  });

  // 14b. 2 TAR windows produce 2 cmAnalysisList entries
  it('2 TAR windows produce 2 cmAnalysisList entries', () => {
    const store = useStrategusStore();
    store.timeAtRisk = [
      { label: 'On treatment', riskWindowStart: 1, startAnchor: 'cohort start', riskWindowEnd: 0, endAnchor: 'cohort end' },
      { label: 'Intent-to-treat', riskWindowStart: 1, startAnchor: 'cohort start', riskWindowEnd: 365, endAnchor: 'cohort start' },
    ];
    store.enabledModules.CohortMethod = true;
    store.enabledModules.CohortDiagnostics = false;
    store.enabledModules.Characterization = false;
    store.enabledModules.CohortIncidence = false;
    store.enabledModules.SCCS = false;

    const spec = serializeSpec(store);
    const mod = spec.moduleSpecifications.find((m) => m.module === 'CohortMethodModule');
    const settings = mod!.settings as Record<string, unknown>;
    const analysisList = settings['cmAnalysisList'] as Array<Record<string, unknown>>;

    expect(analysisList).toHaveLength(2);
    expect(analysisList[0]['analysisId']).toBe(1);
    // description is "<analysis.description>, <tar.label>" when multiple TARs
    expect((analysisList[0]['description'] as string)).toContain('On treatment');
    expect(analysisList[1]['analysisId']).toBe(2);
    expect((analysisList[1]['description'] as string)).toContain('Intent-to-treat');

    const pop0 = analysisList[0]['createStudyPopulationArgs'] as Record<string, unknown>;
    expect(pop0['riskWindowEnd']).toBe(0);
    expect(pop0['endAnchor']).toBe('cohort end');

    const pop1 = analysisList[1]['createStudyPopulationArgs'] as Record<string, unknown>;
    expect(pop1['riskWindowEnd']).toBe(365);
    expect(pop1['endAnchor']).toBe('cohort start');
  });

  // 15. CohortMethod cmAnalysisList contains psMatchMaxRatio
  it('CohortMethod cmAnalysisList contains psMatchMaxRatio', () => {
    const store = useStrategusStore();
    store.cohortMethodSettings.analyses[0].psMatchMaxRatio = 3;
    store.enabledModules.CohortMethod = true;
    store.enabledModules.CohortDiagnostics = false;
    store.enabledModules.Characterization = false;
    store.enabledModules.CohortIncidence = false;
    store.enabledModules.SCCS = false;

    const spec = serializeSpec(store);
    const mod = spec.moduleSpecifications.find((m) => m.module === 'CohortMethodModule');
    const settings = mod!.settings as Record<string, unknown>;
    const analysisList = settings['cmAnalysisList'] as Array<Record<string, unknown>>;
    const matchOnPsArgs = analysisList[0]['matchOnPsArgs'] as Record<string, unknown>;
    expect(matchOnPsArgs['maxRatio']).toBe(3);
  });

  // 15b. CohortMethod fitOutcomeModelArgs contains modelType
  it('CohortMethod fitOutcomeModelArgs contains modelType', () => {
    const store = useStrategusStore();
    store.cohortMethodSettings.analyses[0].outcomeModelType = 'logistic';
    store.enabledModules.CohortMethod = true;
    store.enabledModules.CohortDiagnostics = false;
    store.enabledModules.Characterization = false;
    store.enabledModules.CohortIncidence = false;
    store.enabledModules.SCCS = false;

    const spec = serializeSpec(store);
    const mod = spec.moduleSpecifications.find((m) => m.module === 'CohortMethodModule');
    const settings = mod!.settings as Record<string, unknown>;
    const analysisList = settings['cmAnalysisList'] as Array<Record<string, unknown>>;
    const fitArgs = analysisList[0]['fitOutcomeModelArgs'] as Record<string, unknown>;
    expect(fitArgs['modelType']).toBe('logistic');
  });

  // Task 14: createPsArgs includes full fields (prior, estimator, errorOnHighCorrelation, control)
  it('CohortMethod createPsArgs includes full Cyclops fields', () => {
    const store = useStrategusStore();
    store.cohortMethodSettings.maxCohortSizeForFitting = 200000;
    store.enabledModules.CohortMethod = true;
    store.enabledModules.CohortDiagnostics = false;
    store.enabledModules.Characterization = false;
    store.enabledModules.CohortIncidence = false;
    store.enabledModules.SCCS = false;

    const spec = serializeSpec(store);
    const mod = spec.moduleSpecifications.find((m) => m.module === 'CohortMethodModule');
    const settings = mod!.settings as Record<string, unknown>;
    const analysisList = settings['cmAnalysisList'] as Array<Record<string, unknown>>;
    const psArgs = analysisList[0]['createPsArgs'] as Record<string, unknown>;

    expect(psArgs['maxCohortSizeForFitting']).toBe(200000);
    expect(psArgs['estimator']).toBe('att');
    expect(psArgs['errorOnHighCorrelation']).toBe(true);
    expect(psArgs['stopOnError']).toBe(false);
    const prior = psArgs['prior'] as Record<string, unknown>;
    expect(prior['priorType']).toBe('laplace');
    expect(prior['useCrossValidation']).toBe(true);
    const control = psArgs['control'] as Record<string, unknown>;
    expect(control['cvRepetitions']).toBe(1);
    expect(control['seed']).toBe(1);
    expect(control['tolerance']).toBe(2e-07);
  });

  // Task 14: fitOutcomeModelArgs includes full fields
  it('CohortMethod fitOutcomeModelArgs includes useCovariates, profileBounds, prior, control', () => {
    const store = useStrategusStore();
    store.cohortMethodSettings.analyses[0].psAdjustmentMethod = 'matching';
    store.enabledModules.CohortMethod = true;
    store.enabledModules.CohortDiagnostics = false;
    store.enabledModules.Characterization = false;
    store.enabledModules.CohortIncidence = false;
    store.enabledModules.SCCS = false;

    const spec = serializeSpec(store);
    const mod = spec.moduleSpecifications.find((m) => m.module === 'CohortMethodModule');
    const settings = mod!.settings as Record<string, unknown>;
    const analysisList = settings['cmAnalysisList'] as Array<Record<string, unknown>>;
    const fitArgs = analysisList[0]['fitOutcomeModelArgs'] as Record<string, unknown>;

    expect(fitArgs['useCovariates']).toBe(false);
    expect(fitArgs['inversePtWeighting']).toBe(false); // matching, not iptw
    expect(fitArgs['profileBounds']).toEqual([-2.3026, 2.3026]);
    const prior = fitArgs['prior'] as Record<string, unknown>;
    expect(prior['priorType']).toBe('laplace');
    const control = fitArgs['control'] as Record<string, unknown>;
    expect(control['convergenceType']).toBe('gradient');
    expect(control['autoSearch']).toBe(true);
    expect(control['noiseLevel']).toBe('quiet');
  });

  // Task 14: fitOutcomeModelArgs inversePtWeighting=true for iptw method
  it('CohortMethod fitOutcomeModelArgs inversePtWeighting=true for iptw', () => {
    const store = useStrategusStore();
    store.cohortMethodSettings.analyses[0].psAdjustmentMethod = 'iptw';
    store.enabledModules.CohortMethod = true;
    store.enabledModules.CohortDiagnostics = false;
    store.enabledModules.Characterization = false;
    store.enabledModules.CohortIncidence = false;
    store.enabledModules.SCCS = false;

    const spec = serializeSpec(store);
    const mod = spec.moduleSpecifications.find((m) => m.module === 'CohortMethodModule');
    const settings = mod!.settings as Record<string, unknown>;
    const analysisList = settings['cmAnalysisList'] as Array<Record<string, unknown>>;
    const fitArgs = analysisList[0]['fitOutcomeModelArgs'] as Record<string, unknown>;

    expect(fitArgs['inversePtWeighting']).toBe(true);
    expect(fitArgs['stratified']).toBe(true); // iptw !== 'none'
  });

  // 15c. CohortMethod fitOutcomeModelArgs defaults to cox
  it('CohortMethod fitOutcomeModelArgs defaults to cox', () => {
    const store = useStrategusStore();
    store.enabledModules.CohortMethod = true;
    store.enabledModules.CohortDiagnostics = false;
    store.enabledModules.Characterization = false;
    store.enabledModules.CohortIncidence = false;
    store.enabledModules.SCCS = false;

    const spec = serializeSpec(store);
    const mod = spec.moduleSpecifications.find((m) => m.module === 'CohortMethodModule');
    const settings = mod!.settings as Record<string, unknown>;
    const analysisList = settings['cmAnalysisList'] as Array<Record<string, unknown>>;
    const fitArgs = analysisList[0]['fitOutcomeModelArgs'] as Record<string, unknown>;
    expect(fitArgs['modelType']).toBe('cox');
  });

  // 16. SCCS produces exposuresOutcomeList from TCIs × outcomes
  it('SCCS produces exposuresOutcomeList from TCIs × outcomes', () => {
    const store = useStrategusStore();
    store.comparisons = [
      { targetId: 1, comparatorId: 2, indicationId: 5, genderConceptIds: [], minAge: null, maxAge: null, excludedCovariateConceptIds: [] },
    ];
    store.outcomes = [{ cohortId: 10, cleanWindow: 30 }];
    store.enabledModules.SCCS = true;
    store.enabledModules.CohortDiagnostics = false;
    store.enabledModules.Characterization = false;
    store.enabledModules.CohortIncidence = false;
    store.enabledModules.CohortMethod = false;

    const spec = serializeSpec(store);
    const mod = spec.moduleSpecifications.find((m) => m.module === 'SelfControlledCaseSeriesModule');
    expect(mod).toBeDefined();

    const settings = mod!.settings as Record<string, unknown>;
    // Flat schema — no sccsAnalysesSpecifications wrapper
    expect(settings['sccsAnalysesSpecifications']).toBeUndefined();
    const exposuresList = settings['exposuresOutcomeList'] as Array<Record<string, unknown>>;

    // 1 TCI × 2 exposures (target + comparator) × 1 outcome = 2 entries
    expect(exposuresList).toHaveLength(2);
    const outcomeIds = exposuresList.map((e) => e['outcomeId']);
    expect(outcomeIds).toEqual([10, 10]);
  });

  // 17. PLP produces modelDesignList with correct target × outcome count
  it('PLP produces modelDesignList with correct target × outcome count', () => {
    const store = useStrategusStore();
    store.cohorts = [
      { cohortId: 1, cohortName: 'Target A', role: 'Target', subjectCount: null, cohortDefinition: '' },
      { cohortId: 2, cohortName: 'Target B', role: 'Target', subjectCount: null, cohortDefinition: '' },
    ];
    store.outcomes = [
      { cohortId: 10, cleanWindow: 30 },
      { cohortId: 11, cleanWindow: 30 },
    ];
    store.enabledModules.PLP = true;
    store.enabledModules.CohortDiagnostics = false;
    store.enabledModules.Characterization = false;
    store.enabledModules.CohortIncidence = false;
    store.enabledModules.CohortMethod = false;
    store.enabledModules.SCCS = false;

    const spec = serializeSpec(store);
    const mod = spec.moduleSpecifications.find((m) => m.module === 'PatientLevelPredictionModule');
    expect(mod).toBeDefined();

    const settings = mod!.settings as Record<string, unknown>;
    const modelDesignList = settings['modelDesignList'] as Array<Record<string, unknown>>;
    // 2 targets × 2 outcomes = 4 designs
    expect(modelDesignList).toHaveLength(4);
  });

  // 18. TreatmentPatterns includes cohort roles
  it('TreatmentPatterns includes cohort roles', () => {
    const store = useStrategusStore();
    store.treatmentPatternsSettings.cohortRoles = [
      { cohortId: 1, cohortName: 'Drug A', type: 'event' },
      { cohortId: 2, cohortName: 'Drug B', type: 'event' },
    ];
    store.treatmentPatternsSettings.maxPathLength = 3;
    store.enabledModules.TreatmentPatterns = true;
    store.enabledModules.CohortDiagnostics = false;
    store.enabledModules.Characterization = false;
    store.enabledModules.CohortIncidence = false;
    store.enabledModules.CohortMethod = false;
    store.enabledModules.SCCS = false;

    const spec = serializeSpec(store);
    const mod = spec.moduleSpecifications.find((m) => m.module === 'TreatmentPatternsModule');
    expect(mod).toBeDefined();

    const settings = mod!.settings as Record<string, unknown>;
    const cohorts = settings['cohorts'] as Array<Record<string, unknown>>;
    expect(cohorts).toHaveLength(2);
    expect(cohorts[0]['cohortId']).toBe(1);
    expect(cohorts[0]['type']).toBe('event');
    expect(settings['maxPathLength']).toBe(3);
  });

  // 19a. CohortMethod includes covariateSettings and diagnosticThresholds
  it('CohortMethod includes covariateSettings and diagnosticThresholds', () => {
    const store = useStrategusStore();
    store.cohorts = [
      { cohortId: 1, cohortName: 'T1', role: 'Target', subjectCount: 100, cohortDefinition: '{}' },
      { cohortId: 2, cohortName: 'C1', role: 'Comparator', subjectCount: 80, cohortDefinition: '{}' },
    ];
    store.outcomes = [{ cohortId: 3, cleanWindow: 365 }];
    store.comparisons = [{ targetId: 1, comparatorId: 2, indicationId: null, genderConceptIds: [8507, 8532], minAge: null, maxAge: null, excludedCovariateConceptIds: [] }];
    store.enabledModules.CohortMethod = true;
    store.enabledModules.CohortDiagnostics = false;
    store.enabledModules.Characterization = false;
    store.enabledModules.CohortIncidence = false;
    store.enabledModules.SCCS = false;
    const spec = serializeSpec(store);
    const cm = spec.moduleSpecifications.find(m => m.module === 'CohortMethodModule');
    expect(cm).toBeDefined();
    const settings = cm!.settings as Record<string, unknown>;
    // Flat schema
    expect(settings.cmDiagnosticThresholds).toBeDefined();
    const analysis = (settings.cmAnalysisList as unknown[])[0] as Record<string, unknown>;
    const dbArgs = analysis.getDbCohortMethodDataArgs as Record<string, unknown>;
    expect(dbArgs.covariateSettings).toBeDefined();
  });

  // 19b. SCCS includes diagnosticThresholds and Cyclops prior/control in fitSccsModelArgs
  it('SCCS includes diagnosticThresholds and Cyclops prior/control', () => {
    const store = useStrategusStore();
    store.cohorts = [
      { cohortId: 1, cohortName: 'T1', role: 'Target', subjectCount: 100, cohortDefinition: '{}' },
      { cohortId: 2, cohortName: 'C1', role: 'Comparator', subjectCount: 80, cohortDefinition: '{}' },
    ];
    store.outcomes = [{ cohortId: 3, cleanWindow: 365 }];
    store.comparisons = [{ targetId: 1, comparatorId: 2, indicationId: null, genderConceptIds: [8507, 8532], minAge: null, maxAge: null, excludedCovariateConceptIds: [] }];
    store.enabledModules.SCCS = true;
    store.enabledModules.CohortDiagnostics = false;
    store.enabledModules.Characterization = false;
    store.enabledModules.CohortIncidence = false;
    store.enabledModules.CohortMethod = false;
    const spec = serializeSpec(store);
    const sccs = spec.moduleSpecifications.find(m => m.module === 'SelfControlledCaseSeriesModule');
    expect(sccs).toBeDefined();
    const settings = sccs!.settings as Record<string, unknown>;
    // Flat schema
    expect(settings.sccsDiagnosticThresholds).toBeDefined();
    const analysisList = settings.sccsAnalysisList as unknown[];
    const analysis = analysisList[0] as Record<string, unknown>;
    const fitArgs = analysis.fitSccsModelArgs as Record<string, unknown>;
    // P6: fitSccsModelArgs now has prior and control (Cyclops) instead of profileGrid
    expect(fitArgs.prior).toBeDefined();
    expect(fitArgs.control).toBeDefined();
    expect(fitArgs.profileBounds).toBeDefined();
  });

  // 20. generates cohort subsets from TCI restrictions
  it('generates cohort subsets from TCI restrictions', () => {
    const store = useStrategusStore();
    store.cohorts = [
      { cohortId: 1, cohortName: 'T1', role: 'Target', subjectCount: 100, cohortDefinition: '{}' },
      { cohortId: 2, cohortName: 'C1', role: 'Comparator', subjectCount: 80, cohortDefinition: '{}' },
    ];
    store.outcomes = [{ cohortId: 3, cleanWindow: 365 }];
    store.comparisons = [{
      targetId: 1,
      comparatorId: 2,
      indicationId: null,
      genderConceptIds: [8507, 8532],
      minAge: null,
      maxAge: null,
      excludedCovariateConceptIds: [],
    }];
    const spec = serializeSpec(store);
    const cohortSR = spec.sharedResources[0] as { subsetDefs?: unknown[]; cohortSubsets?: unknown[] };
    // With default gender (both) and no age/indication, subsets should still be generated (firstEver restriction)
    expect(cohortSR.subsetDefs).toBeDefined();
    expect(cohortSR.subsetDefs!.length).toBeGreaterThan(0);
    expect(cohortSR.cohortSubsets).toBeDefined();
    expect(cohortSR.cohortSubsets!.length).toBe(2); // one for target, one for comparator
  });

  // 21. subset cohort IDs are used in CohortMethod and SCCS
  it('subset cohort IDs are used in CohortMethod and SCCS', () => {
    const store = useStrategusStore();
    store.cohorts = [
      { cohortId: 10, cohortName: 'T1', role: 'Target', subjectCount: 100, cohortDefinition: '{}' },
      { cohortId: 20, cohortName: 'C1', role: 'Comparator', subjectCount: 80, cohortDefinition: '{}' },
    ];
    store.outcomes = [{ cohortId: 99, cleanWindow: 365 }];
    store.comparisons = [{
      targetId: 10,
      comparatorId: 20,
      indicationId: null,
      genderConceptIds: [8507],
      minAge: 18,
      maxAge: null,
      excludedCovariateConceptIds: [],
    }];
    store.enabledModules.CohortMethod = true;
    store.enabledModules.SCCS = true;
    store.enabledModules.CohortDiagnostics = false;
    store.enabledModules.Characterization = false;
    store.enabledModules.CohortIncidence = false;

    const spec = serializeSpec(store);

    // subsetDefs should include LimitSubsetOperator + DemographicSubsetOperator (gender) + DemographicSubsetOperator (age)
    const cohortSR = spec.sharedResources[0] as { subsetDefs?: string[]; cohortSubsets?: Array<{ cohortId: number; subsetId: number; targetCohortId: number }> };
    expect(cohortSR.subsetDefs).toHaveLength(1);
    // subsetDefs entries are JSON strings
    const subsetDef = JSON.parse(cohortSR.subsetDefs![0]) as Record<string, unknown>;
    const operators = subsetDef['subsetOperators'] as Array<Record<string, unknown>>;
    // LimitSubsetOperator + gender DemographicSubsetOperator + age DemographicSubsetOperator
    expect(operators).toHaveLength(3);
    expect(operators[0]['subsetType']).toBe('LimitSubsetOperator');

    // CohortSubsets should contain subset IDs for target and comparator
    expect(cohortSR.cohortSubsets).toHaveLength(2);
    const targetSubset = cohortSR.cohortSubsets!.find((s) => s.targetCohortId === 10);
    expect(targetSubset).toBeDefined();
    expect(targetSubset!.cohortId).toBe(10001); // 10 * 1000 + 1

    // CohortMethod TCO list should use subset IDs
    const cm = spec.moduleSpecifications.find((m) => m.module === 'CohortMethodModule');
    const cmSettings = cm!.settings as Record<string, unknown>;
    const tcoList = cmSettings['targetComparatorOutcomesList'] as Array<Record<string, unknown>>;
    expect(tcoList[0]['targetId']).toBe(10001);
    expect(tcoList[0]['comparatorId']).toBe(20001);

    // SCCS exposures should use subset IDs
    const sccs = spec.moduleSpecifications.find((m) => m.module === 'SelfControlledCaseSeriesModule');
    const sccsSettings = sccs!.settings as Record<string, unknown>;
    const exposuresList = sccsSettings['exposuresOutcomeList'] as Array<Record<string, unknown>>;
    const exposureIds = exposuresList.map((e) => (e['exposures'] as Array<Record<string, unknown>>)[0]['exposureId']);
    expect(exposureIds).toContain(10001);
    expect(exposureIds).toContain(20001);
  });

  // 19. EvidenceSynthesis includes analysis list
  it('EvidenceSynthesis includes analysis list', () => {
    const store = useStrategusStore();
    store.evidenceSynthesisSettings.analyses = [
      {
        evidenceSynthesisAnalysisId: 1,
        description: 'Random-effects meta-analysis',
        analysisType: 'RandomEffects',
        sourceMethod: 'CohortMethod',
        likelihoodApproximation: 'adaptive grid',
        controlType: 'outcome',
        alpha: 0.05,
      },
    ];
    store.evidenceSynthesisSettings.mdrrThreshold = 5;
    store.enabledModules.EvidenceSynthesis = true;
    store.enabledModules.CohortDiagnostics = false;
    store.enabledModules.Characterization = false;
    store.enabledModules.CohortIncidence = false;
    store.enabledModules.CohortMethod = false;
    store.enabledModules.SCCS = false;

    const spec = serializeSpec(store);
    const mod = spec.moduleSpecifications.find((m) => m.module === 'EvidenceSynthesisModule');
    expect(mod).toBeDefined();

    const settings = mod!.settings as Record<string, unknown>;
    const analysisList = settings['evidenceSynthesisAnalysisList'] as Array<Record<string, unknown>>;
    expect(analysisList).toHaveLength(1);
    expect(analysisList[0]['evidenceSynthesisAnalysisId']).toBe(1);
    expect(analysisList[0]['evidenceSynthesisDescription']).toBe('Random-effects meta-analysis');
    // attr_class should encode analysisType
    expect((analysisList[0]['attr_class'] as string[])[0]).toBe('RandomEffectsMetaAnalysis');

    const thresholds = settings['esDiagnosticThresholds'] as Record<string, unknown>;
    expect(thresholds['mdrrThreshold']).toBe(5);
  });

  // Task 13: EvidenceSynthesis emits attr_class with analysisType prefix
  it('EvidenceSynthesis: attr_class encodes analysisType (FixedEffects, RandomEffects, Bayesian)', () => {
    const store = useStrategusStore();
    store.evidenceSynthesisSettings.analyses = [
      {
        evidenceSynthesisAnalysisId: 1,
        description: 'Fixed',
        analysisType: 'FixedEffects',
        sourceMethod: 'CohortMethod',
        likelihoodApproximation: 'normal',
        controlType: 'outcome',
        alpha: 0.05,
      },
      {
        evidenceSynthesisAnalysisId: 2,
        description: 'Random',
        analysisType: 'RandomEffects',
        sourceMethod: 'SelfControlledCaseSeries',
        likelihoodApproximation: 'adaptive grid',
        controlType: 'exposure',
        alpha: 0.05,
      },
    ];
    store.enabledModules.EvidenceSynthesis = true;
    store.enabledModules.CohortDiagnostics = false;
    store.enabledModules.Characterization = false;
    store.enabledModules.CohortIncidence = false;
    store.enabledModules.CohortMethod = false;
    store.enabledModules.SCCS = false;

    const spec = serializeSpec(store);
    const mod = spec.moduleSpecifications.find((m) => m.module === 'EvidenceSynthesisModule');
    const analysisList = (mod!.settings as Record<string, unknown>)['evidenceSynthesisAnalysisList'] as Array<Record<string, unknown>>;

    expect((analysisList[0]['attr_class'] as string[])[0]).toBe('FixedEffectsMetaAnalysis');
    expect((analysisList[0]['attr_class'] as string[])[1]).toBe('EvidenceSynthesisAnalysis');
    expect((analysisList[1]['attr_class'] as string[])[0]).toBe('RandomEffectsMetaAnalysis');
  });

  // Task 13: Bayesian analysis emits Bayesian-specific fields
  it('EvidenceSynthesis: Bayesian analysis emits chainLength, burnIn, priorSd, etc.', () => {
    const store = useStrategusStore();
    store.evidenceSynthesisSettings.analyses = [
      {
        evidenceSynthesisAnalysisId: 1,
        description: 'Bayesian',
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
    const mod = spec.moduleSpecifications.find((m) => m.module === 'EvidenceSynthesisModule');
    const analysisList = (mod!.settings as Record<string, unknown>)['evidenceSynthesisAnalysisList'] as Array<Record<string, unknown>>;
    const entry = analysisList[0];

    expect((entry['attr_class'] as string[])[0]).toBe('BayesianMetaAnalysis');
    expect(entry['chainLength']).toBe(1100000);
    expect(entry['burnIn']).toBe(100000);
    expect(entry['subSampleFrequency']).toBe(100);
    expect(entry['priorSd']).toEqual([2, 0.5]);
    expect(entry['robust']).toBe(false);
    expect(entry['df']).toBe(4);
    expect(entry['seed']).toBe(1);
  });

  // Task 13: non-Bayesian analysis does NOT emit Bayesian fields
  it('EvidenceSynthesis: non-Bayesian analysis omits Bayesian-specific fields', () => {
    const store = useStrategusStore();
    store.evidenceSynthesisSettings.analyses = [
      {
        evidenceSynthesisAnalysisId: 1,
        description: 'Random',
        analysisType: 'RandomEffects',
        sourceMethod: 'CohortMethod',
        likelihoodApproximation: 'normal',
        controlType: 'outcome',
        alpha: 0.05,
      },
    ];
    store.enabledModules.EvidenceSynthesis = true;
    store.enabledModules.CohortDiagnostics = false;
    store.enabledModules.Characterization = false;
    store.enabledModules.CohortIncidence = false;
    store.enabledModules.CohortMethod = false;
    store.enabledModules.SCCS = false;

    const spec = serializeSpec(store);
    const mod = spec.moduleSpecifications.find((m) => m.module === 'EvidenceSynthesisModule');
    const analysisList = (mod!.settings as Record<string, unknown>)['evidenceSynthesisAnalysisList'] as Array<Record<string, unknown>>;
    const entry = analysisList[0];

    expect(entry['chainLength']).toBeUndefined();
    expect(entry['burnIn']).toBeUndefined();
    expect(entry['priorSd']).toBeUndefined();
  });

  // Task 2: PS adjustment method — stratification produces stratifyByPsArgs
  it('CohortMethod stratification method produces stratifyByPsArgs not matchOnPsArgs', () => {
    const store = useStrategusStore();
    store.cohortMethodSettings.analyses[0].psAdjustmentMethod = 'stratification';
    store.cohortMethodSettings.analyses[0].psStrataCount = 10;
    store.enabledModules.CohortMethod = true;
    store.enabledModules.CohortDiagnostics = false;
    store.enabledModules.Characterization = false;
    store.enabledModules.CohortIncidence = false;
    store.enabledModules.SCCS = false;

    const spec = serializeSpec(store);
    const mod = spec.moduleSpecifications.find((m) => m.module === 'CohortMethodModule');
    const settings = mod!.settings as Record<string, unknown>;
    const analysisList = settings['cmAnalysisList'] as Array<Record<string, unknown>>;
    const entry = analysisList[0];

    expect(entry['matchOnPsArgs']).toBeNull();
    expect(entry['stratifyByPsArgs']).toEqual({ numberOfStrata: 10, baseSelection: 'all' });
    // stratified outcome model for stratification
    const fitArgs = entry['fitOutcomeModelArgs'] as Record<string, unknown>;
    expect(fitArgs['stratified']).toBe(true);
  });

  // Task 2: IPTW method produces truncateIptwArgs
  it('CohortMethod iptw method produces truncateIptwArgs', () => {
    const store = useStrategusStore();
    store.cohortMethodSettings.analyses[0].psAdjustmentMethod = 'iptw';
    store.cohortMethodSettings.analyses[0].iptwTruncationFraction = 0.95;
    store.enabledModules.CohortMethod = true;
    store.enabledModules.CohortDiagnostics = false;
    store.enabledModules.Characterization = false;
    store.enabledModules.CohortIncidence = false;
    store.enabledModules.SCCS = false;

    const spec = serializeSpec(store);
    const mod = spec.moduleSpecifications.find((m) => m.module === 'CohortMethodModule');
    const settings = mod!.settings as Record<string, unknown>;
    const analysisList = settings['cmAnalysisList'] as Array<Record<string, unknown>>;
    const entry = analysisList[0];

    expect(entry['matchOnPsArgs']).toBeNull();
    const iptwArgs = entry['truncateIptwArgs'] as Record<string, unknown>;
    expect(iptwArgs['upperLimit']).toBe(0.95);
    expect(iptwArgs['lowerLimit']).toBeCloseTo(0.05, 6);
  });

  // Task 3: 2 analyses × 2 TARs produce 4 cmAnalysisList entries
  it('2 analyses × 2 TARs produce 4 cmAnalysisList entries', () => {
    const store = useStrategusStore();
    store.timeAtRisk = [
      { label: 'On treatment', riskWindowStart: 1, startAnchor: 'cohort start', riskWindowEnd: 0, endAnchor: 'cohort end' },
      { label: 'ITT', riskWindowStart: 1, startAnchor: 'cohort start', riskWindowEnd: 365, endAnchor: 'cohort start' },
    ];
    store.cohortMethodSettings.analyses = [
      {
        analysisId: 1, description: 'Matched 1:1', psAdjustmentMethod: 'matching', psMatchMaxRatio: 1,
        psStrataCount: 5, iptwTruncationFraction: 0.99, outcomeModelType: 'cox', useCleanWindowForPriorOutcomeLookback: false,
      },
      {
        analysisId: 2, description: 'Stratified', psAdjustmentMethod: 'stratification', psMatchMaxRatio: 1,
        psStrataCount: 5, iptwTruncationFraction: 0.99, outcomeModelType: 'logistic', useCleanWindowForPriorOutcomeLookback: false,
      },
    ];
    store.enabledModules.CohortMethod = true;
    store.enabledModules.CohortDiagnostics = false;
    store.enabledModules.Characterization = false;
    store.enabledModules.CohortIncidence = false;
    store.enabledModules.SCCS = false;

    const spec = serializeSpec(store);
    const mod = spec.moduleSpecifications.find((m) => m.module === 'CohortMethodModule');
    const settings = mod!.settings as Record<string, unknown>;
    const analysisList = settings['cmAnalysisList'] as Array<Record<string, unknown>>;

    expect(analysisList).toHaveLength(4);
    // analysis 1 × TAR 1 = analysisId 1
    expect(analysisList[0]['analysisId']).toBe(1);
    expect((analysisList[0]['description'] as string)).toContain('Matched 1:1');
    expect((analysisList[0]['description'] as string)).toContain('On treatment');
    // analysis 1 × TAR 2 = analysisId 2
    expect(analysisList[1]['analysisId']).toBe(2);
    expect((analysisList[1]['description'] as string)).toContain('ITT');
    // analysis 2 × TAR 1 = analysisId 3
    expect(analysisList[2]['analysisId']).toBe(3);
    expect((analysisList[2]['description'] as string)).toContain('Stratified');
  });

  // Task 5: empirical calibration OFF excludes NCs from CM outcome list
  it('CohortMethod: NCs excluded from outcome list when empirical calibration off', () => {
    const store = useStrategusStore();
    store.cohortMethodSettings.useEmpiricalCalibration = false;
    store.negativeControls = [{ cohortId: 99, cohortName: 'NC 1', outcomeConceptId: 111 }];
    store.outcomes = [{ cohortId: 10, cleanWindow: 30 }];
    store.comparisons = [
      { targetId: 1, comparatorId: 2, indicationId: null, genderConceptIds: [], minAge: null, maxAge: null, excludedCovariateConceptIds: [] },
    ];
    store.enabledModules.CohortMethod = true;
    store.enabledModules.CohortDiagnostics = false;
    store.enabledModules.Characterization = false;
    store.enabledModules.CohortIncidence = false;
    store.enabledModules.SCCS = false;

    const spec = serializeSpec(store);
    const mod = spec.moduleSpecifications.find((m) => m.module === 'CohortMethodModule');
    const settings = mod!.settings as Record<string, unknown>;
    const tcoList = settings['targetComparatorOutcomesList'] as Array<Record<string, unknown>>;
    const outcomes = tcoList[0]['outcomes'] as Array<Record<string, unknown>>;

    // Only the real outcome; NC should not appear
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]['outcomeId']).toBe(10);
    expect(outcomes[0]['outcomeOfInterest']).toBe(true);
  });

  // Task 5: empirical calibration ON includes NCs from CM outcome list
  it('CohortMethod: NCs included in outcome list when empirical calibration on', () => {
    const store = useStrategusStore();
    store.cohortMethodSettings.useEmpiricalCalibration = true;
    store.negativeControls = [{ cohortId: 99, cohortName: 'NC 1', outcomeConceptId: 111 }];
    store.outcomes = [{ cohortId: 10, cleanWindow: 30 }];
    store.comparisons = [
      { targetId: 1, comparatorId: 2, indicationId: null, genderConceptIds: [], minAge: null, maxAge: null, excludedCovariateConceptIds: [] },
    ];
    store.enabledModules.CohortMethod = true;
    store.enabledModules.CohortDiagnostics = false;
    store.enabledModules.Characterization = false;
    store.enabledModules.CohortIncidence = false;
    store.enabledModules.SCCS = false;

    const spec = serializeSpec(store);
    const mod = spec.moduleSpecifications.find((m) => m.module === 'CohortMethodModule');
    const settings = mod!.settings as Record<string, unknown>;
    const tcoList = settings['targetComparatorOutcomesList'] as Array<Record<string, unknown>>;
    const outcomes = tcoList[0]['outcomes'] as Array<Record<string, unknown>>;

    expect(outcomes).toHaveLength(2);
    const ncOutcome = outcomes.find((o) => o['outcomeId'] === 99);
    expect(ncOutcome).toBeDefined();
    expect(ncOutcome!['outcomeOfInterest']).toBe(false);
    expect(ncOutcome!['trueEffectSize']).toBe(1);
  });

  // Task 5: SCCS empirical calibration gates NC entries in exposuresOutcomeList
  it('SCCS: NCs excluded from exposuresOutcomeList when empirical calibration off', () => {
    const store = useStrategusStore();
    store.sccsSettings.useEmpiricalCalibration = false;
    store.negativeControls = [{ cohortId: 99, cohortName: 'NC 1', outcomeConceptId: 111 }];
    store.outcomes = [{ cohortId: 10, cleanWindow: 30 }];
    store.comparisons = [
      { targetId: 1, comparatorId: 2, indicationId: null, genderConceptIds: [], minAge: null, maxAge: null, excludedCovariateConceptIds: [] },
    ];
    store.enabledModules.SCCS = true;
    store.enabledModules.CohortDiagnostics = false;
    store.enabledModules.Characterization = false;
    store.enabledModules.CohortIncidence = false;
    store.enabledModules.CohortMethod = false;

    const spec = serializeSpec(store);
    const mod = spec.moduleSpecifications.find((m) => m.module === 'SelfControlledCaseSeriesModule');
    const settings = mod!.settings as Record<string, unknown>;
    const exposuresList = settings['exposuresOutcomeList'] as Array<Record<string, unknown>>;

    // Only real outcomes, no NC (outcomeId 99)
    const ncEntries = exposuresList.filter((e) => e['outcomeId'] === 99);
    expect(ncEntries).toHaveLength(0);
    // Real outcome should still appear (2: target + comparator)
    const realEntries = exposuresList.filter((e) => e['outcomeId'] === 10);
    expect(realEntries).toHaveLength(2);
  });

  // Task 7: 2 era windows produce 2 eraCovariateSettings entries
  it('SCCS: 2 era windows produce 2 eraCovariateSettings entries', () => {
    const store = useStrategusStore();
    store.sccsSettings.analyses[0].eraWindows = [
      { label: 'Pre-exposure', start: -30, end: -1, startAnchor: 'era start', endAnchor: 'era start', exposureOfInterest: false, profileLikelihood: false },
      { label: 'Main', start: 0, end: 0, startAnchor: 'era start', endAnchor: 'era end', exposureOfInterest: true, profileLikelihood: true },
    ];
    store.enabledModules.SCCS = true;
    store.enabledModules.CohortDiagnostics = false;
    store.enabledModules.Characterization = false;
    store.enabledModules.CohortIncidence = false;
    store.enabledModules.CohortMethod = false;

    const spec = serializeSpec(store);
    const mod = spec.moduleSpecifications.find((m) => m.module === 'SelfControlledCaseSeriesModule');
    const settings = mod!.settings as Record<string, unknown>;
    const analysisList = settings['sccsAnalysisList'] as Array<Record<string, unknown>>;
    const intervalDataArgs = analysisList[0]['createIntervalDataArgs'] as Record<string, unknown>;
    const eraCovariateSettings = intervalDataArgs['eraCovariateSettings'] as unknown[];
    expect(eraCovariateSettings).toHaveLength(2);
  });

  // Task 7: includeSeasonality=false omits seasonalityCovariateSettings
  it('SCCS: includeSeasonality=false omits seasonalityCovariateSettings', () => {
    const store = useStrategusStore();
    store.sccsSettings.analyses[0].includeSeasonality = false;
    store.sccsSettings.analyses[0].includeCalendarTime = false;
    store.sccsSettings.analyses[0].includeAgeEffect = false;
    store.enabledModules.SCCS = true;
    store.enabledModules.CohortDiagnostics = false;
    store.enabledModules.Characterization = false;
    store.enabledModules.CohortIncidence = false;
    store.enabledModules.CohortMethod = false;

    const spec = serializeSpec(store);
    const mod = spec.moduleSpecifications.find((m) => m.module === 'SelfControlledCaseSeriesModule');
    const settings = mod!.settings as Record<string, unknown>;
    const analysisList = settings['sccsAnalysisList'] as Array<Record<string, unknown>>;
    const intervalDataArgs = analysisList[0]['createIntervalDataArgs'] as Record<string, unknown>;
    expect(intervalDataArgs['seasonalityCovariateSettings']).toBeUndefined();
    expect(intervalDataArgs['calendarTimeCovariateSettings']).toBeUndefined();
    expect(intervalDataArgs['ageCovariateSettings']).toBeUndefined();
  });

  // Task 6: samplingStrategy='underSample' produces sampleSettings array with correct type
  it('PLP: samplingStrategy underSample produces sampleSettings with correct type', () => {
    const store = useStrategusStore();
    store.cohorts = [{ cohortId: 1, cohortName: 'Target', role: 'Target', subjectCount: null, cohortDefinition: '' }];
    store.outcomes = [{ cohortId: 10, cleanWindow: 30 }];
    store.plpSettings.samplingStrategy = 'underSample';
    store.plpSettings.samplingNumberOutcomesToSampleTo = 5000;
    store.enabledModules.PLP = true;
    store.enabledModules.CohortDiagnostics = false;
    store.enabledModules.Characterization = false;
    store.enabledModules.CohortIncidence = false;
    store.enabledModules.CohortMethod = false;
    store.enabledModules.SCCS = false;

    const spec = serializeSpec(store);
    const mod = spec.moduleSpecifications.find((m) => m.module === 'PatientLevelPredictionModule');
    const settings = mod!.settings as Record<string, unknown>;
    const modelDesignList = settings['modelDesignList'] as Array<Record<string, unknown>>;
    const design = modelDesignList[0];
    // sampleSettings is now an array with one entry
    expect(Array.isArray(design['sampleSettings'])).toBe(true);
    const sampleSettings = (design['sampleSettings'] as Array<Record<string, unknown>>)[0];
    expect(sampleSettings['type']).toBe('underSample');
    expect(sampleSettings['numberOutcomesToSampleTo']).toBe(5000);
  });

  // Task 6: samplingStrategy='none' produces sameData sentinel in sampleSettings
  it('PLP: samplingStrategy none produces sameData sentinel in sampleSettings', () => {
    const store = useStrategusStore();
    store.cohorts = [{ cohortId: 1, cohortName: 'Target', role: 'Target', subjectCount: null, cohortDefinition: '' }];
    store.outcomes = [{ cohortId: 10, cleanWindow: 30 }];
    store.plpSettings.samplingStrategy = 'none';
    store.enabledModules.PLP = true;
    store.enabledModules.CohortDiagnostics = false;
    store.enabledModules.Characterization = false;
    store.enabledModules.CohortIncidence = false;
    store.enabledModules.CohortMethod = false;
    store.enabledModules.SCCS = false;

    const spec = serializeSpec(store);
    const mod = spec.moduleSpecifications.find((m) => m.module === 'PatientLevelPredictionModule');
    const settings = mod!.settings as Record<string, unknown>;
    const modelDesignList = settings['modelDesignList'] as Array<Record<string, unknown>>;
    const design = modelDesignList[0];
    // sampleSettings is now an array with a sameData sentinel
    expect(Array.isArray(design['sampleSettings'])).toBe(true);
    expect((design['sampleSettings'] as unknown[]).length).toBe(1);
    const sentinel = (design['sampleSettings'] as Array<Record<string, unknown>>)[0];
    expect(sentinel['attr_fun']).toBe('sameData');
  });

  // Task 9: runCalibration=true includes executeSettings.runCalibration
  it('PLP: runCalibration=true includes executeSettings.runCalibration', () => {
    const store = useStrategusStore();
    store.cohorts = [{ cohortId: 1, cohortName: 'Target', role: 'Target', subjectCount: null, cohortDefinition: '' }];
    store.outcomes = [{ cohortId: 10, cleanWindow: 30 }];
    store.plpSettings.runCalibration = true;
    store.plpSettings.calibrationBins = 15;
    store.enabledModules.PLP = true;
    store.enabledModules.CohortDiagnostics = false;
    store.enabledModules.Characterization = false;
    store.enabledModules.CohortIncidence = false;
    store.enabledModules.CohortMethod = false;
    store.enabledModules.SCCS = false;

    const spec = serializeSpec(store);
    const mod = spec.moduleSpecifications.find((m) => m.module === 'PatientLevelPredictionModule');
    const settings = mod!.settings as Record<string, unknown>;
    const modelDesignList = settings['modelDesignList'] as Array<Record<string, unknown>>;
    const executeSettings = modelDesignList[0]['executeSettings'] as Record<string, unknown>;
    expect(executeSettings['runCalibration']).toBe(true);
    expect(executeSettings['calibrationBins']).toBe(15);
  });

  // Task 8: User-defined subset definition produces correct subsetDefs entry
  it('user-defined subset definition produces subsetDefs entry with correct format', () => {
    const store = useStrategusStore();
    store.cohorts = [
      { cohortId: 5, cohortName: 'Target A', role: 'Target', subjectCount: null, cohortDefinition: '{}' },
    ];
    store.cohortSubsetDefinitions = [
      {
        id: 1000,
        name: 'First-time use',
        operators: [
          { type: 'LimitSubsetOperator', priorTime: 365, followUpTime: 1, limitTo: 'firstEver' },
        ],
      },
    ];
    store.cohortSubsetAssignments = [
      { cohortId: 5, subsetIds: [1000] },
    ];

    const spec = serializeSpec(store);
    const cohortSR = spec.sharedResources[0] as {
      subsetDefs?: string[];
      cohortSubsets?: Array<{ cohortId: number; subsetId: number; targetCohortId: number }>;
    };

    expect(cohortSR.subsetDefs).toBeDefined();
    // subsetDefs entries are JSON strings — parse them
    const parsedDefs = cohortSR.subsetDefs!.map((s) => JSON.parse(s) as Record<string, unknown>);
    // Should have the user-defined subset (no TCI comparisons, so only the user-defined one)
    const userSubset = parsedDefs.find((d) => d['definitionId'] === 1000);
    expect(userSubset).toBeDefined();
    expect(userSubset!['name']).toBe('First-time use');
    const operators = userSubset!['subsetOperators'] as Array<Record<string, unknown>>;
    expect(operators).toHaveLength(1);
    expect(operators[0]['attr_class']).toContain('LimitSubsetOperator');
    expect(operators[0]['priorTime']).toBe(365);
    expect(operators[0]['limitTo']).toBe('firstEver');

    // cohortSubsets should have an entry for cohort 5 with subset 1000
    expect(cohortSR.cohortSubsets).toBeDefined();
    const subsetEntry = cohortSR.cohortSubsets!.find((s) => s.targetCohortId === 5);
    expect(subsetEntry).toBeDefined();
    expect(subsetEntry!.subsetId).toBe(1000);
    // cohortId = originalId * 1000 + subsetId = 5 * 1000 + 1000 = 6000
    expect(subsetEntry!.cohortId).toBe(6000);
  });

  // Task 8: User-defined subset coexists with TCI-generated subsets
  it('user-defined subsets coexist with TCI-generated subsets in subsetDefs', () => {
    const store = useStrategusStore();
    store.cohorts = [
      { cohortId: 1, cohortName: 'T1', role: 'Target', subjectCount: null, cohortDefinition: '{}' },
      { cohortId: 2, cohortName: 'C1', role: 'Comparator', subjectCount: null, cohortDefinition: '{}' },
      { cohortId: 5, cohortName: 'Extra', role: 'Target', subjectCount: null, cohortDefinition: '{}' },
    ];
    store.comparisons = [
      { targetId: 1, comparatorId: 2, indicationId: null, genderConceptIds: [], minAge: null, maxAge: null, excludedCovariateConceptIds: [] },
    ];
    store.cohortSubsetDefinitions = [
      {
        id: 1001,
        name: 'Demographics filter',
        operators: [
          { type: 'DemographicSubsetOperator', ageMin: 18, ageMax: 65, gender: [8507, 8532] },
        ],
      },
    ];
    store.cohortSubsetAssignments = [
      { cohortId: 5, subsetIds: [1001] },
    ];

    const spec = serializeSpec(store);
    const cohortSR = spec.sharedResources[0] as {
      subsetDefs?: string[];
      cohortSubsets?: Array<{ cohortId: number; subsetId: number; targetCohortId: number }>;
    };

    expect(cohortSR.subsetDefs).toBeDefined();
    // TCI generates 1 subset def (ID=1) + user-defined 1 (ID=1001) = 2 total
    expect(cohortSR.subsetDefs!.length).toBe(2);

    // subsetDefs entries are JSON strings
    const parsedDefs = cohortSR.subsetDefs!.map((s) => JSON.parse(s) as Record<string, unknown>);
    const tciSubset = parsedDefs.find((d) => d['definitionId'] === 1);
    expect(tciSubset).toBeDefined();

    const userSubset = parsedDefs.find((d) => d['definitionId'] === 1001);
    expect(userSubset).toBeDefined();
    expect(userSubset!['name']).toBe('Demographics filter');
    const ops = userSubset!['subsetOperators'] as Array<Record<string, unknown>>;
    expect(ops[0]['ageMin']).toBe(18);
    expect(ops[0]['gender']).toEqual([8507, 8532]);
    expect(ops[0]['attr_class']).toContain('DemographicSubsetOperator');

    // cohortSubsets should have entries from both TCI (IDs 1001, 2001) and user (5 * 1000 + 1001 = 6001)
    const userEntry = cohortSR.cohortSubsets!.find((s) => s.targetCohortId === 5);
    expect(userEntry).toBeDefined();
    expect(userEntry!.cohortId).toBe(6001);
  });

  // Task 8: CohortSubsetOperator is serialized correctly
  it('user-defined CohortSubsetOperator is serialized with cohortIds and negate', () => {
    const store = useStrategusStore();
    store.cohorts = [
      { cohortId: 10, cohortName: 'T', role: 'Target', subjectCount: null, cohortDefinition: '{}' },
    ];
    store.cohortSubsetDefinitions = [
      {
        id: 1002,
        name: 'Indication membership',
        operators: [
          { type: 'CohortSubsetOperator', cohortIds: [123, 456], negate: true },
        ],
      },
    ];
    store.cohortSubsetAssignments = [
      { cohortId: 10, subsetIds: [1002] },
    ];

    const spec = serializeSpec(store);
    const cohortSR = spec.sharedResources[0] as {
      subsetDefs?: string[];
    };

    // subsetDefs entries are JSON strings
    const parsedDefs = cohortSR.subsetDefs!.map((s) => JSON.parse(s) as Record<string, unknown>);
    const userSubset = parsedDefs.find((d) => d['definitionId'] === 1002);
    expect(userSubset).toBeDefined();
    const ops = userSubset!['subsetOperators'] as Array<Record<string, unknown>>;
    expect(ops[0]['name']).toBe('cohort');
    expect(ops[0]['cohortIds']).toEqual([123, 456]);
    expect(ops[0]['negate']).toBe(true);
    expect(ops[0]['attr_class']).toContain('CohortSubsetOperator');
  });

  // Task 8: snapshot/restore round-trips subset definitions and assignments
  it('snapshot and restore round-trip cohortSubsetDefinitions and cohortSubsetAssignments', () => {
    const store = useStrategusStore();
    store.cohortSubsetDefinitions = [
      { id: 1000, name: 'Test subset', operators: [{ type: 'LimitSubsetOperator', limitTo: 'firstEver' }] },
    ];
    store.cohortSubsetAssignments = [{ cohortId: 42, subsetIds: [1000] }];

    const snap = store.snapshot();
    store.resetToDefaults();
    expect(store.cohortSubsetDefinitions).toHaveLength(0);
    expect(store.cohortSubsetAssignments).toHaveLength(0);

    store.restore(snap);
    expect(store.cohortSubsetDefinitions).toHaveLength(1);
    expect(store.cohortSubsetDefinitions[0].name).toBe('Test subset');
    expect(store.cohortSubsetAssignments).toHaveLength(1);
    expect(store.cohortSubsetAssignments[0].cohortId).toBe(42);
    expect(store.cohortSubsetAssignments[0].subsetIds).toEqual([1000]);
  });

  // Task 11: CohortDiagnostics temporalCovariateSettings present with custom days
  it('CohortDiagnostics: temporalCovariateSettings emitted with custom days', () => {
    const store = useStrategusStore();
    (store.cohortDiagnosticsSettings as Record<string, unknown>)['temporalStartDays'] = [-365, -90];
    (store.cohortDiagnosticsSettings as Record<string, unknown>)['temporalEndDays'] = [-91, -1];
    store.enabledModules.CohortDiagnostics = true;

    const spec = serializeSpec(store);
    const mod = spec.moduleSpecifications.find((m) => m.module === 'CohortDiagnosticsModule');
    expect(mod).toBeDefined();
    const settings = mod!.settings as Record<string, unknown>;
    const temporalCovariateSettings = settings['temporalCovariateSettings'] as Record<string, unknown>;
    expect(temporalCovariateSettings).toBeDefined();
    expect(temporalCovariateSettings['temporalStartDays']).toEqual([-365, -90]);
    expect(temporalCovariateSettings['temporalEndDays']).toEqual([-91, -1]);
  });

  // Task 10: custom covariate concept IDs pass through to covariateSettings
  it('CohortMethod: custom covariate concept IDs injected into covariateSettings', () => {
    const store = useStrategusStore();
    store.cohortMethodSettings.includedCovariateConceptIds = [111, 222, 333];
    store.cohortMethodSettings.addDescendantsToInclude = true;
    store.enabledModules.CohortMethod = true;
    store.enabledModules.CohortDiagnostics = false;
    store.enabledModules.Characterization = false;
    store.enabledModules.CohortIncidence = false;
    store.enabledModules.SCCS = false;

    const spec = serializeSpec(store);
    const mod = spec.moduleSpecifications.find((m) => m.module === 'CohortMethodModule');
    const settings = mod!.settings as Record<string, unknown>;
    const analysisList = settings['cmAnalysisList'] as Array<Record<string, unknown>>;
    const dbArgs = analysisList[0]['getDbCohortMethodDataArgs'] as Record<string, unknown>;
    const covSettings = dbArgs['covariateSettings'] as Record<string, unknown>;

    expect(covSettings['includedCovariateConceptIds']).toEqual([111, 222, 333]);
    expect(covSettings['addDescendantsToInclude']).toBe(true);
  });

  // Task 7: study dates are converted from ISO to YYYYMMDD at serialization boundary
  it('CM study dates are serialized as YYYYMMDD strings', () => {
    const store = useStrategusStore();
    store.studyStartDate = '2017-12-01';
    store.studyEndDate = '2022-12-31';
    store.enabledModules.CohortMethod = true;
    store.enabledModules.CohortDiagnostics = false;
    store.enabledModules.Characterization = false;
    store.enabledModules.CohortIncidence = false;
    store.enabledModules.SCCS = false;

    const spec = serializeSpec(store);
    const mod = spec.moduleSpecifications.find((m) => m.module === 'CohortMethodModule');
    const settings = mod!.settings as Record<string, unknown>;
    const analysisList = settings['cmAnalysisList'] as Array<Record<string, unknown>>;
    const dbArgs = analysisList[0]['getDbCohortMethodDataArgs'] as Record<string, unknown>;
    expect(dbArgs['studyStartDate']).toBe('20171201');
    expect(dbArgs['studyEndDate']).toBe('20221231');
  });

  // Task 7: SCCS study dates are converted from ISO to YYYYMMDD
  it('SCCS study dates are serialized as YYYYMMDD strings', () => {
    const store = useStrategusStore();
    store.studyStartDate = '2018-01-01';
    store.studyEndDate = '2023-06-30';
    store.enabledModules.SCCS = true;
    store.enabledModules.CohortDiagnostics = false;
    store.enabledModules.Characterization = false;
    store.enabledModules.CohortIncidence = false;
    store.enabledModules.CohortMethod = false;

    const spec = serializeSpec(store);
    const mod = spec.moduleSpecifications.find((m) => m.module === 'SelfControlledCaseSeriesModule');
    const settings = mod!.settings as Record<string, unknown>;
    const analysisList = settings['sccsAnalysisList'] as Array<Record<string, unknown>>;
    const dbArgs = analysisList[0]['getDbSccsDataArgs'] as Record<string, unknown>;
    // SCCS now uses singular studyStartDate/studyEndDate (matches Strategus)
    expect(dbArgs['studyStartDate']).toBe('20180101');
    expect(dbArgs['studyEndDate']).toBe('20230630');
  });

  // Task 5: PLP modelSettings uses real Strategus shape with fitFunction and param
  it('PLP modelSettings uses real Strategus shape for lassoLogisticRegression', () => {
    const store = useStrategusStore();
    store.cohorts = [{ cohortId: 1, cohortName: 'Target', role: 'Target', subjectCount: null, cohortDefinition: '' }];
    store.outcomes = [{ cohortId: 10, cleanWindow: 30 }];
    store.plpSettings.modelType = 'lassoLogisticRegression';
    store.enabledModules.PLP = true;
    store.enabledModules.CohortDiagnostics = false;
    store.enabledModules.Characterization = false;
    store.enabledModules.CohortIncidence = false;
    store.enabledModules.CohortMethod = false;
    store.enabledModules.SCCS = false;

    const spec = serializeSpec(store);
    const mod = spec.moduleSpecifications.find((m) => m.module === 'PatientLevelPredictionModule');
    const settings = mod!.settings as Record<string, unknown>;
    const design = (settings['modelDesignList'] as Array<Record<string, unknown>>)[0];
    const modelSettings = design['modelSettings'] as Record<string, unknown>;

    expect(modelSettings['fitFunction']).toBe('fitCyclopsModel');
    expect(modelSettings['attr_class']).toBe('modelSettings');
    const param = modelSettings['param'] as Record<string, unknown>;
    expect(param).toBeDefined();
    const attrSettings = param['attr_settings'] as Record<string, unknown>;
    expect(attrSettings['modelType']).toBe('logistic');
    expect(attrSettings['name']).toBe('Lasso Logistic Regression');

    // splitSettings should include seed and attr_fun
    const splitSettings = design['splitSettings'] as Record<string, unknown>;
    expect(splitSettings['seed']).toBe(1234);
    expect(splitSettings['attr_fun']).toBe('randomSplitter');

    // Old modelName field should not be present
    expect(modelSettings['modelName']).toBeUndefined();
  });

  // Task 4: CohortIncidence irDesign uses new schema with targetDefs/outcomeDefs/timeAtRiskDefs
  it('CohortIncidence irDesign uses targetDefs, outcomeDefs, timeAtRiskDefs schema', () => {
    const store = useStrategusStore();
    store.cohorts = [
      { cohortId: 1, cohortName: 'Celecoxib', role: 'Target', subjectCount: null, cohortDefinition: '' },
    ];
    store.outcomes = [{ cohortId: 3, cleanWindow: 9999 }];
    store.timeAtRisk = [
      { label: 'On treatment', riskWindowStart: 1, startAnchor: 'cohort start', riskWindowEnd: 0, endAnchor: 'cohort end' },
    ];
    store.cohortIncidenceSettings.byAge = true;
    store.cohortIncidenceSettings.byGender = true;
    store.cohortIncidenceSettings.byYear = false;
    store.enabledModules.CohortIncidence = true;
    store.enabledModules.CohortDiagnostics = false;
    store.enabledModules.Characterization = false;
    store.enabledModules.CohortMethod = false;
    store.enabledModules.SCCS = false;

    const spec = serializeSpec(store);
    const mod = spec.moduleSpecifications.find((m) => m.module === 'CohortIncidenceModule');
    expect(mod).toBeDefined();
    const irDesign = (mod!.settings as Record<string, unknown>)['irDesign'] as Record<string, unknown>;

    expect(Array.isArray(irDesign['targetDefs'])).toBe(true);
    expect((irDesign['targetDefs'] as unknown[]).length).toBe(1);
    expect(Array.isArray(irDesign['outcomeDefs'])).toBe(true);
    expect((irDesign['outcomeDefs'] as unknown[]).length).toBe(1);
    expect(Array.isArray(irDesign['timeAtRiskDefs'])).toBe(true);
    expect((irDesign['timeAtRiskDefs'] as unknown[]).length).toBe(1);

    const tar = (irDesign['timeAtRiskDefs'] as Array<Record<string, unknown>>)[0];
    expect((tar['start'] as Record<string, unknown>)['dateField']).toBe('start');
    expect((tar['end'] as Record<string, unknown>)['dateField']).toBe('end');

    const strataSettings = irDesign['strataSettings'] as Record<string, unknown>;
    expect(strataSettings['byAge']).toBe(true);
    expect(strataSettings['byGender']).toBe(true);
    expect(strataSettings['byYear']).toBe(false);

    // Old schema keys should not exist
    expect(irDesign['targets']).toBeUndefined();
    expect(irDesign['outcomes']).toBeUndefined();
    expect(irDesign['timeAtRisk']).toBeUndefined();
    expect(irDesign['strata']).toBeUndefined();
  });

  // Task 12: TreatmentPatterns emits includeTreatments, indexDateOffset, censorType
  it('TreatmentPatterns: emits includeTreatments, indexDateOffset, censorType', () => {
    const store = useStrategusStore();
    store.treatmentPatternsSettings.includeTreatments = 'Changes';
    store.treatmentPatternsSettings.indexDateOffset = 5;
    store.treatmentPatternsSettings.censorType = 'remove';
    store.enabledModules.TreatmentPatterns = true;
    store.enabledModules.CohortDiagnostics = false;
    store.enabledModules.Characterization = false;
    store.enabledModules.CohortIncidence = false;
    store.enabledModules.CohortMethod = false;
    store.enabledModules.SCCS = false;

    const spec = serializeSpec(store);
    const mod = spec.moduleSpecifications.find((m) => m.module === 'TreatmentPatternsModule');
    expect(mod).toBeDefined();
    const settings = mod!.settings as Record<string, unknown>;
    expect(settings['includeTreatments']).toBe('Changes');
    expect(settings['indexDateOffset']).toBe(5);
    expect(settings['censorType']).toBe('remove');
  });

  // Task 11: CohortDiagnostics cohortIds emitted when specified
  it('CohortDiagnostics: specific cohortIds emitted when set', () => {
    const store = useStrategusStore();
    store.cohorts = [
      { cohortId: 1, cohortName: 'Target A', role: 'Target', subjectCount: null, cohortDefinition: '' },
      { cohortId: 2, cohortName: 'Target B', role: 'Target', subjectCount: null, cohortDefinition: '' },
    ];
    (store.cohortDiagnosticsSettings as Record<string, unknown>)['cohortIds'] = [1];
    store.enabledModules.CohortDiagnostics = true;

    const spec = serializeSpec(store);
    const mod = spec.moduleSpecifications.find((m) => m.module === 'CohortDiagnosticsModule');
    expect(mod).toBeDefined();
    const settings = mod!.settings as Record<string, unknown>;
    expect(settings['cohortIds']).toEqual([1]);
  });

  // Task 11: CohortDiagnostics cohortIds defaults to all cohort IDs when empty
  it('CohortDiagnostics: empty cohortIds resolves to all cohort IDs', () => {
    const store = useStrategusStore();
    store.cohorts = [
      { cohortId: 10, cohortName: 'Target A', role: 'Target', subjectCount: null, cohortDefinition: '' },
      { cohortId: 20, cohortName: 'Target B', role: 'Target', subjectCount: null, cohortDefinition: '' },
    ];
    (store.cohortDiagnosticsSettings as Record<string, unknown>)['cohortIds'] = [];
    store.enabledModules.CohortDiagnostics = true;

    const spec = serializeSpec(store);
    const mod = spec.moduleSpecifications.find((m) => m.module === 'CohortDiagnosticsModule');
    const settings = mod!.settings as Record<string, unknown>;
    expect(settings['cohortIds']).toEqual([10, 20]);
  });

  // Task 11: CohortDiagnostics temporalCovariateSettings includes feature flags
  it('CohortDiagnostics: temporal covariate features included in temporalCovariateSettings', () => {
    const store = useStrategusStore();
    (store.cohortDiagnosticsSettings as Record<string, unknown>)['temporalCovariateFeatures'] = {
      DemographicsGender: true,
      DemographicsAge: false,
      ConditionEraStart: true,
    };
    store.enabledModules.CohortDiagnostics = true;

    const spec = serializeSpec(store);
    const mod = spec.moduleSpecifications.find((m) => m.module === 'CohortDiagnosticsModule');
    const settings = mod!.settings as Record<string, unknown>;
    const tcs = settings['temporalCovariateSettings'] as Record<string, unknown>;
    expect(tcs['DemographicsGender']).toBe(true);
    expect(tcs['DemographicsAge']).toBe(false);
    expect(tcs['ConditionEraStart']).toBe(true);
    expect(tcs['attr_class']).toBe('covariateSettings');
  });

  // Task 10: covariate feature flags pass through to covariateSettings
  it('CohortMethod: covariate feature flag disabled emits false in covariateSettings', () => {
    const store = useStrategusStore();
    store.cohortMethodSettings.covariateFeatures['DrugGroupEraLongTerm'] = false;
    store.cohortMethodSettings.covariateFeatures['DemographicsGender'] = true;
    store.enabledModules.CohortMethod = true;
    store.enabledModules.CohortDiagnostics = false;
    store.enabledModules.Characterization = false;
    store.enabledModules.CohortIncidence = false;
    store.enabledModules.SCCS = false;

    const spec = serializeSpec(store);
    const mod = spec.moduleSpecifications.find((m) => m.module === 'CohortMethodModule');
    const settings = mod!.settings as Record<string, unknown>;
    const analysisList = settings['cmAnalysisList'] as Array<Record<string, unknown>>;
    const dbArgs = analysisList[0]['getDbCohortMethodDataArgs'] as Record<string, unknown>;
    const covSettings = dbArgs['covariateSettings'] as Record<string, unknown>;

    expect(covSettings['DrugGroupEraLongTerm']).toBe(false);
    expect(covSettings['DemographicsGender']).toBe(true);
  });

  // Task 10: covariate windows pass through
  it('CohortMethod: custom covariate windows emitted correctly', () => {
    const store = useStrategusStore();
    store.cohortMethodSettings.covariateWindows.longTermStartDays = -730;
    store.cohortMethodSettings.covariateWindows.shortTermStartDays = -60;
    store.cohortMethodSettings.covariateWindows.endDays = 0;
    store.enabledModules.CohortMethod = true;
    store.enabledModules.CohortDiagnostics = false;
    store.enabledModules.Characterization = false;
    store.enabledModules.CohortIncidence = false;
    store.enabledModules.SCCS = false;

    const spec = serializeSpec(store);
    const mod = spec.moduleSpecifications.find((m) => m.module === 'CohortMethodModule');
    const settings = mod!.settings as Record<string, unknown>;
    const analysisList = settings['cmAnalysisList'] as Array<Record<string, unknown>>;
    const dbArgs = analysisList[0]['getDbCohortMethodDataArgs'] as Record<string, unknown>;
    const covSettings = dbArgs['covariateSettings'] as Record<string, unknown>;

    expect(covSettings['longTermStartDays']).toBe(-730);
    expect(covSettings['shortTermStartDays']).toBe(-60);
    expect(covSettings['endDays']).toBe(0);
  });

  // Task 9: multiple SCCS analyses produce multiple sccsAnalysisList entries
  it('SCCS: 2 analyses produce 2 sccsAnalysisList entries with sequential IDs', () => {
    const store = useStrategusStore();
    store.sccsSettings.analyses = [
      {
        analysisId: 1,
        description: 'Analysis A',
        eraWindows: [{ label: 'Main', start: 0, end: 0, startAnchor: 'era start', endAnchor: 'era end', exposureOfInterest: true, profileLikelihood: true }],
        naivePeriod: 365,
        calendarTimeKnots: 5,
        seasonalityKnots: 5,
        includeAgeEffect: false,
        includeSeasonality: true,
        includeCalendarTime: false,
      },
      {
        analysisId: 2,
        description: 'Analysis B',
        eraWindows: [{ label: 'Main', start: 0, end: 0, startAnchor: 'era start', endAnchor: 'era end', exposureOfInterest: true, profileLikelihood: true }],
        naivePeriod: 180,
        calendarTimeKnots: 5,
        seasonalityKnots: 3,
        includeAgeEffect: true,
        includeSeasonality: false,
        includeCalendarTime: true,
      },
    ];
    store.enabledModules.SCCS = true;
    store.enabledModules.CohortDiagnostics = false;
    store.enabledModules.Characterization = false;
    store.enabledModules.CohortIncidence = false;
    store.enabledModules.CohortMethod = false;

    const spec = serializeSpec(store);
    const mod = spec.moduleSpecifications.find((m) => m.module === 'SelfControlledCaseSeriesModule');
    const settings = mod!.settings as Record<string, unknown>;
    const analysisList = settings['sccsAnalysisList'] as Array<Record<string, unknown>>;

    expect(analysisList).toHaveLength(2);
    expect(analysisList[0]['analysisId']).toBe(1);
    expect(analysisList[0]['description']).toBe('Analysis A');
    expect(analysisList[1]['analysisId']).toBe(2);
    expect(analysisList[1]['description']).toBe('Analysis B');

    // Analysis A: seasonality on, calendar off
    const iDataA = analysisList[0]['createIntervalDataArgs'] as Record<string, unknown>;
    expect(iDataA['seasonalityCovariateSettings']).toBeDefined();
    expect(iDataA['calendarTimeCovariateSettings']).toBeUndefined();

    // Analysis B: calendar on, seasonality off, age on
    const iDataB = analysisList[1]['createIntervalDataArgs'] as Record<string, unknown>;
    expect(iDataB['calendarTimeCovariateSettings']).toBeDefined();
    expect(iDataB['seasonalityCovariateSettings']).toBeUndefined();
    expect(iDataB['ageCovariateSettings']).toBeDefined();
  });

  // Task 15: SCCS nestingCohortId only emitted when indicationId is not null
  it('SCCS: nestingCohortId omitted when indicationId is null', () => {
    const store = useStrategusStore();
    store.comparisons = [
      { targetId: 1, comparatorId: 2, indicationId: null, genderConceptIds: [], minAge: null, maxAge: null, excludedCovariateConceptIds: [] },
    ];
    store.outcomes = [{ cohortId: 10, cleanWindow: 30 }];
    store.enabledModules.SCCS = true;
    store.enabledModules.CohortDiagnostics = false;
    store.enabledModules.Characterization = false;
    store.enabledModules.CohortIncidence = false;
    store.enabledModules.CohortMethod = false;

    const spec = serializeSpec(store);
    const mod = spec.moduleSpecifications.find((m) => m.module === 'SelfControlledCaseSeriesModule');
    const settings = mod!.settings as Record<string, unknown>;
    const exposuresList = settings['exposuresOutcomeList'] as Array<Record<string, unknown>>;

    // nestingCohortId should NOT be present when indicationId is null
    expect('nestingCohortId' in exposuresList[0]).toBe(false);
  });

  // Task 15: SCCS nestingCohortId emitted when indicationId is set
  it('SCCS: nestingCohortId emitted when indicationId is set', () => {
    const store = useStrategusStore();
    store.comparisons = [
      { targetId: 1, comparatorId: 2, indicationId: 5, genderConceptIds: [], minAge: null, maxAge: null, excludedCovariateConceptIds: [] },
    ];
    store.outcomes = [{ cohortId: 10, cleanWindow: 30 }];
    store.enabledModules.SCCS = true;
    store.enabledModules.CohortDiagnostics = false;
    store.enabledModules.Characterization = false;
    store.enabledModules.CohortIncidence = false;
    store.enabledModules.CohortMethod = false;

    const spec = serializeSpec(store);
    const mod = spec.moduleSpecifications.find((m) => m.module === 'SelfControlledCaseSeriesModule');
    const settings = mod!.settings as Record<string, unknown>;
    const exposuresList = settings['exposuresOutcomeList'] as Array<Record<string, unknown>>;

    expect(exposuresList[0]['nestingCohortId']).toBe(5);
  });

  // Task 15: SCCS exposureIdRef present in each exposure entry
  it('SCCS: exposureIdRef emitted in each exposure entry', () => {
    const store = useStrategusStore();
    store.comparisons = [
      { targetId: 1, comparatorId: 2, indicationId: null, genderConceptIds: [], minAge: null, maxAge: null, excludedCovariateConceptIds: [] },
    ];
    store.outcomes = [{ cohortId: 10, cleanWindow: 30 }];
    store.enabledModules.SCCS = true;
    store.enabledModules.CohortDiagnostics = false;
    store.enabledModules.Characterization = false;
    store.enabledModules.CohortIncidence = false;
    store.enabledModules.CohortMethod = false;

    const spec = serializeSpec(store);
    const mod = spec.moduleSpecifications.find((m) => m.module === 'SelfControlledCaseSeriesModule');
    const settings = mod!.settings as Record<string, unknown>;
    const exposuresList = settings['exposuresOutcomeList'] as Array<Record<string, unknown>>;

    const exposure = (exposuresList[0]['exposures'] as Array<Record<string, unknown>>)[0];
    expect(exposure['exposureIdRef']).toBe('exposureId');
  });
});
