import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { useStrategusStore } from '../src/store/useStrategusStore';
import { deserializeSpec } from '../src/services/SpecDeserializer';
import { serializeSpec } from '../src/services/SpecSerializer';
import { diffSpec } from './helpers/diffSpec';
const DIR = join(__dirname, 'fixtures');
describe('fidelity guard: no dropped options', () => {
  for (const f of readdirSync(DIR).filter((n) => n.endsWith('.json'))) {
    it(`${f} loses no options`, () => {
      setActivePinia(createPinia());
      const store = useStrategusStore();
      const orig = JSON.parse(readFileSync(join(DIR, f), 'utf8'));
      deserializeSpec(orig, store as any);
      const rs = serializeSpec(store as any) as any;
      const dropped = diffSpec(orig, rs).dropped;
      expect(dropped, JSON.stringify(dropped.slice(0, 25), null, 2)).toHaveLength(0);
    });
  }
});
