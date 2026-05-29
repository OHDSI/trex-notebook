import { computed } from 'vue';
import { useStrategusStore } from './useStrategusStore';
import type { SidebarItem, SidebarModule, ValidationResult } from '../models/Validation';

const disabled: ValidationResult = { status: 'neutral', message: 'Disabled' };

export function useValidation() {
  const store = useStrategusStore();

  // ── Section validators ─────────────────────────────────────────────────────

  const setupStatus = computed<ValidationResult>(() => {
    if (!store.studyName.trim()) {
      return { status: 'warning', message: 'Study name is required' };
    }
    return { status: 'valid', message: 'Study name set' };
  });

  const cohortsStatus = computed<ValidationResult>(() => {
    if (store.cohorts.length === 0) {
      return { status: 'warning', message: 'Add at least 1 cohort' };
    }
    return { status: 'valid', message: `${store.cohorts.length} cohort(s) defined` };
  });

  const comparisonsStatus = computed<ValidationResult>(() => {
    const cmEnabled = store.isModuleEnabled('CohortMethod');
    const sccsEnabled = store.isModuleEnabled('SCCS');
    const estimationEnabled = cmEnabled || sccsEnabled;

    if (!estimationEnabled) {
      return { status: 'valid', message: 'No estimation modules enabled' };
    }
    if (store.comparisons.length === 0) {
      return { status: 'warning', message: 'Add at least 1 target-comparator-indication (TCI)' };
    }
    return { status: 'valid', message: `${store.comparisons.length} TCI(s) defined` };
  });

  const outcomesStatus = computed<ValidationResult>(() => {
    if (store.outcomes.length === 0) {
      return { status: 'warning', message: 'Add at least 1 outcome' };
    }
    const invalid = store.outcomes.filter((o) => o.cleanWindow <= 0);
    if (invalid.length > 0) {
      return { status: 'error', message: `${invalid.length} outcome(s) have cleanWindow ≤ 0` };
    }
    return { status: 'valid', message: `${store.outcomes.length} outcome(s) defined` };
  });

  const tarStatus = computed<ValidationResult>(() => {
    // timeAtRisk is an array; valid when at least 1 window with a non-empty label
    const validWindows = store.timeAtRisk.filter((w) => w.label && w.label.trim() !== '');
    if (validWindows.length === 0) {
      return { status: 'warning', message: 'Define at least 1 time-at-risk window' };
    }
    const count = store.timeAtRisk.length;
    return { status: 'valid', message: `${count} time-at-risk window${count !== 1 ? 's' : ''} defined` };
  });

  // ── Module validators ──────────────────────────────────────────────────────

  const cohortDiagnosticsStatus = computed<ValidationResult>(() => {
    if (!store.isModuleEnabled('CohortDiagnostics')) return disabled;
    return { status: 'valid', message: 'All defaults' };
  });

  function listMissing(items: string[]): string {
    if (items.length === 1) return items[0];
    if (items.length === 2) return `${items[0]} and ${items[1]}`;
    return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
  }

  const characterizationStatus = computed<ValidationResult>(() => {
    if (!store.isModuleEnabled('Characterization')) return disabled;
    const targets = store.cohortsByRole('Target');
    const outcomes = store.cohortsByRole('Outcome');
    const missing: string[] = [];
    if (targets.length === 0) missing.push('add a cohort with Target role (Study Design → Cohorts)');
    if (outcomes.length === 0) missing.push('add a cohort with Outcome role (Study Design → Cohorts)');
    if (missing.length > 0) {
      return { status: 'warning', message: `To enable: ${listMissing(missing)}.` };
    }
    return { status: 'valid', message: 'Targets and outcomes derived from Study Design.' };
  });

  const cohortIncidenceStatus = computed<ValidationResult>(() => {
    if (!store.isModuleEnabled('CohortIncidence')) return disabled;
    const targets = store.cohortsByRole('Target');
    const outcomes = store.cohortsByRole('Outcome');
    const hasTar = store.timeAtRisk.some((w) => w.label && w.label.trim() !== '');
    const missing: string[] = [];
    if (targets.length === 0) missing.push('add a Target cohort (Study Design → Cohorts)');
    if (outcomes.length === 0) missing.push('add an Outcome cohort (Study Design → Cohorts)');
    if (!hasTar) missing.push('define a time-at-risk window (Study Design → Time-at-Risk)');
    if (missing.length > 0) {
      return { status: 'warning', message: `To enable: ${listMissing(missing)}.` };
    }
    return { status: 'valid', message: 'Design auto-built from cohorts and TAR.' };
  });

  const cohortMethodStatus = computed<ValidationResult>(() => {
    if (!store.isModuleEnabled('CohortMethod')) return disabled;
    const missing: string[] = [];
    if (store.comparisons.length === 0) missing.push('define a Target-vs-Comparator comparison (Study Design → Comparisons)');
    if (store.outcomes.length === 0) missing.push('add at least one outcome (Study Design → Outcomes)');
    if (missing.length > 0) {
      return { status: 'warning', message: `To enable: ${listMissing(missing)}.` };
    }
    return { status: 'valid', message: 'Comparisons and outcomes present.' };
  });

  const sccsStatus = computed<ValidationResult>(() => {
    if (!store.isModuleEnabled('SCCS')) return disabled;
    const missing: string[] = [];
    if (store.comparisons.length === 0) missing.push('define a comparison to derive exposure-outcome pairs (Study Design → Comparisons)');
    if (store.outcomes.length === 0) missing.push('add at least one outcome (Study Design → Outcomes)');
    if (missing.length > 0) {
      return { status: 'warning', message: `To enable: ${listMissing(missing)}.` };
    }
    return { status: 'valid', message: 'Exposure-outcome pairs derived from comparisons.' };
  });

  const plpStatus = computed<ValidationResult>(() => {
    if (!store.isModuleEnabled('PLP')) return disabled;
    const targets = store.cohortsByRole('Target');
    const outcomes = store.cohortsByRole('Outcome');
    const missing: string[] = [];
    if (targets.length === 0) missing.push('add a cohort with Target role (Study Design → Cohorts)');
    if (outcomes.length === 0) missing.push('add a cohort with Outcome role (Study Design → Cohorts)');
    if (missing.length > 0) {
      return { status: 'warning', message: `To enable: ${listMissing(missing)}.` };
    }
    return { status: 'valid', message: 'Model designs auto-generated.' };
  });

  const plpValidationStatus = computed<ValidationResult>(() => {
    if (!store.isModuleEnabled('PLPValidation')) return disabled;
    if (store.plpValidationSettings.validationDesigns.length === 0) {
      return { status: 'warning', message: 'Add at least 1 validation design' };
    }
    return { status: 'valid', message: `${store.plpValidationSettings.validationDesigns.length} validation design(s)` };
  });

  const treatmentPatternsStatus = computed<ValidationResult>(() => {
    if (!store.isModuleEnabled('TreatmentPatterns')) return disabled;
    const roles = store.treatmentPatternsSettings.cohortRoles;
    const hasTarget = roles.some((r) => r.type === 'target');
    const hasEvent = roles.some((r) => r.type === 'event');
    if (!hasTarget || !hasEvent) {
      return { status: 'warning', message: 'Requires at least 1 target and 1 event cohort in TP roles' };
    }
    return { status: 'valid', message: 'Target and event cohorts assigned' };
  });

  const evidenceSynthesisStatus = computed<ValidationResult>(() => {
    if (!store.isModuleEnabled('EvidenceSynthesis')) return disabled;
    if (store.evidenceSynthesisSettings.analyses.length === 0) {
      return { status: 'warning', message: 'Add at least 1 synthesis analysis' };
    }
    return { status: 'valid', message: `${store.evidenceSynthesisSettings.analyses.length} analysis(es)` };
  });

  // ── Public API ─────────────────────────────────────────────────────────────

  function moduleStatus(key: SidebarModule): ValidationResult {
    switch (key) {
      case 'cohortDiagnostics': return cohortDiagnosticsStatus.value;
      case 'characterization': return characterizationStatus.value;
      case 'cohortIncidence': return cohortIncidenceStatus.value;
      case 'cohortMethod': return cohortMethodStatus.value;
      case 'sccs': return sccsStatus.value;
      case 'plp': return plpStatus.value;
      case 'plpValidation': return plpValidationStatus.value;
      case 'treatmentPatterns': return treatmentPatternsStatus.value;
      case 'evidenceSynthesis': return evidenceSynthesisStatus.value;
    }
  }

  function statusFor(item: SidebarItem): ValidationResult {
    switch (item) {
      case 'overview': return { status: 'neutral', message: '' };
      case 'export': return { status: 'neutral', message: '' };
      case 'study': {
        // Aggregate worst status across design sections only
        const subs = [setupStatus.value, cohortsStatus.value, comparisonsStatus.value, outcomesStatus.value, tarStatus.value];
        if (subs.some(s => s.status === 'error')) return { status: 'error', message: 'Some design sections have errors' };
        if (subs.some(s => s.status === 'warning')) return { status: 'warning', message: 'Some design sections need attention' };
        return { status: 'valid', message: 'All design sections complete' };
      }
      case 'modules': {
        const subs = [
          cohortDiagnosticsStatus.value, characterizationStatus.value, cohortIncidenceStatus.value,
          cohortMethodStatus.value, sccsStatus.value, plpStatus.value,
          plpValidationStatus.value, treatmentPatternsStatus.value, evidenceSynthesisStatus.value,
        ].filter(s => s.status !== 'neutral'); // skip disabled
        if (subs.length === 0) return { status: 'valid', message: 'No modules enabled' };
        if (subs.some(s => s.status === 'error')) return { status: 'error', message: 'Some modules have errors' };
        if (subs.some(s => s.status === 'warning')) return { status: 'warning', message: 'Some modules need attention' };
        return { status: 'valid', message: 'All enabled modules complete' };
      }
      case 'setup': return setupStatus.value;
      case 'cohorts': return cohortsStatus.value;
      case 'comparisons': return comparisonsStatus.value;
      case 'outcomes': return outcomesStatus.value;
      case 'tar': return tarStatus.value;
      default: return moduleStatus(item as SidebarModule);
    }
  }

  const canExport = computed<boolean>(() => {
    const sectionKeys: SidebarItem[] = ['setup', 'cohorts', 'comparisons', 'outcomes', 'tar'];
    const moduleKeys: SidebarModule[] = [
      'cohortDiagnostics',
      'characterization',
      'cohortIncidence',
      'cohortMethod',
      'sccs',
      'plp',
      'plpValidation',
      'treatmentPatterns',
      'evidenceSynthesis',
    ];

    for (const key of sectionKeys) {
      const result = statusFor(key);
      if (result.status === 'warning' || result.status === 'error') return false;
    }

    for (const key of moduleKeys) {
      const result = moduleStatus(key);
      if (result.status === 'warning' || result.status === 'error') return false;
    }

    return true;
  });

  return {
    statusFor,
    moduleStatus,
    canExport,
  };
}
