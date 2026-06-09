import type { AnalysisSpecification, SharedResource, ModuleSpecification } from '../models/AnalysisSpec';
import type { CohortEntry, NegativeControlEntry, TciDefinition, CohortIncidenceAnalysis } from '../store/useStrategusStore';
import type { TimeAtRiskWindow } from './DefaultsFactory';
import type {
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
import { readPlpModelType } from './PlpModelDefaults';

// Mapping from LONG JSON names back to SHORT store names
const LONG_TO_SHORT: Record<string, string> = {
  CohortDiagnosticsModule: 'CohortDiagnostics',
  CharacterizationModule: 'Characterization',
  CohortIncidenceModule: 'CohortIncidence',
  CohortMethodModule: 'CohortMethod',
  SelfControlledCaseSeriesModule: 'SCCS',
  PatientLevelPredictionModule: 'PLP',
  PatientLevelPredictionValidationModule: 'PLPValidation',
  TreatmentPatternsModule: 'TreatmentPatterns',
  EvidenceSynthesisModule: 'EvidenceSynthesis',
};

// All known short module names (default to false when not in spec)
const ALL_SHORT_NAMES = [
  'CohortDiagnostics',
  'Characterization',
  'CohortIncidence',
  'CohortMethod',
  'SCCS',
  'PLP',
  'PLPValidation',
  'TreatmentPatterns',
  'EvidenceSynthesis',
] as const;

// Duck-typed store interface for the deserializer
interface StrategusStore {
  resetToDefaults(): void;
  cohorts: CohortEntry[];
  outcomes: Array<{ cohortId: number; cleanWindow: number; outcomeName?: string }>;
  negativeControls: NegativeControlEntry[];
  comparisons: TciDefinition[];
  ncOccurrenceType: 'first' | 'all';
  ncDetectOnDescendants: boolean;
  enabledModules: Record<string, boolean>;
  cohortDiagnosticsSettings: Record<string, unknown>;
  characterizationSettings: Record<string, unknown>;
  cohortIncidenceSettings: {
    byAge: boolean;
    byGender: boolean;
    byYear: boolean;
    ageBreaks: number[];
  };
  cohortIncidenceTars: TimeAtRiskWindow[];
  cohortIncidenceAnalyses: CohortIncidenceAnalysis[];
  cohortMethodSettings: CohortMethodSettings;
  sccsSettings: SccsSettings;
  plpSettings: PlpSettings;
  plpValidationSettings: PlpValidationSettings;
  treatmentPatternsSettings: TreatmentPatternsSettings;
  evidenceSynthesisSettings: EvidenceSynthesisSettings;
  studyStartDate: string | null;
  studyEndDate: string | null;
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
  activePanel: string;
  moduleRawSettings: Record<string, Record<string, unknown>>;
  moduleRawProvenance: Record<string, Record<string, unknown>>;
}

function isCohortDefinitionSharedResources(sr: SharedResource): sr is Extract<SharedResource, { cohortDefinitions: unknown[] }> {
  return Array.isArray((sr as Record<string, unknown>).attr_class) &&
    ((sr as Record<string, unknown>).attr_class as string[]).includes('CohortDefinitionSharedResources');
}

function isNegativeControlSharedResources(sr: SharedResource): sr is Extract<SharedResource, { negativeControlOutcomes: unknown }> {
  return Array.isArray((sr as Record<string, unknown>).attr_class) &&
    ((sr as Record<string, unknown>).attr_class as string[]).includes('NegativeControlOutcomeSharedResources');
}

export function deserializeSpec(spec: AnalysisSpecification, store: StrategusStore): void {
  // Step 1: Reset store to defaults
  store.resetToDefaults();

  // Build a reverse map: subsetCohortId → originalCohortId
  // Used to un-subset TCO targetId/comparatorId when reading comparisons
  const subsetToOriginalId = new Map<number, number>();

  // Step 2: Extract cohort definitions
  for (const sr of spec.sharedResources) {
    if (isCohortDefinitionSharedResources(sr)) {
      const cohortSR = sr as unknown as {
        cohortDefinitions: Array<{ cohortId: number; cohortName: string; cohortDefinition: string }>;
        subsetDefs?: unknown[];
        cohortSubsets?: Array<{ cohortId: number; subsetId: number; targetCohortId: number }>;
      };
      store.cohorts = cohortSR.cohortDefinitions.map((cd) => ({
        cohortId: cd.cohortId,
        cohortName: cd.cohortName,
        cohortDefinition: cd.cohortDefinition,
        role: 'Target' as const, // default role; user can adjust later
        subjectCount: null,
      }));

      // Build reverse map from cohortSubsets: subsetCohortId → original targetCohortId
      if (Array.isArray(cohortSR.cohortSubsets)) {
        for (const cs of cohortSR.cohortSubsets) {
          if (typeof cs.cohortId === 'number' && typeof cs.targetCohortId === 'number') {
            subsetToOriginalId.set(cs.cohortId, cs.targetCohortId);
          }
        }
      }

      // Parse subsetDefs: each entry is a JSON string or a bare object
      if (Array.isArray(cohortSR.subsetDefs)) {
        const userDefs: typeof store.cohortSubsetDefinitions = [];
        for (const raw of cohortSR.subsetDefs) {
          let def: Record<string, unknown>;
          if (typeof raw === 'string') {
            try { def = JSON.parse(raw); } catch { continue; }
          } else {
            def = raw as Record<string, unknown>;
          }
          const defId = typeof def['definitionId'] === 'number' ? def['definitionId'] : 0;
          // Only reconstruct user-defined subsets (id >= 1000); TCI-generated ones are rebuilt from comparisons
          if (defId >= 1000) {
            const ops = (def['subsetOperators'] as Array<Record<string, unknown>> | undefined) ?? [];
            userDefs.push({
              id: defId,
              name: typeof def['name'] === 'string' ? def['name'] : `Subset ${defId}`,
              operators: ops.map((op) => {
                const attrClass = (op['attr_class'] as string[]) ?? [];
                if (attrClass.includes('LimitSubsetOperator')) {
                  return {
                    type: 'LimitSubsetOperator' as const,
                    ...(typeof op['priorTime'] === 'number' ? { priorTime: op['priorTime'] } : {}),
                    ...(typeof op['followUpTime'] === 'number' ? { followUpTime: op['followUpTime'] } : {}),
                    ...(typeof op['limitTo'] === 'string' ? { limitTo: op['limitTo'] } : {}),
                    ...(typeof op['calendarStartDate'] === 'string' ? { calendarStartDate: op['calendarStartDate'] } : {}),
                    ...(typeof op['calendarEndDate'] === 'string' ? { calendarEndDate: op['calendarEndDate'] } : {}),
                  };
                } else if (attrClass.includes('DemographicSubsetOperator')) {
                  return {
                    type: 'DemographicSubsetOperator' as const,
                    ...(typeof op['ageMin'] === 'number' ? { ageMin: op['ageMin'] } : {}),
                    ...(typeof op['ageMax'] === 'number' ? { ageMax: op['ageMax'] } : {}),
                    ...(Array.isArray(op['gender']) ? { gender: op['gender'] as number[] } : {}),
                  };
                } else {
                  return {
                    type: 'CohortSubsetOperator' as const,
                    cohortIds: Array.isArray(op['cohortIds']) ? op['cohortIds'] as number[] : [],
                    negate: typeof op['negate'] === 'boolean' ? op['negate'] : false,
                  };
                }
              }),
            });
          }
        }
        store.cohortSubsetDefinitions = userDefs;

        // Reconstruct cohortSubsetAssignments from cohortSubsets for user-defined subsets
        if (Array.isArray(cohortSR.cohortSubsets)) {
          const assignmentMap = new Map<number, number[]>();
          for (const cs of cohortSR.cohortSubsets) {
            if (cs.subsetId >= 1000) {
              const existing = assignmentMap.get(cs.targetCohortId) ?? [];
              if (!existing.includes(cs.subsetId)) existing.push(cs.subsetId);
              assignmentMap.set(cs.targetCohortId, existing);
            }
          }
          store.cohortSubsetAssignments = Array.from(assignmentMap.entries()).map(([cohortId, subsetIds]) => ({
            cohortId,
            subsetIds,
          }));
        }
      }
    }

    // Step 3: Extract negative controls
    if (isNegativeControlSharedResources(sr)) {
      const ncSR = sr as unknown as {
        negativeControlOutcomes: {
          negativeControlOutcomeCohortSet: Array<Record<string, unknown> & {
            cohortId: number;
            cohortName: string;
            outcomeConceptId: number;
          }>;
          occurrenceType: 'first' | 'all';
          detectOnDescendants: boolean;
        };
      };
      const nc = ncSR.negativeControlOutcomes;
      // Optional concept metadata passthrough keys preserved from real OHDSI specs
      const META_KEYS = [
        'standardConcept', 'standardConceptCaption',
        'invalidReason', 'invalidReasonCaption',
        'conceptCode', 'domainId', 'vocabularyId', 'conceptClassId',
        'validStartDate', 'validEndDate',
      ] as const;
      store.negativeControls = nc.negativeControlOutcomeCohortSet.map((entry) => {
        const base: Record<string, unknown> = {
          cohortId: entry.cohortId,
          cohortName: entry.cohortName,
          outcomeConceptId: entry.outcomeConceptId,
        };
        for (const k of META_KEYS) {
          if (entry[k] !== undefined) base[k] = entry[k];
        }
        return base as NegativeControlEntry;
      });
      store.ncOccurrenceType = nc.occurrenceType;
      store.ncDetectOnDescendants = nc.detectOnDescendants;
    }
  }

  // Step 4: Determine which modules are present → build enabledModules map
  // First disable all non-default modules (resetToDefaults already did this,
  // but we want only the modules present in the spec to be enabled)
  const presentShortNames = new Set<string>();

  for (const modSpec of spec.moduleSpecifications) {
    const shortName = LONG_TO_SHORT[modSpec.module];
    if (shortName) {
      presentShortNames.add(shortName);
    }
    // CohortGeneratorModule is skipped (it's always present, not a toggle)
  }

  // Set enabledModules based on presence in spec
  for (const shortName of ALL_SHORT_NAMES) {
    store.enabledModules[shortName] = presentShortNames.has(shortName);
  }

  // Step 5: Parse module-specific settings
  for (const modSpec of spec.moduleSpecifications) {
    // Capture raw settings verbatim before any structured parsing
    store.moduleRawSettings[modSpec.module] =
      JSON.parse(JSON.stringify(modSpec.settings ?? {}));

    // Capture module-level provenance (everything alongside `settings` except
    // the module name, attr_class, and settings itself) so it survives round-trip.
    const provenance: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(modSpec as unknown as Record<string, unknown>)) {
      if (k === 'module' || k === 'settings' || k === 'attr_class') continue;
      provenance[k] = JSON.parse(JSON.stringify(v));
    }
    if (Object.keys(provenance).length > 0) {
      store.moduleRawProvenance[modSpec.module] = provenance;
    }

    switch (modSpec.module) {
      case 'CohortDiagnosticsModule':
        parseCohortDiagnosticsSettings(modSpec, store);
        break;
      case 'CharacterizationModule':
        parseCharacterizationSettings(modSpec, store);
        break;
      case 'CohortIncidenceModule':
        parseCohortIncidenceSettings(modSpec, store);
        break;
      case 'CohortMethodModule':
        parseCohortMethodSettings(modSpec, store, subsetToOriginalId);
        break;
      case 'SelfControlledCaseSeriesModule':
        parseSccsSettings(modSpec, store);
        break;
      case 'PatientLevelPredictionModule':
        parsePlpSettings(modSpec, store);
        break;
      case 'PatientLevelPredictionValidationModule':
        parsePlpValidationSettings(modSpec, store);
        break;
      case 'TreatmentPatternsModule':
        parseTreatmentPatternsSettings(modSpec, store);
        break;
      case 'EvidenceSynthesisModule':
        parseEvidenceSynthesisSettings(modSpec, store);
        break;
    }
  }

  // Step 6: Infer cohort roles from the derived design. The Strategus spec does
  // not label cohorts by role, so they all default to 'Target' (set above). Now
  // that outcomes and comparisons (TCIs) are parsed, assign Outcome / Comparator
  // / Indication from how each cohort is actually used. Without this, every
  // imported study has only Target-role cohorts, so the design validation
  // spuriously flags "add a cohort with Outcome role" / "add a TCI" on studies
  // that already define them.
  const outcomeIds = new Set<number>(store.outcomes.map((o) => o.cohortId));
  const comparatorIds = new Set<number>();
  const indicationIds = new Set<number>();
  const targetIds = new Set<number>();
  for (const tci of store.comparisons) {
    targetIds.add(tci.targetId);
    comparatorIds.add(tci.comparatorId);
    if (tci.indicationId != null) indicationIds.add(tci.indicationId);
  }
  store.cohorts = store.cohorts.map((c) => {
    let role = c.role;
    if (outcomeIds.has(c.cohortId)) role = 'Outcome';
    else if (comparatorIds.has(c.cohortId)) role = 'Comparator';
    else if (indicationIds.has(c.cohortId)) role = 'Indication';
    else if (targetIds.has(c.cohortId)) role = 'Target';
    return { ...c, role };
  });

  // Step 7: Set active panel to overview
  store.activePanel = 'overview';
}

