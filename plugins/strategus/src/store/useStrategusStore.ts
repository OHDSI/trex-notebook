import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import type { SidebarItem } from '../models/Validation';
import type {
  CohortDiagnosticsSettings,
  CharacterizationSettings,
  CohortIncidenceSettings,
  CohortMethodSettings,
  SccsSettings,
  PlpSettings,
  PlpValidationSettings,
  TreatmentPatternsSettings,
  EvidenceSynthesisSettings,
} from '../models/ModuleSettings';
import {
  createDefaultTimeAtRisk,
  createDefaultPlpTimeAtRisk,
  createDefaultCohortDiagnostics,
  createDefaultCharacterization,
  createDefaultCohortIncidence,
  createDefaultCohortMethod,
  createDefaultSccs,
  createDefaultPlp,
  createDefaultPlpValidation,
  createDefaultTreatmentPatterns,
  createDefaultEvidenceSynthesis,
  type TimeAtRiskWindow,
} from '../services/DefaultsFactory';
import type { StudyTypeId } from '../services/StudyTypePresets';

// Exported types consumed by UI components

export type CohortRole = 'Target' | 'Comparator' | 'Outcome' | 'Indication';

export interface CohortSubsetOperator {
  type: 'LimitSubsetOperator' | 'DemographicSubsetOperator' | 'CohortSubsetOperator';
  // LimitSubsetOperator fields:
  priorTime?: number;
  followUpTime?: number;
  limitTo?: 'firstEver' | 'all' | 'lastEver' | 'earliestRemaining' | 'latestRemaining';
  calendarStartDate?: string;
  calendarEndDate?: string;
  // DemographicSubsetOperator fields:
  ageMin?: number;
  ageMax?: number;
  gender?: number[];
  // CohortSubsetOperator fields:
  cohortIds?: number[];
  negate?: boolean;
}

export interface CohortSubsetDefinition {
  id: number;          // subset definition ID (≥ 1000 to avoid collision with TCI-generated)
  name: string;        // user-friendly label
  operators: CohortSubsetOperator[];
}

export interface CohortSubsetAssignment {
  cohortId: number;       // ID of the cohort to apply the subset to
  subsetIds: number[];    // IDs of subset definitions to apply
}

export interface CohortEntry {
  cohortId: number;
  cohortName: string;
  role: CohortRole;
  subjectCount: number | null;
  cohortDefinition: string;
}

export interface TciDefinition {
  targetId: number;
  comparatorId: number;
  indicationId: number | null;
  genderConceptIds: number[];
  minAge: number | null;
  maxAge: number | null;
  excludedCovariateConceptIds: number[];
}

export interface OutcomeEntry {
  cohortId: number;
  cleanWindow: number;
  outcomeName?: string; // optional — used when the cohort isn't in store.cohorts
}

// Per-CohortIncidence analysis-list entry — maps target cohorts × outcomes × TARs
export interface CohortIncidenceAnalysis {
  targets: number[]; // cohort IDs (subset of all Target cohorts)
  outcomes: number[]; // outcomeDef indices (1-based) — references into outcomeDefs
  tars: number[]; // TAR indices (1-based) — references into cohortIncidenceTars
}

export interface NegativeControlEntry {
  cohortId: number;
  cohortName: string;
  outcomeConceptId: number;
  // Optional concept metadata round-tripped from real OHDSI specs.
  // The UI doesn't surface these but real specs always carry them, so we
  // preserve them as opaque passthrough to keep export byte-stable.
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
}

type ModuleName =
  | 'CohortDiagnostics'
  | 'Characterization'
  | 'CohortIncidence'
  | 'CohortMethod'
  | 'SCCS'
  | 'PLP'
  | 'PLPValidation'
  | 'TreatmentPatterns'
  | 'EvidenceSynthesis';

