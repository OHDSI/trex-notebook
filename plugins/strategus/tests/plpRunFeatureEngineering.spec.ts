import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { useStrategusStore } from '../src/store/useStrategusStore';
import { deserializeSpec } from '../src/services/SpecDeserializer';
import { serializeSpec } from '../src/services/SpecSerializer';

const DIR = join(__dirname, 'fixtures');

function load(name: string) {
  return JSON.parse(readFileSync(join(DIR, name), 'utf8'));
}

// breast-cancer-screen.json uses the upstream R typo key `runfeatureEngineering`
// (lowercase f) with value `true` in its PLP executeSettings, while the store
// default for runFeatureEngineering is `false`. So if the deserializer only read
// the correctly-cased key, the imported value (true) would be lost and the store
// would show the default (false). This fixture therefore exercises the typo-key
// path with a value that differs from the default.
describe('PLP runFeatureEngineering typo-key (runfeatureEngineering)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('reflects the imported typo-key value (not the default)', () => {
    const store = useStrategusStore();
    const orig = load('breast-cancer-screen.json');
    deserializeSpec(orig, store as any);
    // imported value is true; default is false
    expect(store.plpSettings.runFeatureEngineering).toBe(true);
  });

  it('serializes exactly one of the two casings (no double-key conflict)', () => {
    const store = useStrategusStore();
    const orig = load('breast-cancer-screen.json');
    deserializeSpec(orig, store as any);
    store.plpSettings.runFeatureEngineering = true;
    const rs = serializeSpec(store as any) as any;
    const plpMod = rs.moduleSpecifications.find(
      (m: any) => m.module === 'PatientLevelPredictionModule'
    );
    expect(plpMod).toBeTruthy();
    const settings = plpMod.settings;
    const designs = Array.isArray(settings) ? settings : settings.modelDesignList;
    expect(Array.isArray(designs)).toBe(true);
    expect(designs.length).toBeGreaterThan(0);
    for (const design of designs) {
      const es = design.executeSettings as Record<string, unknown>;
      const hasCorrect = Object.prototype.hasOwnProperty.call(es, 'runFeatureEngineering');
      const hasTypo = Object.prototype.hasOwnProperty.call(es, 'runfeatureEngineering');
      // exactly one of the two keys present
      expect(hasCorrect !== hasTypo).toBe(true);
      const value = hasCorrect ? es['runFeatureEngineering'] : es['runfeatureEngineering'];
      expect(value).toBe(true);
    }
  });
});