function parseCohortDiagnosticsSettings(
  modSpec: ModuleSpecification,
  store: StrategusStore
): void {
  const s = modSpec.settings;
  const settings = store.cohortDiagnosticsSettings;

  const boolKeys = [
    'runInclusionStatistics',
    'runIncludedSourceConcepts',
    'runOrphanConcepts',
    'runTimeSeries',
    'runVisitContext',
    'runBreakdownIndexEvents',
    'runIncidenceRate',
    'runCohortRelationship',
    'runTemporalCohortCharacterization',
  ];

  const numKeys = ['minCharacterizationMean', 'irWashoutPeriod'];

  for (const key of boolKeys) {
    if (key in s && typeof s[key] === 'boolean') {
      settings[key] = s[key];
    }
  }

  for (const key of numKeys) {
    if (key in s && typeof s[key] === 'number') {
      settings[key] = s[key];
    }
  }

  // Read cohortIds
  if (Array.isArray(s['cohortIds'])) {
    settings['cohortIds'] = (s['cohortIds'] as unknown[]).filter((n) => typeof n === 'number') as number[];
  }

  const temporalCovariateSettings = s['temporalCovariateSettings'] as Record<string, unknown> | undefined;
  if (temporalCovariateSettings) {
    if (Array.isArray(temporalCovariateSettings['temporalStartDays'])) {
      settings['temporalStartDays'] = (temporalCovariateSettings['temporalStartDays'] as number[]).filter((n) => typeof n === 'number');
    }
    if (Array.isArray(temporalCovariateSettings['temporalEndDays'])) {
      settings['temporalEndDays'] = (temporalCovariateSettings['temporalEndDays'] as number[]).filter((n) => typeof n === 'number');
    }

    // Read temporal covariate feature flags (all boolean keys other than reserved ones)
    const RESERVED_KEYS = new Set(['temporalStartDays', 'temporalEndDays', 'attr_class']);
    const features: Record<string, boolean> = {};
    for (const [key, val] of Object.entries(temporalCovariateSettings)) {
      if (!RESERVED_KEYS.has(key) && typeof val === 'boolean') {
        features[key] = val;
      }
    }
    if (Object.keys(features).length > 0) {
      settings['temporalCovariateFeatures'] = features;
    }
  }
}