export const useStrategusStore = defineStore('strategus', () => {
  // ── Active panel ──────────────────────────────────────────────────────────
  const activePanel = ref<SidebarItem>('overview');

  // ── Study metadata ────────────────────────────────────────────────────────
  const studyType = ref<StudyTypeId | null>(null);
  const studyName = ref<string>('');
  const description = ref<string>('');
  const studyStartDate = ref<string | null>(null);
  const studyEndDate = ref<string | null>(null);

  // ── Study design ──────────────────────────────────────────────────────────
  const cohorts = ref<CohortEntry[]>([]);
  const comparisons = ref<TciDefinition[]>([]);
  const outcomes = ref<OutcomeEntry[]>([]);
  const negativeControls = ref<NegativeControlEntry[]>([]);
  const ncDetectOnDescendants = ref<boolean>(true);
  const ncOccurrenceType = ref<'first' | 'all'>('first');
  const timeAtRisk = ref<TimeAtRiskWindow[]>([createDefaultTimeAtRisk()]);
  const sccsTimeAtRiskOverride = ref<TimeAtRiskWindow[] | null>(null);
  const plpTimeAtRiskOverride = ref<TimeAtRiskWindow[]>([createDefaultPlpTimeAtRisk()]);
  // Per-CohortIncidence TAR windows (separate from global timeAtRisk)
  const cohortIncidenceTars = ref<TimeAtRiskWindow[]>([createDefaultTimeAtRisk()]);
  // CI analysis-list entries — each maps target cohorts × outcomes × TARs
  const cohortIncidenceAnalyses = ref<CohortIncidenceAnalysis[]>([]);
  const cohortSubsetDefinitions = ref<CohortSubsetDefinition[]>([]);
  const cohortSubsetAssignments = ref<CohortSubsetAssignment[]>([]);
  // ── Enabled modules ───────────────────────────────────────────────────────
  const enabledModules = ref<Record<ModuleName, boolean>>({
    CohortDiagnostics: true,
    Characterization: true,
    CohortIncidence: true,
    CohortMethod: true,
    SCCS: true,
    PLP: false,
    PLPValidation: false,
    TreatmentPatterns: false,
    EvidenceSynthesis: false,
  });

  // ── Per-module settings ───────────────────────────────────────────────────
  const cohortDiagnosticsSettings = ref<CohortDiagnosticsSettings>(createDefaultCohortDiagnostics());
  const characterizationSettings = ref<CharacterizationSettings>(createDefaultCharacterization());
  const cohortIncidenceSettings = ref<CohortIncidenceSettings>(createDefaultCohortIncidence());
  const cohortMethodSettings = ref<CohortMethodSettings>(createDefaultCohortMethod());
  const sccsSettings = ref<SccsSettings>(createDefaultSccs());
  const plpSettings = ref<PlpSettings>(createDefaultPlp());
  const plpValidationSettings = ref<PlpValidationSettings>(createDefaultPlpValidation());
  const treatmentPatternsSettings = ref<TreatmentPatternsSettings>(createDefaultTreatmentPatterns());
  const evidenceSynthesisSettings = ref<EvidenceSynthesisSettings>(createDefaultEvidenceSynthesis());
  const moduleRawSettings = ref<Record<string, Record<string, unknown>>>({});
  // Module-level provenance captured at import time (version/remoteRepo/remoteUsername),
  // keyed by LONG module name. These live alongside `settings` in the module spec,
  // not inside it, and are re-emitted by the serializer so they survive round-trip.
  const moduleRawProvenance = ref<Record<string, Record<string, unknown>>>({});

  // ── Computed ──────────────────────────────────────────────────────────────
  const cohortsByRole = computed(() => (role: CohortRole) =>
    cohorts.value.filter((c) => c.role === role)
  );

  // ── Methods ───────────────────────────────────────────────────────────────
  function isModuleEnabled(name: ModuleName): boolean {
    return enabledModules.value[name] ?? false;
  }

  function toggleModule(name: ModuleName): void {
    enabledModules.value[name] = !enabledModules.value[name];
  }

  function resetToDefaults(): void {
    activePanel.value = 'overview';

    studyType.value = null;
    studyName.value = '';
    description.value = '';
    studyStartDate.value = null;
    studyEndDate.value = null;

    cohorts.value = [];
    comparisons.value = [];
    outcomes.value = [];
    negativeControls.value = [];
    ncDetectOnDescendants.value = true;
    ncOccurrenceType.value = 'first';
    timeAtRisk.value = [createDefaultTimeAtRisk()];
    sccsTimeAtRiskOverride.value = null;
    plpTimeAtRiskOverride.value = [createDefaultPlpTimeAtRisk()];
    cohortIncidenceTars.value = [createDefaultTimeAtRisk()];
    cohortIncidenceAnalyses.value = [];
    cohortSubsetDefinitions.value = [];
    cohortSubsetAssignments.value = [];

    enabledModules.value = {
      CohortDiagnostics: true,
      Characterization: true,
      CohortIncidence: true,
      CohortMethod: true,
      SCCS: true,
      PLP: false,
      PLPValidation: false,
      TreatmentPatterns: false,
      EvidenceSynthesis: false,
    };

    cohortDiagnosticsSettings.value = createDefaultCohortDiagnostics();
    characterizationSettings.value = createDefaultCharacterization();
    cohortIncidenceSettings.value = createDefaultCohortIncidence();
    cohortMethodSettings.value = createDefaultCohortMethod();
    sccsSettings.value = createDefaultSccs();
    plpSettings.value = createDefaultPlp();
    plpValidationSettings.value = createDefaultPlpValidation();
    treatmentPatternsSettings.value = createDefaultTreatmentPatterns();
    evidenceSynthesisSettings.value = createDefaultEvidenceSynthesis();
    moduleRawSettings.value = {};
    moduleRawProvenance.value = {};
  }

  return {
    // State
    activePanel,
    studyType,
    studyName,
    description,
    studyStartDate,
    studyEndDate,
    cohorts,
    comparisons,
    outcomes,
    negativeControls,
    ncDetectOnDescendants,
    ncOccurrenceType,
    timeAtRisk,
    sccsTimeAtRiskOverride,
    plpTimeAtRiskOverride,
    cohortIncidenceTars,
    cohortIncidenceAnalyses,
    cohortSubsetDefinitions,
    cohortSubsetAssignments,
    enabledModules,
    cohortDiagnosticsSettings,
    characterizationSettings,
    cohortIncidenceSettings,
    cohortMethodSettings,
    sccsSettings,
    plpSettings,
    plpValidationSettings,
    treatmentPatternsSettings,
    evidenceSynthesisSettings,
    moduleRawSettings,
    moduleRawProvenance,
    // Computed
    cohortsByRole,
    // Methods
    isModuleEnabled,
    toggleModule,
    resetToDefaults,
    snapshot,
    restore,
  };

  /**
   * Capture the full store state as a plain JSON-safe object.
   * Used by the studies store to persist a draft to localStorage.
   */
  function snapshot(): Record<string, unknown> {
    return JSON.parse(JSON.stringify({
      studyType: studyType.value,
      studyName: studyName.value,
      description: description.value,
      studyStartDate: studyStartDate.value,
      studyEndDate: studyEndDate.value,
      cohorts: cohorts.value,
      comparisons: comparisons.value,
      outcomes: outcomes.value,
      negativeControls: negativeControls.value,
      ncDetectOnDescendants: ncDetectOnDescendants.value,
      ncOccurrenceType: ncOccurrenceType.value,
      timeAtRisk: timeAtRisk.value,
      sccsTimeAtRiskOverride: sccsTimeAtRiskOverride.value,
      plpTimeAtRiskOverride: plpTimeAtRiskOverride.value,
      cohortIncidenceTars: cohortIncidenceTars.value,
      cohortIncidenceAnalyses: cohortIncidenceAnalyses.value,
      cohortSubsetDefinitions: cohortSubsetDefinitions.value,
      cohortSubsetAssignments: cohortSubsetAssignments.value,
      enabledModules: enabledModules.value,
      cohortDiagnosticsSettings: cohortDiagnosticsSettings.value,
      characterizationSettings: characterizationSettings.value,
      cohortIncidenceSettings: cohortIncidenceSettings.value,
      cohortMethodSettings: cohortMethodSettings.value,
      sccsSettings: sccsSettings.value,
      plpSettings: plpSettings.value,
      plpValidationSettings: plpValidationSettings.value,
      treatmentPatternsSettings: treatmentPatternsSettings.value,
      evidenceSynthesisSettings: evidenceSynthesisSettings.value,
      moduleRawSettings: moduleRawSettings.value,
      moduleRawProvenance: moduleRawProvenance.value,
    }));
  }

  /**
   * Restore a snapshot produced by snapshot(). Resets to defaults first
   * so any missing fields fall back to defaults rather than carrying over
   * from the previously-edited study.
   *
   * Backward compatibility: if the snapshot has a single object (not array)
   * for timeAtRisk / plpTimeAtRiskOverride, wrap it in an array.
   */
  function restore(snap: Record<string, unknown>): void {
    resetToDefaults();
    studyType.value = (snap.studyType as StudyTypeId | null) ?? null;
    if (typeof snap.studyName === 'string') studyName.value = snap.studyName;
    if (typeof snap.description === 'string') description.value = snap.description;
    if (snap.studyStartDate === null || typeof snap.studyStartDate === 'string') studyStartDate.value = snap.studyStartDate as string | null;
    if (snap.studyEndDate === null || typeof snap.studyEndDate === 'string') studyEndDate.value = snap.studyEndDate as string | null;
    if (Array.isArray(snap.cohorts)) cohorts.value = snap.cohorts as never;
    if (Array.isArray(snap.comparisons)) comparisons.value = snap.comparisons as never;
    if (Array.isArray(snap.outcomes)) outcomes.value = snap.outcomes as never;
    if (Array.isArray(snap.negativeControls)) negativeControls.value = snap.negativeControls as never;
    if (typeof snap.ncDetectOnDescendants === 'boolean') ncDetectOnDescendants.value = snap.ncDetectOnDescendants;
    if (snap.ncOccurrenceType === 'first' || snap.ncOccurrenceType === 'all') ncOccurrenceType.value = snap.ncOccurrenceType;
    if (snap.timeAtRisk) {
      // backward compat: single object → wrap in array
      timeAtRisk.value = Array.isArray(snap.timeAtRisk)
        ? snap.timeAtRisk as never
        : [snap.timeAtRisk as never];
    }
    if (snap.sccsTimeAtRiskOverride !== undefined) {
      if (snap.sccsTimeAtRiskOverride === null) {
        sccsTimeAtRiskOverride.value = null;
      } else {
        sccsTimeAtRiskOverride.value = Array.isArray(snap.sccsTimeAtRiskOverride)
          ? snap.sccsTimeAtRiskOverride as never
          : [snap.sccsTimeAtRiskOverride as never];
      }
    }
    if (snap.plpTimeAtRiskOverride) {
      plpTimeAtRiskOverride.value = Array.isArray(snap.plpTimeAtRiskOverride)
        ? snap.plpTimeAtRiskOverride as never
        : [snap.plpTimeAtRiskOverride as never];
    }
    if (snap.cohortIncidenceTars) {
      cohortIncidenceTars.value = Array.isArray(snap.cohortIncidenceTars)
        ? snap.cohortIncidenceTars as never
        : [snap.cohortIncidenceTars as never];
    }
    if (Array.isArray(snap.cohortIncidenceAnalyses)) cohortIncidenceAnalyses.value = snap.cohortIncidenceAnalyses as never;
    if (Array.isArray(snap.cohortSubsetDefinitions)) cohortSubsetDefinitions.value = snap.cohortSubsetDefinitions as never;
    if (Array.isArray(snap.cohortSubsetAssignments)) cohortSubsetAssignments.value = snap.cohortSubsetAssignments as never;
    if (snap.enabledModules && typeof snap.enabledModules === 'object') {
      enabledModules.value = { ...enabledModules.value, ...(snap.enabledModules as Record<string, boolean>) };
    }
    if (snap.cohortDiagnosticsSettings) cohortDiagnosticsSettings.value = { ...cohortDiagnosticsSettings.value, ...(snap.cohortDiagnosticsSettings as object) };
    if (snap.characterizationSettings) characterizationSettings.value = { ...characterizationSettings.value, ...(snap.characterizationSettings as object) };
    if (snap.cohortIncidenceSettings) cohortIncidenceSettings.value = { ...cohortIncidenceSettings.value, ...(snap.cohortIncidenceSettings as object) };
    if (snap.cohortMethodSettings) cohortMethodSettings.value = { ...cohortMethodSettings.value, ...(snap.cohortMethodSettings as object) };
    if (snap.sccsSettings) sccsSettings.value = { ...sccsSettings.value, ...(snap.sccsSettings as object) };
    if (snap.plpSettings) plpSettings.value = { ...plpSettings.value, ...(snap.plpSettings as object) };
    if (snap.plpValidationSettings) plpValidationSettings.value = { ...plpValidationSettings.value, ...(snap.plpValidationSettings as object) };
    if (snap.treatmentPatternsSettings) treatmentPatternsSettings.value = { ...treatmentPatternsSettings.value, ...(snap.treatmentPatternsSettings as object) };
    if (snap.evidenceSynthesisSettings) evidenceSynthesisSettings.value = { ...evidenceSynthesisSettings.value, ...(snap.evidenceSynthesisSettings as object) };
    if (snap.moduleRawSettings && typeof snap.moduleRawSettings === 'object') moduleRawSettings.value = snap.moduleRawSettings as never;
    if (snap.moduleRawProvenance && typeof snap.moduleRawProvenance === 'object') moduleRawProvenance.value = snap.moduleRawProvenance as never;
  }
});
