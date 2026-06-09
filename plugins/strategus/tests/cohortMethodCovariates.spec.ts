import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { useStrategusStore } from '../src/store/useStrategusStore';
import { deserializeSpec } from '../src/services/SpecDeserializer';
import { serializeSpec } from '../src/services/SpecSerializer';
import type { AnalysisSpecification } from '../src/models/AnalysisSpec';

// Value-as-concept / range-group covariate flags that were previously not
// surfaced into store.cohortMethodSettings.covariateFeatures.
const VALUE_AS_CONCEPT_KEYS = [
  'MeasurementValueAsConceptLongTerm',
  'MeasurementValueAsConceptShortTerm',
  'MeasurementRangeGroupShortTerm',
  'ObservationValueAsConceptLongTerm',
  'ObservationValueAsConceptShortTerm',
] as const;

describe('CohortMethod value-as-concept covariate features', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('deserializes value-as-concept boolean flags from glp1-dili into covariateFeatures', () => {
    const store = useStrategusStore();
    const raw = JSON.parse(
      readFileSync(join(__dirname, 'fixtures', 'glp1-dili.json'), 'utf8')
    );
    const spec = JSON.parse(JSON.stringify(raw)) as AnalysisSpecification;

    // Read the literal booleans directly from the fixture's covariateSettings.
    function findCovSettings(o: unknown): Record<string, unknown> | null {
      if (!o || typeof o !== 'object') return null;
      if (Array.isArray(o)) {
        for (const x of o) {
          const r = findCovSettings(x);
          if (r) return r;
        }
        return null;
      }
      const rec = o as Record<string, unknown>;
      const args = rec['getDbCohortMethodDataArgs'] as Record<string, unknown> | undefined;
      if (args && args['covariateSettings']) return args['covariateSettings'] as Record<string, unknown>;
      for (const k of Object.keys(rec)) {
        const r = findCovSettings(rec[k]);
        if (r) return r;
      }
      return null;
    }
    const covSettings = findCovSettings(raw)!;

    deserializeSpec(spec, store as never);

    const features = store.cohortMethodSettings.covariateFeatures;
    for (const key of VALUE_AS_CONCEPT_KEYS) {
      expect(features[key]).toBe(covSettings[key]);
    }
  });

  it('does not pull reserved non-feature booleans into covariateFeatures', () => {
    const store = useStrategusStore();
    const spec = JSON.parse(
      readFileSync(join(__dirname, 'fixtures', 'glp1-dili.json'), 'utf8')
    ) as AnalysisSpecification;

    deserializeSpec(spec, store as never);

    const features = store.cohortMethodSettings.covariateFeatures;
    // These are config booleans, not feature flags — must stay out.
    expect(features['temporal']).toBeUndefined();
    expect(features['temporalSequence']).toBeUndefined();
    expect(features['addDescendantsToInclude']).toBeUndefined();
    expect(features['addDescendantsToExclude']).toBeUndefined();
  });

  it('round-trips a toggled value-as-concept feature through the serializer', () => {
    const store = useStrategusStore();
    store.cohortMethodSettings.covariateFeatures['MeasurementValueAsConceptLongTerm'] = false;

    store.enabledModules.CohortMethod = true;
    store.enabledModules.CohortDiagnostics = false;
    store.enabledModules.Characterization = false;
    store.enabledModules.CohortIncidence = false;
    store.enabledModules.SCCS = false;

    const spec = serializeSpec(store as never);
    const mod = spec.moduleSpecifications.find((m) => m.module === 'CohortMethodModule');
    const settings = mod!.settings as Record<string, unknown>;
    const analysisList = settings['cmAnalysisList'] as Array<Record<string, unknown>>;
    const args = analysisList[0]['getDbCohortMethodDataArgs'] as Record<string, unknown>;
    const cov = args['covariateSettings'] as Record<string, unknown>;

    expect(cov['MeasurementValueAsConceptLongTerm']).toBe(false);
  });
});