function parseCharacterizationSettings(
  modSpec: ModuleSpecification,
  store: StrategusStore
): void {
  const s = modSpec.settings as Record<string, unknown>;
  const settings = store.characterizationSettings;

  // New schema: nested analysis object with sub-arrays gating the include* booleans
  const analysis = s['analysis'] as Record<string, unknown> | undefined;
  if (analysis) {
    const aggregateCovariateSettings = analysis['aggregateCovariateSettings'] as unknown[] | undefined;
    const timeToEventSettings = analysis['timeToEventSettings'] as unknown[] | undefined;
    const dechallengeRechallengeSettings = analysis['dechallengeRechallengeSettings'] as unknown[] | undefined;

    // Detect include* booleans from array lengths.
    // aggregateCovariateSettings can hold entries for targetBaseline (outcomeIds=[]) and/or riskFactors/caseSeries (outcomeIds.length>0)
    if (Array.isArray(aggregateCovariateSettings) && aggregateCovariateSettings.length > 0) {
      const hasTargetBaseline = (aggregateCovariateSettings as Array<Record<string, unknown>>).some(
        (e) => Array.isArray(e['outcomeIds']) && (e['outcomeIds'] as unknown[]).length === 0
      );
      const hasOutcomeLinked = (aggregateCovariateSettings as Array<Record<string, unknown>>).some(
        (e) => Array.isArray(e['outcomeIds']) && (e['outcomeIds'] as unknown[]).length > 0
      );
      settings['includeTargetBaseline'] = hasTargetBaseline;
      // Can't distinguish riskFactors vs caseSeries from entries alone — if 2+ outcome-linked entries present, both are on
      const outcomeLinkedCount = (aggregateCovariateSettings as Array<Record<string, unknown>>).filter(
        (e) => Array.isArray(e['outcomeIds']) && (e['outcomeIds'] as unknown[]).length > 0
      ).length;
      settings['includeRiskFactors'] = hasOutcomeLinked;
      settings['includeCaseSeries'] = outcomeLinkedCount >= 2;
    } else {
      settings['includeTargetBaseline'] = false;
      settings['includeRiskFactors'] = false;
      settings['includeCaseSeries'] = false;
    }

    settings['includeTimeToEvent'] = Array.isArray(timeToEventSettings) && timeToEventSettings.length > 0;
    settings['includeDechallengeRechallenge'] = Array.isArray(dechallengeRechallengeSettings) && dechallengeRechallengeSettings.length > 0;

    // Read dechallenge numeric fields from first DR entry
    if (Array.isArray(dechallengeRechallengeSettings) && dechallengeRechallengeSettings.length > 0) {
      const drEntry = dechallengeRechallengeSettings[0] as Record<string, unknown>;
      if (typeof drEntry['dechallengeStopInterval'] === 'number') settings['dechallengeStopInterval'] = drEntry['dechallengeStopInterval'];
      if (typeof drEntry['dechallengeEvaluationWindow'] === 'number') settings['dechallengeEvaluationWindow'] = drEntry['dechallengeEvaluationWindow'];
    }
  } else {
    // Legacy flat schema fallback
    const boolKeys = [
      'includeTimeToEvent',
      'includeDechallengeRechallenge',
      'includeTargetBaseline',
      'includeRiskFactors',
      'includeCaseSeries',
    ];
    for (const key of boolKeys) {
      if (key in s && typeof s[key] === 'boolean') {
        settings[key] = s[key];
      }
    }

    const numKeys = [
      'minCharacterizationMean',
      'minPriorObservation',
      'dechallengeStopInterval',
      'dechallengeEvaluationWindow',
      'casePreTargetDuration',
      'casePostOutcomeDuration',
    ];
    for (const key of numKeys) {
      if (key in s && typeof s[key] === 'number') {
        settings[key] = s[key];
      }
    }
  }

  // Read top-level numeric scalars (present in both schemas)
  if (typeof s['minCharacterizationMean'] === 'number') settings['minCharacterizationMean'] = s['minCharacterizationMean'];
}

