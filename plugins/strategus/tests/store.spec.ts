import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useStrategusStore } from '../src/store/useStrategusStore';
import { useValidation } from '../src/store/validation';

describe('useValidation', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  // 1. warns when study name is empty
  it('warns when study name is empty', () => {
    const store = useStrategusStore();
    const validation = useValidation();

    store.studyName = '';
    expect(validation.statusFor('setup').status).toBe('warning');
  });

  // 2. is valid when study name is set
  it('is valid when study name is set', () => {
    const store = useStrategusStore();
    const validation = useValidation();

    store.studyName = 'My Study';
    expect(validation.statusFor('setup').status).toBe('valid');
  });

  // 3. warns when no cohorts
  it('warns when no cohorts', () => {
    const store = useStrategusStore();
    const validation = useValidation();

    store.cohorts = [];
    expect(validation.statusFor('cohorts').status).toBe('warning');
  });

  // 4. cohort diagnostics is always valid when enabled
  it('cohort diagnostics is always valid when enabled', () => {
    const store = useStrategusStore();
    const validation = useValidation();

    // CohortDiagnostics is enabled by default
    expect(store.isModuleEnabled('CohortDiagnostics')).toBe(true);
    expect(validation.moduleStatus('cohortDiagnostics').status).toBe('valid');
  });

  // 5. characterization warns without targets/outcomes
  it('characterization warns without targets/outcomes', () => {
    const store = useStrategusStore();
    const validation = useValidation();

    store.cohorts = [];
    // Characterization is enabled by default
    expect(store.isModuleEnabled('Characterization')).toBe(true);
    expect(validation.moduleStatus('characterization').status).toBe('warning');
  });

  // 6. characterization valid with targets and outcomes
  it('characterization valid with targets and outcomes', () => {
    const store = useStrategusStore();
    const validation = useValidation();

    store.cohorts = [
      {
        cohortId: 1,
        cohortName: 'Target Cohort',
        role: 'Target',
        subjectCount: null,
        cohortDefinition: '',
      },
      {
        cohortId: 2,
        cohortName: 'Outcome Cohort',
        role: 'Outcome',
        subjectCount: null,
        cohortDefinition: '',
      },
    ];

    expect(validation.moduleStatus('characterization').status).toBe('valid');
  });

  // 7. cohort method warns without comparisons (when outcomes exist but no comparisons)
  it('cohort method warns without comparisons', () => {
    const store = useStrategusStore();
    const validation = useValidation();

    store.outcomes = [{ cohortId: 1, cleanWindow: 365 }];
    store.comparisons = [];

    // CohortMethod is enabled by default
    expect(store.isModuleEnabled('CohortMethod')).toBe(true);
    expect(validation.moduleStatus('cohortMethod').status).toBe('warning');
  });

  // 8. disabled modules show neutral status
  it('disabled modules show neutral status', () => {
    const store = useStrategusStore();
    const validation = useValidation();

    // PLP is disabled by default
    expect(store.isModuleEnabled('PLP')).toBe(false);
    expect(validation.moduleStatus('plp').status).toBe('neutral');

    // PLPValidation is disabled by default
    expect(store.isModuleEnabled('PLPValidation')).toBe(false);
    expect(validation.moduleStatus('plpValidation').status).toBe('neutral');

    // EvidenceSynthesis is disabled by default
    expect(store.isModuleEnabled('EvidenceSynthesis')).toBe(false);
    expect(validation.moduleStatus('evidenceSynthesis').status).toBe('neutral');
  });

  // 9. comparisons valid when no estimation modules enabled
  it('comparisons valid when no estimation modules enabled', () => {
    const store = useStrategusStore();
    const validation = useValidation();

    // Disable CM and SCCS
    store.enabledModules.CohortMethod = false;
    store.enabledModules.SCCS = false;

    // No comparisons defined
    store.comparisons = [];

    expect(validation.statusFor('comparisons').status).toBe('valid');
  });

  // 10. canExport is false when study name missing
  it('canExport is false when study name missing', () => {
    const store = useStrategusStore();
    const validation = useValidation();

    store.studyName = '';
    expect(validation.canExport.value).toBe(false);
  });
});
