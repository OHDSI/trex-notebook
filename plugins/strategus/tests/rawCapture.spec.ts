import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { useStrategusStore } from '../src/store/useStrategusStore';
import { deserializeSpec } from '../src/services/SpecDeserializer';

describe('raw capture', () => {
  beforeEach(() => setActivePinia(createPinia()));
  it('captures each module settings verbatim', () => {
    const store = useStrategusStore();
    const spec = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'glp1-dili.json'), 'utf8'));
    deserializeSpec(spec, store);
    const cm = spec.moduleSpecifications.find((m: any) => m.module === 'CohortMethodModule');
    expect(store.moduleRawSettings['CohortMethodModule']).toEqual(cm.settings);
  });
});