function yyyymmddToIso(yyyymmdd: string): string | null {
  if (!yyyymmdd) return null;
  if (yyyymmdd.length !== 8) return yyyymmdd;
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

/** Map CohortIncidence dateField ('start' | 'end') back to store anchor string */
function dateFieldToAnchor(dateField: string): 'cohort start' | 'cohort end' {
  return dateField === 'end' ? 'cohort end' : 'cohort start';
}

function parseCohortIncidenceSettings(
  modSpec: ModuleSpecification,
  store: StrategusStore
): void {
  const s = modSpec.settings as Record<string, unknown>;
  const ci = store.cohortIncidenceSettings;
  const irDesign = s['irDesign'] as Record<string, unknown> | undefined;
  if (!irDesign) return;

  // Extract outcomes from outcomeDefs (only if not already set by CohortMethod parser).
  // Also preserve outcomeName for cohorts not in store.cohorts.
  const outcomeDefs = irDesign['outcomeDefs'] as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(outcomeDefs)) {
    if (store.outcomes.length === 0) {
      // Populate outcomes from CI outcomeDefs
      const seen = new Set<number>();
      const ooi: Array<{ cohortId: number; cleanWindow: number; outcomeName?: string }> = [];
      for (const od of outcomeDefs) {
        const id = od['cohortId'];
        if (typeof id !== 'number' || seen.has(id)) continue;
        seen.add(id);
        const cw = od['cleanWindow'];
        const nameVal = od['name'];
        ooi.push({
          cohortId: id,
          cleanWindow: typeof cw === 'number' ? cw : 9999,
          ...(typeof nameVal === 'string' ? { outcomeName: nameVal } : {}),
        });
      }
      store.outcomes = ooi;
    } else {
      // Outcomes already set (e.g. by CohortMethod parser) — enrich with names from CI outcomeDefs
      const nameById = new Map<number, string>();
      for (const od of outcomeDefs) {
        const id = od['cohortId'];
        const name = od['name'];
        if (typeof id === 'number' && typeof name === 'string') {
          nameById.set(id, name);
        }
      }
      for (const o of store.outcomes) {
        if (!o.outcomeName && nameById.has(o.cohortId)) {
          o.outcomeName = nameById.get(o.cohortId);
        }
      }
    }
  }

  // Read timeAtRiskDefs into cohortIncidenceTars
  const timeAtRiskDefs = irDesign['timeAtRiskDefs'] as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(timeAtRiskDefs) && timeAtRiskDefs.length > 0) {
    store.cohortIncidenceTars = timeAtRiskDefs.map((tar) => {
      const startDef = tar['start'] as Record<string, unknown> | undefined;
      const endDef = tar['end'] as Record<string, unknown> | undefined;
      return {
        label: typeof tar['label'] === 'string' ? tar['label'] : `TAR ${tar['id']}`,
        riskWindowStart: startDef && typeof startDef['offset'] === 'number' ? startDef['offset'] : 0,
        startAnchor: startDef ? dateFieldToAnchor(String(startDef['dateField'] ?? 'start')) : 'cohort start',
        riskWindowEnd: endDef && typeof endDef['offset'] === 'number' ? endDef['offset'] : 0,
        endAnchor: endDef ? dateFieldToAnchor(String(endDef['dateField'] ?? 'end')) : 'cohort end',
      } as TimeAtRiskWindow;
    });
  }

  // Read analysisList into cohortIncidenceAnalyses
  // analysisList entries may use scalar or array for targets/outcomes/tars
  const analysisList = irDesign['analysisList'] as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(analysisList) && analysisList.length > 0) {
    store.cohortIncidenceAnalyses = analysisList.map((a) => {
      const toArray = (v: unknown): number[] => {
        if (Array.isArray(v)) return v.filter((x) => typeof x === 'number') as number[];
        if (typeof v === 'number') return [v];
        return [];
      };
      return {
        targets: toArray(a['targets']),
        outcomes: toArray(a['outcomes']),
        tars: toArray(a['tars']),
      } as CohortIncidenceAnalysis;
    });
  }

  const strataSettings = irDesign['strataSettings'] as Record<string, unknown> | undefined;
  if (strataSettings) {
    if (typeof strataSettings['byAge'] === 'boolean') ci.byAge = strataSettings['byAge'];
    if (typeof strataSettings['byGender'] === 'boolean') ci.byGender = strataSettings['byGender'];
    if (typeof strataSettings['byYear'] === 'boolean') ci.byYear = strataSettings['byYear'];
    if (Array.isArray(strataSettings['ageBreaks'])) {
      ci.ageBreaks = (strataSettings['ageBreaks'] as unknown[]).filter((n) => typeof n === 'number') as number[];
    }
  }

  // Parse studyWindow back to store dates
  const studyWindow = irDesign['studyWindow'] as Record<string, unknown> | undefined;
  if (studyWindow) {
    if (typeof studyWindow['startDate'] === 'string') {
      store.studyStartDate = yyyymmddToIso(studyWindow['startDate']);
    }
    if (typeof studyWindow['endDate'] === 'string') {
      store.studyEndDate = yyyymmddToIso(studyWindow['endDate']);
    }
  }
}

/**
 * Detect PS adjustment method from cmAnalysis entry.
 * Returns the method and associated parameter values.
 */
function detectPsAdjustmentMethod(analysis: Record<string, unknown>): {
  psAdjustmentMethod: CohortMethodAnalysis['psAdjustmentMethod'];
  psMatchMaxRatio: number;
  psStrataCount: number;
  iptwTruncationFraction: number;
} {
  const matchArgs = analysis['matchOnPsArgs'] as Record<string, unknown> | null | undefined;
  const stratArgs = analysis['stratifyByPsArgs'] as Record<string, unknown> | null | undefined;
  const iptwArgs = analysis['truncateIptwArgs'] as Record<string, unknown> | null | undefined;
  const trimArgs = analysis['trimByPsArgs'] as Record<string, unknown> | null | undefined;

  if (matchArgs && typeof matchArgs === 'object') {
    return {
      psAdjustmentMethod: 'matching',
      psMatchMaxRatio: typeof matchArgs['maxRatio'] === 'number' ? matchArgs['maxRatio'] : 1,
      psStrataCount: 5,
      iptwTruncationFraction: 0.99,
    };
  }
  if (stratArgs && typeof stratArgs === 'object') {
    return {
      psAdjustmentMethod: 'stratification',
      psMatchMaxRatio: 1,
      psStrataCount: typeof stratArgs['numberOfStrata'] === 'number' ? stratArgs['numberOfStrata'] : 5,
      iptwTruncationFraction: 0.99,
    };
  }
  if (iptwArgs && typeof iptwArgs === 'object') {
    return {
      psAdjustmentMethod: 'iptw',
      psMatchMaxRatio: 1,
      psStrataCount: 5,
      iptwTruncationFraction: typeof iptwArgs['upperLimit'] === 'number' ? iptwArgs['upperLimit'] : 0.99,
    };
  }
  if (trimArgs !== undefined && trimArgs !== null) {
    return {
      psAdjustmentMethod: 'trimming',
      psMatchMaxRatio: 1,
      psStrataCount: 5,
      iptwTruncationFraction: 0.99,
    };
  }
  return {
    psAdjustmentMethod: 'none',
    psMatchMaxRatio: 1,
    psStrataCount: 5,
    iptwTruncationFraction: 0.99,
  };
}

