import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { useStrategusStore } from '../src/store/useStrategusStore';
import { deserializeSpec } from '../src/services/SpecDeserializer';
import { serializeSpec } from '../src/services/SpecSerializer';
import type { AnalysisSpecification } from '../src/models/AnalysisSpec';

describe('CohortMethod study-population windows', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  // Deserializer: read createStudyPopArgs from cmAnalysisList[0] into analyses[0]
  it('deserializes createStudyPopArgs from glp1-dili into analyses[0]', () => {
    const store = useStrategusStore();
    const spec = JSON.parse(
      readFileSync(join(__dirname, 'fixtures', 'glp1-dili.json'), 'utf8')
    ) as AnalysisSpecification;

    deserializeSpec(spec, store as never);

    const a0 = store.cohortMethodSettings.analyses[0];
    // Literal values from glp1-dili.json cmAnalysisList[0].createStudyPopArgs
    expect(a0.riskWindowStart).toBe(1);
    expect(a0.startAnchor).toBe('cohort start');
    expect(a0.riskWindowEnd).toBe(0);
    expect(a0.endAnchor).toBe('cohort end');
    expect(a0.minDaysAtRisk).toBe(1);
    expect(a0.priorOutcomeLookback).toBe(99999);
  });

  // Serializer: distinctive values written into createStudyPopArgs
  it('serializes analyses[0] study-population fields into createStudyPopArgs', () => {
    const store = useStrategusStore();
    const a0 = store.cohortMethodSettings.analyses[0];
    a0.riskWindowStart = 7;
    a0.startAnchor = 'cohort end';
    a0.riskWindowEnd = 42;
    a0.endAnchor = 'cohort start';
    a0.minDaysAtRisk = 3;
    a0.priorOutcomeLookback = 12345;

    store.enabledModules.CohortMethod = true;
    store.enabledModules.CohortDiagnostics = false;
    store.enabledModules.Characterization = false;
    store.enabledModules.CohortIncidence = false;
    store.enabledModules.SCCS = false;

    const spec = serializeSpec(store as never);
    const mod = spec.moduleSpecifications.find((m) => m.module === 'CohortMethodModule');
    const settings = mod!.settings as Record<string, unknown>;
    const analysisList = settings['cmAnalysisList'] as Array<Record<string, unknown>>;
    const pop0 = analysisList[0]['createStudyPopArgs'] as Record<string, unknown>;

    expect(pop0['riskWindowStart']).toBe(7);
    expect(pop0['startAnchor']).toBe('cohort end');
    expect(pop0['riskWindowEnd']).toBe(42);
    expect(pop0['endAnchor']).toBe('cohort start');
    expect(pop0['minDaysAtRisk']).toBe(3);
    expect(pop0['priorOutcomeLookback']).toBe(12345);
  });
});
