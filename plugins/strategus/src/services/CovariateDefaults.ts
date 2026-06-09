export interface CovariateDefaultsOptions {
  addDescendantsToExclude?: boolean;
  includedCovariateConceptIds?: number[];
  addDescendantsToInclude?: boolean;
  features?: Record<string, boolean>;
  longTermStartDays?: number;
  shortTermStartDays?: number;
  endDays?: number;
}

// Full list of feature flag names
const ALL_FEATURE_FLAGS = [
  'DemographicsGender',
  'DemographicsAge',
  'DemographicsAgeGroup',
  'DemographicsRace',
  'DemographicsEthnicity',
  'DemographicsIndexYear',
  'DemographicsIndexMonth',
  'DemographicsPriorObservationTime',
  'DemographicsPostObservationTime',
  'DemographicsTimeInCohort',
  'DemographicsIndexYearMonth',
  'ConditionGroupEraLongTerm',
  'ConditionGroupEraShortTerm',
  'DrugGroupEraLongTerm',
  'DrugGroupEraShortTerm',
  'DrugGroupEraOverlapping',
  'ProcedureOccurrenceLongTerm',
  'ProcedureOccurrenceShortTerm',
  'DeviceExposureLongTerm',
  'DeviceExposureShortTerm',
  'MeasurementLongTerm',
  'MeasurementShortTerm',
  'MeasurementRangeGroupLongTerm',
  'MeasurementRangeGroupShortTerm',
  'MeasurementValueAsConceptLongTerm',
  'MeasurementValueAsConceptShortTerm',
  'ObservationLongTerm',
  'ObservationShortTerm',
  'ObservationValueAsConceptLongTerm',
  'ObservationValueAsConceptShortTerm',
  'CharlsonIndex',
  'Dcsi',
  'Chads2',
  'Chads2Vasc',
  'VisitCountLongTerm',
  'VisitCountShortTerm',
  'VisitConceptCountLongTerm',
  'VisitConceptCountShortTerm',
] as const;

export type FeatureFlagName = typeof ALL_FEATURE_FLAGS[number];

export function createDefaultCovariateSettings(opts?: CovariateDefaultsOptions | boolean) {
  // Backward compat: old callers passed a boolean directly
  let addDescendantsToExclude = true;
  let includedCovariateConceptIds: number[] = [];
  let addDescendantsToInclude = false;
  let featureOverrides: Record<string, boolean> | undefined;
  let longTermStartDays = -365;
  let shortTermStartDays = -30;
  let endDays = 0;

  if (typeof opts === 'boolean') {
    addDescendantsToExclude = opts;
  } else if (opts && typeof opts === 'object') {
    addDescendantsToExclude = opts.addDescendantsToExclude ?? true;
    includedCovariateConceptIds = opts.includedCovariateConceptIds ?? [];
    addDescendantsToInclude = opts.addDescendantsToInclude ?? false;
    featureOverrides = opts.features;
    longTermStartDays = opts.longTermStartDays ?? -365;
    shortTermStartDays = opts.shortTermStartDays ?? -30;
    endDays = opts.endDays ?? 0;
  }

  // Build feature flags: defaults are all true, override with provided values.
  // Also emit any override-only feature keys not in the canonical list so that
  // value-as-concept / range-group groups round-trip through the serializer.
  const featureFlags: Record<string, boolean> = {};
  for (const flag of ALL_FEATURE_FLAGS) {
    featureFlags[flag] = featureOverrides !== undefined && flag in featureOverrides
      ? featureOverrides[flag]
      : true;
  }
  if (featureOverrides) {
    for (const flag of Object.keys(featureOverrides)) {
      if (!(flag in featureFlags)) {
        featureFlags[flag] = featureOverrides[flag];
      }
    }
  }

  return {
    temporal: false,
    temporalSequence: false,
    ...featureFlags,
    longTermStartDays,
    // Strategus default — included so real specs round-trip cleanly even when
    // we don't expose a UI knob for it.
    mediumTermStartDays: -180,
    shortTermStartDays,
    endDays,
    includedCovariateConceptIds,
    addDescendantsToInclude,
    excludedCovariateConceptIds: [],
    addDescendantsToExclude,
    includedCovariateIds: [],
    attr_class: 'covariateSettings',
    attr_fun: 'getDbDefaultCovariateData',
  };
}