function parseCohortMethodSettings(
  modSpec: ModuleSpecification,
  store: StrategusStore,
  subsetToOriginalId: Map<number, number> = new Map()
): void {
  const s = modSpec.settings as Record<string, unknown>;
  const cms = store.cohortMethodSettings;

  // Support both flat (new) and wrapped (legacy) schema
  const flat = s;
  const legacy = s['cmAnalysesSpecifications'] as Record<string, unknown> | undefined;
  const src = legacy ?? flat;

  // Extract TCO list to rebuild comparisons
  const tcoList = src['targetComparatorOutcomesList'] as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(tcoList)) {
    store.comparisons = tcoList.map((tco) => {
      const rawTargetId = tco['targetId'] as number;
      const rawComparatorId = tco['comparatorId'] as number;
      // Reverse-map subset cohort IDs back to original cohort IDs using the cohortSubsets map
      const targetId = subsetToOriginalId.get(rawTargetId) ?? rawTargetId;
      const comparatorId = subsetToOriginalId.get(rawComparatorId) ?? rawComparatorId;
      return {
        targetId,
        comparatorId,
        indicationId: null,
        genderConceptIds: [],
        minAge: null,
        maxAge: null,
        excludedCovariateConceptIds: (tco['excludedCovariateConceptIds'] as number[]) ?? [],
      };
    });

    // Extract outcomes-of-interest from the first TCO's outcomes list (typically uniform across TCOs).
    // Outcomes with outcomeOfInterest=true become tracked study outcomes; trueEffectSize=1 are NC and skipped.
    if (tcoList.length > 0 && store.outcomes.length === 0) {
      const seen = new Set<number>();
      const ooi: Array<{ cohortId: number; cleanWindow: number }> = [];
      for (const tco of tcoList) {
        const outs = tco['outcomes'] as Array<Record<string, unknown>> | undefined;
        if (!Array.isArray(outs)) continue;
        for (const o of outs) {
          if (o['outcomeOfInterest'] === false || o['trueEffectSize'] === 1) continue;
          const id = o['outcomeId'];
          if (typeof id !== 'number' || seen.has(id)) continue;
          seen.add(id);
          const pol = o['priorOutcomeLookback'];
          ooi.push({ cohortId: id, cleanWindow: typeof pol === 'number' ? pol : 9999 });
        }
      }
      store.outcomes = ooi;
    }
  }

  // Extract settings from cmAnalysisList.
  // Strategy: group entries by unique (psAdjustmentMethod, outcomeModelType, description-prefix)
  // and reconstruct one CohortMethodAnalysis per unique combination.
  // Limitation: if the spec was not generated by us, the grouping is a best-effort approximation.
  const analysisList = src['cmAnalysisList'] as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(analysisList) || analysisList.length === 0) return;

  // Extract shared settings from first entry
  const firstEntry = analysisList[0];
  const getDbArgs = firstEntry['getDbCohortMethodDataArgs'] as Record<string, unknown> | undefined;
  if (getDbArgs) {
    if (typeof getDbArgs['firstExposureOnly'] === 'boolean') cms.firstExposureOnly = getDbArgs['firstExposureOnly'];
    if (typeof getDbArgs['restrictToCommonPeriod'] === 'boolean') cms.restrictToCommonPeriod = getDbArgs['restrictToCommonPeriod'];
    // Dates are stored as YYYYMMDD strings — convert back to ISO
    if (typeof getDbArgs['studyStartDate'] === 'string' && getDbArgs['studyStartDate']) {
      store.studyStartDate = yyyymmddToIso(getDbArgs['studyStartDate']);
    }
    if (typeof getDbArgs['studyEndDate'] === 'string' && getDbArgs['studyEndDate']) {
      store.studyEndDate = yyyymmddToIso(getDbArgs['studyEndDate']);
    }
  }

  const createPsArgs = firstEntry['createPsArgs'] as Record<string, unknown> | undefined;
  if (createPsArgs && typeof createPsArgs['maxCohortSizeForFitting'] === 'number') {
    cms.maxCohortSizeForFitting = createPsArgs['maxCohortSizeForFitting'];
  }

  const covBalanceArgs = firstEntry['computeCovariateBalanceArgs'] as Record<string, unknown> | undefined;
  if (covBalanceArgs && typeof covBalanceArgs['maxCohortSize'] === 'number') {
    cms.maxCovBalanceCohortSize = covBalanceArgs['maxCohortSize'];
  }

  // Reconstruct analyses: deduplicate by (psAdjustmentMethod fingerprint + outcomeModelType)
  // Pragmatic approach: take the first entry for each unique combination
  type AnalysisKey = string;
  const seen = new Map<AnalysisKey, CohortMethodAnalysis>();
  let nextAnalysisId = 1;

  for (const entry of analysisList) {
    const psInfo = detectPsAdjustmentMethod(entry);
    const fitArgs = entry['fitOutcomeModelArgs'] as Record<string, unknown> | undefined;
    const modelType: CohortMethodAnalysis['outcomeModelType'] =
      fitArgs && typeof fitArgs['modelType'] === 'string' && ['cox', 'logistic', 'poisson'].includes(fitArgs['modelType'])
        ? fitArgs['modelType'] as CohortMethodAnalysis['outcomeModelType']
        : 'cox';

    const key: AnalysisKey = `${psInfo.psAdjustmentMethod}|${psInfo.psMatchMaxRatio}|${psInfo.psStrataCount}|${psInfo.iptwTruncationFraction}|${modelType}`;
    if (!seen.has(key)) {
      const rawDesc = typeof entry['description'] === 'string' ? entry['description'] : '';
      // Strip TAR label suffix if present (", Label")
      const desc = rawDesc.replace(/,\s+[^,]+$/, '') || rawDesc;

      const entryDbArgs = entry['getDbCohortMethodDataArgs'] as Record<string, unknown> | undefined;
      const useCleanWindow = entryDbArgs ? (typeof entryDbArgs['useCleanWindowForPriorOutcomeLookback'] === 'boolean' ? entryDbArgs['useCleanWindowForPriorOutcomeLookback'] : false) : false;

      // Read per-analysis study-population window from createStudyPopArgs
      const studyPopArgs = entry['createStudyPopArgs'] as Record<string, unknown> | undefined;
      const num = (v: unknown, d: number) => (typeof v === 'number' ? v : d);
      const anchor = (v: unknown, d: 'cohort start' | 'cohort end') =>
        v === 'cohort start' || v === 'cohort end' ? v : d;

      seen.set(key, {
        analysisId: nextAnalysisId++,
        description: desc,
        psAdjustmentMethod: psInfo.psAdjustmentMethod,
        psMatchMaxRatio: psInfo.psMatchMaxRatio,
        psStrataCount: psInfo.psStrataCount,
        iptwTruncationFraction: psInfo.iptwTruncationFraction,
        outcomeModelType: modelType,
        useCleanWindowForPriorOutcomeLookback: useCleanWindow,
        riskWindowStart: num(studyPopArgs?.['riskWindowStart'], 0),
        startAnchor: anchor(studyPopArgs?.['startAnchor'], 'cohort start'),
        riskWindowEnd: num(studyPopArgs?.['riskWindowEnd'], 0),
        endAnchor: anchor(studyPopArgs?.['endAnchor'], 'cohort end'),
        minDaysAtRisk: num(studyPopArgs?.['minDaysAtRisk'], 1),
        priorOutcomeLookback: num(studyPopArgs?.['priorOutcomeLookback'], 99999),
      });
    }
  }

  cms.analyses = Array.from(seen.values());

  // Read covariate features and windows back from first analysis entry
  if (getDbArgs) {
    const covSettings = getDbArgs['covariateSettings'] as Record<string, boolean & unknown> | undefined;
    if (covSettings && typeof covSettings === 'object') {
      // Feature flags are boolean keys in the covariateSettings object
      const featureKeys = Object.keys(cms.covariateFeatures);
      for (const flag of featureKeys) {
        if (flag in covSettings && typeof covSettings[flag] === 'boolean') {
          cms.covariateFeatures[flag] = covSettings[flag] as boolean;
        }
      }
      // Windows
      if (typeof covSettings['longTermStartDays'] === 'number') {
        cms.covariateWindows.longTermStartDays = covSettings['longTermStartDays'] as number;
      }
      if (typeof covSettings['shortTermStartDays'] === 'number') {
        cms.covariateWindows.shortTermStartDays = covSettings['shortTermStartDays'] as number;
      }
      if (typeof covSettings['endDays'] === 'number') {
        cms.covariateWindows.endDays = covSettings['endDays'] as number;
      }
    }
  }
}

