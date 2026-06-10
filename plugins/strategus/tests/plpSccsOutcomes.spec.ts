import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { useStrategusStore } from '../src/store/useStrategusStore';
import { deserializeSpec } from '../src/services/SpecDeserializer';
import { serializeSpec } from '../src/services/SpecSerializer';
import { diffSpec } from './helpers/diffSpec';

const DIR = join(__dirname, 'fixtures');

function load(name: string) {
  return JSON.parse(readFileSync(join(DIR, name), 'utf8'));
}

// breast-cancer-screen.json is a PLP-only study. Its model designs define
// outcomeId 1782265 (target 1782266/1782267). The deserializer historically only
// harvested outcomes from CohortIncidence/CohortMethod, so a PLP-only study ended
// up with an empty store.outcomes and the cohort 1782265 never got the 'Outcome'
// role — the editor then falsely warned "no outcome". This fixture exercises the
// PLP-outcome derivation.
describe('derive outcomes from PLP (and SCCS)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('PLP-only study: outcomeId becomes a store outcome with Outcome role', () => {
    const store = useStrategusStore();
    const orig = load('breast-cancer-screen.json');
    deserializeSpec(orig, store as any);

    expect(store.outcomes.some((o) => o.cohortId === 1782265)).toBe(true);

    const outcomeCohort = store.cohorts.find((c) => c.cohortId === 1782265);
    expect(outcomeCohort).toBeTruthy();
    expect(outcomeCohort!.role).toBe('Outcome');
  });

  it('round-trips with zero drops and no spurious new module', () => {
    const store = useStrategusStore();
    const orig = load('breast-cancer-screen.json');
    deserializeSpec(orig, store as any);
    const rs = serializeSpec(store as any) as any;

    const diff = diffSpec(orig, rs);
    expect(diff.dropped, JSON.stringify(diff.dropped.slice(0, 25), null, 2)).toHaveLength(0);

    // No NEW top-level module added: same count and same module-name set.
    const origModules = orig.moduleSpecifications.map((m: any) => m.module).sort();
    const rsModules = rs.moduleSpecifications.map((m: any) => m.module).sort();
    const origSet = new Set(origModules);
    const newModules = rsModules.filter((m: string) => !origSet.has(m));
    expect(newModules, `unexpected new modules: ${JSON.stringify(newModules)}`).toHaveLength(0);
    expect(rs.moduleSpecifications.length).toBe(orig.moduleSpecifications.length);
  });
});