function parseSccsAnalysis(entry: Record<string, unknown>, analysisId: number): SccsAnalysis {
  const createIntervalDataArgs = entry['createIntervalDataArgs'] as Record<string, unknown> | undefined;
  let eraWindows: SccsEraWindow[] = [];
  let includeCalendarTime = false;
  let calendarTimeKnots = 5;
  let includeSeasonality = false;
  let seasonalityKnots = 5;
  let includeAgeEffect = false;

  if (createIntervalDataArgs) {
    const eraCovariateSettings = createIntervalDataArgs['eraCovariateSettings'] as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(eraCovariateSettings) && eraCovariateSettings.length > 0) {
      eraWindows = eraCovariateSettings.map((e): SccsEraWindow => ({
        label: typeof e['label'] === 'string' ? e['label'] : '',
        start: typeof e['start'] === 'number' ? e['start'] : 0,
        end: typeof e['end'] === 'number' ? e['end'] : 0,
        startAnchor: (e['startAnchor'] === 'era end' ? 'era end' : 'era start') as 'era start' | 'era end',
        endAnchor: (e['endAnchor'] === 'era end' ? 'era end' : 'era start') as 'era start' | 'era end',
        exposureOfInterest: typeof e['exposureOfInterest'] === 'boolean' ? e['exposureOfInterest'] : false,
        profileLikelihood: typeof e['profileLikelihood'] === 'boolean' ? e['profileLikelihood'] : false,
      }));
    }

    const calendarArgs = createIntervalDataArgs['calendarTimeCovariateSettings'] as Record<string, unknown> | undefined;
    includeCalendarTime = calendarArgs != null;
    if (calendarArgs && typeof calendarArgs['calendarTimeKnots'] === 'number') {
      calendarTimeKnots = calendarArgs['calendarTimeKnots'];
    }

    const seasonalityArgs = createIntervalDataArgs['seasonalityCovariateSettings'] as Record<string, unknown> | undefined;
    includeSeasonality = seasonalityArgs != null;
    if (seasonalityArgs && typeof seasonalityArgs['seasonKnots'] === 'number') {
      seasonalityKnots = seasonalityArgs['seasonKnots'];
    }

    const ageArgs = createIntervalDataArgs['ageCovariateSettings'] as Record<string, unknown> | undefined;
    includeAgeEffect = ageArgs != null;
  }

  const createStudyPopulationArgs = entry['createStudyPopulationArgs'] as Record<string, unknown> | undefined;
  const naivePeriod = createStudyPopulationArgs && typeof createStudyPopulationArgs['naivePeriod'] === 'number'
    ? createStudyPopulationArgs['naivePeriod']
    : 365;

  return {
    analysisId,
    description: typeof entry['description'] === 'string' ? entry['description'] : `SCCS ${analysisId}`,
    eraWindows,
    naivePeriod,
    calendarTimeKnots,
    seasonalityKnots,
    includeAgeEffect,
    includeSeasonality,
    includeCalendarTime,
  };
}

function parseSccsSettings(
  modSpec: ModuleSpecification,
  store: StrategusStore
): void {
  const s = modSpec.settings as Record<string, unknown>;
  const sccs = store.sccsSettings;

  // Support both flat (new) and wrapped (legacy) schema
  const legacy = s['sccsAnalysesSpecifications'] as Record<string, unknown> | undefined;
  const src = legacy ?? s;

  const analysisList = src['sccsAnalysisList'] as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(analysisList) || analysisList.length === 0) return;

  // Extract shared settings from first entry
  const firstEntry = analysisList[0];
  const getDbArgs = firstEntry['getDbSccsDataArgs'] as Record<string, unknown> | undefined;
  if (getDbArgs) {
    if (typeof getDbArgs['maxCasesPerOutcome'] === 'number') {
      sccs.maxCasesPerOutcome = getDbArgs['maxCasesPerOutcome'];
    }
    // Dates are stored as YYYYMMDD strings — convert back to ISO
    // Accept both legacy plural and current singular field names
    const startKey = typeof getDbArgs['studyStartDate'] === 'string' ? 'studyStartDate' : 'studyStartDates';
    const endKey = typeof getDbArgs['studyEndDate'] === 'string' ? 'studyEndDate' : 'studyEndDates';
    if (typeof getDbArgs[startKey] === 'string' && getDbArgs[startKey]) {
      store.studyStartDate = yyyymmddToIso(getDbArgs[startKey] as string);
    }
    if (typeof getDbArgs[endKey] === 'string' && getDbArgs[endKey]) {
      store.studyEndDate = yyyymmddToIso(getDbArgs[endKey] as string);
    }
    // Read nestingCohortId and propagate to comparisons as indicationId
    if (typeof getDbArgs['nestingCohortId'] === 'number') {
      const nestingId = getDbArgs['nestingCohortId'] as number;
      store.comparisons = store.comparisons.map((tci) => ({
        ...tci,
        indicationId: tci.indicationId ?? nestingId,
      }));
    }
  }

  // Reconstruct analyses[] from sccsAnalysisList
  sccs.analyses = analysisList.map((entry, idx) => parseSccsAnalysis(entry, idx + 1));

  // Detect empirical calibration from the exposures list: if NC outcomes are present (trueEffectSize = 1), calibration is on
  const exposuresOutcomeList = src['exposuresOutcomeList'] as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(exposuresOutcomeList)) {
    const hasNcEntries = exposuresOutcomeList.some((e) => {
      const exposures = e['exposures'] as Array<Record<string, unknown>> | undefined;
      return Array.isArray(exposures) && exposures.some((exp) => exp['trueEffectSize'] === 1);
    });
    sccs.useEmpiricalCalibration = hasNcEntries;

    // Extract outcomes from exposuresOutcomeList entries that are NOT NCs (trueEffectSize !== 1)
    if (store.outcomes.length === 0) {
      const seen = new Set<number>();
      const ooi: Array<{ cohortId: number; cleanWindow: number }> = [];
      for (const eo of exposuresOutcomeList) {
        const exposures = eo['exposures'] as Array<Record<string, unknown>> | undefined;
        const isNc = Array.isArray(exposures) && exposures.some((exp) => exp['trueEffectSize'] === 1);
        if (isNc) continue;
        const id = eo['outcomeId'];
        if (typeof id !== 'number' || seen.has(id)) continue;
        seen.add(id);
        ooi.push({ cohortId: id, cleanWindow: 9999 });
      }
      if (ooi.length > 0) store.outcomes = ooi;
    }
  }
}

function parsePlpSettings(
  modSpec: ModuleSpecification,
  store: StrategusStore
): void {
  const s = modSpec.settings as Record<string, unknown>;
  const plp = store.plpSettings;

  const modelDesignList = s['modelDesignList'] as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(modelDesignList) || modelDesignList.length === 0) return;
  const design = modelDesignList[0];

  const modelSettings = design['modelSettings'] as Record<string, unknown> | undefined;
  if (modelSettings) {
    // New shape: param.attr_settings.modelType
    // Old shape (legacy): modelName
    if (typeof modelSettings['modelName'] === 'string') {
      plp.modelType = modelSettings['modelName'] as PlpSettings['modelType'];
    } else {
      plp.modelType = readPlpModelType(modelSettings) as PlpSettings['modelType'];
    }
  }

  const restrictSettings = design['restrictPlpDataSettings'] as Record<string, unknown> | undefined;
  if (restrictSettings) {
    if (typeof restrictSettings['sampleSize'] === 'number') plp.maxSampleSize = restrictSettings['sampleSize'];
    if (typeof restrictSettings['washoutPeriod'] === 'number') plp.washoutPeriod = restrictSettings['washoutPeriod'];
  }

  const populationSettings = design['populationSettings'] as Record<string, unknown> | undefined;
  if (populationSettings) {
    if (typeof populationSettings['removeSubjectsWithPriorOutcome'] === 'boolean') plp.removeSubjectsWithPriorOutcome = populationSettings['removeSubjectsWithPriorOutcome'];
    if (typeof populationSettings['priorOutcomeLookback'] === 'number') plp.priorOutcomeLookback = populationSettings['priorOutcomeLookback'];
    if (typeof populationSettings['requireTimeAtRisk'] === 'boolean') plp.requireTimeAtRisk = populationSettings['requireTimeAtRisk'];
  }

  const covariateSettings = design['covariateSettings'] as Record<string, unknown> | undefined;
  if (covariateSettings) {
    // Map both legacy `use<Name>` keys (older specs) and Strategus-style `<Name>` keys.
    const KEY_MAP: Record<string, keyof PlpSettings> = {
      DemographicsGender: 'useDemographicsGender',
      DemographicsAgeGroup: 'useDemographicsAgeGroup',
      ConditionGroupEraLongTerm: 'useConditionGroupEraLongTerm',
      DrugGroupEraLongTerm: 'useDrugGroupEraLongTerm',
      VisitConceptCountLongTerm: 'useVisitConceptCountLongTerm',
      ProcedureGroupEraLongTerm: 'useProcedureGroupEraLongTerm',
      MeasurementValueLongTerm: 'useMeasurementValueLongTerm',
      ObservationEraLongTerm: 'useObservationEraLongTerm',
    };
    for (const [src, dest] of Object.entries(KEY_MAP)) {
      // Prefer non-prefixed (Strategus), fall back to legacy use<Name>
      const useKey = `use${src}`;
      if (src in covariateSettings && typeof covariateSettings[src] === 'boolean') {
        (plp as unknown as Record<string, unknown>)[dest] = covariateSettings[src];
      } else if (useKey in covariateSettings && typeof covariateSettings[useKey] === 'boolean') {
        (plp as unknown as Record<string, unknown>)[dest] = covariateSettings[useKey];
      }
    }
  }

  const preprocessSettings = design['preprocessSettings'] as Record<string, unknown> | undefined;
  if (preprocessSettings) {
    if (typeof preprocessSettings['minFraction'] === 'number') plp.minFraction = preprocessSettings['minFraction'];
    if (typeof preprocessSettings['normalize'] === 'boolean') plp.normalize = preprocessSettings['normalize'];
    if (typeof preprocessSettings['removeRedundancy'] === 'boolean') plp.removeRedundancy = preprocessSettings['removeRedundancy'];
  }

  const splitSettings = design['splitSettings'] as Record<string, unknown> | undefined;
  if (splitSettings) {
    if (typeof splitSettings['test'] === 'number') plp.testFraction = splitSettings['test'];
    if (typeof splitSettings['nfold'] === 'number') plp.nfold = splitSettings['nfold'];
    if (typeof splitSettings['type'] === 'string' && ['time', 'subject', 'stratified'].includes(splitSettings['type'])) {
      plp.splitType = splitSettings['type'] as PlpSettings['splitType'];
    }
  }

  // sampleSettings can be:
  //   - an array with a sameData sentinel → no sampling
  //   - an array with a real sampling entry (type != sameData)
  //   - a bare object (legacy format)
  const sampleSettingsRaw = design['sampleSettings'];
  if (Array.isArray(sampleSettingsRaw)) {
    const firstSample = sampleSettingsRaw[0] as Record<string, unknown> | undefined;
    if (firstSample && firstSample['attr_fun'] !== 'sameData') {
      // Real sampling entry
      if (typeof firstSample['type'] === 'string' && ['underSample', 'overSample'].includes(firstSample['type'])) {
        plp.samplingStrategy = firstSample['type'] as PlpSettings['samplingStrategy'];
      }
      if (typeof firstSample['numberOutcomesToSampleTo'] === 'number') {
        plp.samplingNumberOutcomesToSampleTo = firstSample['numberOutcomesToSampleTo'];
      }
    }
    // If attr_fun === 'sameData', leave samplingStrategy as 'none' (default)
  } else if (sampleSettingsRaw && typeof sampleSettingsRaw === 'object') {
    // Legacy bare object
    const sampleSettings = sampleSettingsRaw as Record<string, unknown>;
    if (typeof sampleSettings['type'] === 'string' && ['underSample', 'overSample'].includes(sampleSettings['type'])) {
      plp.samplingStrategy = sampleSettings['type'] as PlpSettings['samplingStrategy'];
    }
    if (typeof sampleSettings['numberOutcomesToSampleTo'] === 'number') {
      plp.samplingNumberOutcomesToSampleTo = sampleSettings['numberOutcomesToSampleTo'];
    }
  }

  const executeSettings = design['executeSettings'] as Record<string, unknown> | undefined;
  if (executeSettings) {
    if (typeof executeSettings['runCalibration'] === 'boolean') plp.runCalibration = executeSettings['runCalibration'];
    if (typeof executeSettings['calibrationBins'] === 'number') plp.calibrationBins = executeSettings['calibrationBins'];
  }
}

function parsePlpValidationSettings(
  modSpec: ModuleSpecification,
  store: StrategusStore
): void {
  const s = modSpec.settings as Record<string, unknown>;
  const pvs = store.plpValidationSettings;

  const validationList = s['validationList'] as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(validationList)) return;

  pvs.validationDesigns = validationList.map((v) => {
    const plpModelList = v['plpModelList'] as string[] | undefined;
    return {
      plpModelPath: Array.isArray(plpModelList) && plpModelList.length > 0 ? plpModelList[0] : '',
      targetId: typeof v['targetId'] === 'number' ? v['targetId'] : null,
      outcomeId: typeof v['outcomeId'] === 'number' ? v['outcomeId'] : null,
      recalibrate: typeof v['recalibrate'] === 'string' ? (v['recalibrate'] as 'weakRecalibration' | 'none') : 'none',
      runCovariateSummary: typeof v['runCovariateSummary'] === 'boolean' ? v['runCovariateSummary'] : false,
    };
  });
}

function parseTreatmentPatternsSettings(
  modSpec: ModuleSpecification,
  store: StrategusStore
): void {
  const s = modSpec.settings as Record<string, unknown>;
  const tp = store.treatmentPatternsSettings;

  const cohorts = s['cohorts'] as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(cohorts)) {
    tp.cohortRoles = cohorts.map((c) => ({
      cohortId: c['cohortId'] as number,
      cohortName: c['cohortName'] as string,
      type: c['type'] as 'target' | 'event' | 'exit',
    }));
  }

  const numKeys: Array<keyof TreatmentPatternsSettings> = [
    'maxPathLength', 'combinationWindow', 'eraCollapseSize', 'minEraDuration',
    'minPostCombinationDuration', 'minCellCount', 'ageWindow', 'indexDateOffset',
  ];
  for (const key of numKeys) {
    if (key in s && typeof s[key] === 'number') {
      (tp as unknown as Record<string, unknown>)[key] = s[key];
    }
  }

  if (typeof s['filterTreatments'] === 'string') {
    tp.filterTreatments = s['filterTreatments'] as TreatmentPatternsSettings['filterTreatments'];
  }
  if (typeof s['includeTreatments'] === 'string') {
    tp.includeTreatments = s['includeTreatments'] as TreatmentPatternsSettings['includeTreatments'];
  }
  if (typeof s['censorType'] === 'string') {
    tp.censorType = s['censorType'] as TreatmentPatternsSettings['censorType'];
  }
  if (typeof s['stratify'] === 'boolean') tp.stratify = s['stratify'];
  if (typeof s['concatTargets'] === 'boolean') tp.concatTargets = s['concatTargets'];
}

function parseEvidenceSynthesisSettings(
  modSpec: ModuleSpecification,
  store: StrategusStore
): void {
  const s = modSpec.settings as Record<string, unknown>;
  const es = store.evidenceSynthesisSettings;

  const analysisList = s['evidenceSynthesisAnalysisList'] as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(analysisList)) {
    es.analyses = analysisList.map((a) => {
      const source = a['evidenceSynthesisSource'] as Record<string, unknown> | undefined;

      // Detect analysisType from attr_class[0] prefix: 'FixedEffectsMetaAnalysis' → 'FixedEffects', etc.
      let analysisType: EvidenceSynthesisSettings['analyses'][number]['analysisType'] = 'RandomEffects';
      const attrClass = a['attr_class'] as string[] | undefined;
      if (Array.isArray(attrClass) && attrClass.length > 0) {
        const first = attrClass[0];
        if (first.startsWith('FixedEffects')) analysisType = 'FixedEffects';
        else if (first.startsWith('Bayesian')) analysisType = 'Bayesian';
        else if (first.startsWith('RandomEffects')) analysisType = 'RandomEffects';
      }

      const base: EvidenceSynthesisSettings['analyses'][number] = {
        evidenceSynthesisAnalysisId: a['evidenceSynthesisAnalysisId'] as number,
        description: a['evidenceSynthesisDescription'] as string,
        analysisType,
        sourceMethod: (source?.['sourceMethod'] as EvidenceSynthesisSettings['analyses'][number]['sourceMethod']) ?? 'CohortMethod',
        likelihoodApproximation: (source?.['likelihoodApproximation'] as EvidenceSynthesisSettings['analyses'][number]['likelihoodApproximation']) ?? 'normal',
        controlType: a['controlType'] as EvidenceSynthesisSettings['analyses'][number]['controlType'],
        alpha: typeof a['alpha'] === 'number' ? a['alpha'] : 0.05,
      };

      // Read Bayesian-specific fields if present
      if (analysisType === 'Bayesian') {
        if (typeof a['chainLength'] === 'number') base.chainLength = a['chainLength'];
        if (typeof a['burnIn'] === 'number') base.burnIn = a['burnIn'];
        if (typeof a['subSampleFrequency'] === 'number') base.subSampleFrequency = a['subSampleFrequency'];
        if (Array.isArray(a['priorSd']) && a['priorSd'].length === 2) {
          base.priorSd = a['priorSd'] as [number, number];
        }
        if (typeof a['robust'] === 'boolean') base.robust = a['robust'];
        if (typeof a['df'] === 'number') base.df = a['df'];
        if (typeof a['seed'] === 'number') base.seed = a['seed'];
      }

      return base;
    });
  }

  const thresholds = s['esDiagnosticThresholds'] as Record<string, unknown> | undefined;
  if (thresholds) {
    if (typeof thresholds['mdrrThreshold'] === 'number') es.mdrrThreshold = thresholds['mdrrThreshold'];
    if (typeof thresholds['easeThreshold'] === 'number') es.easeThreshold = thresholds['easeThreshold'];
    if (typeof thresholds['i2Threshold'] === 'number') es.i2Threshold = thresholds['i2Threshold'];
    if (typeof thresholds['tauThreshold'] === 'number') es.tauThreshold = thresholds['tauThreshold'];
    if (typeof thresholds['alpha'] === 'number') es.alpha = thresholds['alpha'];
  }
}
