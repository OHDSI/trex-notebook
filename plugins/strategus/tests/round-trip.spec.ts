/**
 * Round-trip tests against real OHDSI study spec fixtures.
 *
 * These tests verify that the plugin can import (deserialize) a real-world
 * Strategus analysis specification and re-export (serialize) it without
 * losing meaningful data: module set, cohort IDs, negative control counts.
 *
 * The goal is NOT byte-identical round-trips — the plugin intentionally
 * normalises certain fields (e.g. adds CohortGeneratorModule, rebuilds
 * subset definitions from comparisons). The goal is structural fidelity.
 *
 * Documented gaps / known deviations are noted inline with `it.skip`.
 *
 * Fixtures downloaded from github.com/ohdsi-studies:
 *   - tutorial-strategus-study.json  (TutorialStrategusStudy)
 *   - glp1-dili.json                 (Glp1Dili)
 *   - anti-vegf-kidney.json          (AntiVegfKidneyFailure)
 *   - semaglutide-naion-es.json      (SemaglutideNaion — ES-only spec)
 *
 * For a field-level deep-diff against 14 fixtures see `round-trip-deep.spec.ts`.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { useStrategusStore } from '../src/store/useStrategusStore';
import { deserializeSpec } from '../src/services/SpecDeserializer';
import { serializeSpec } from '../src/services/SpecSerializer';
import type { AnalysisSpecification } from '../src/models/AnalysisSpec';

const FIXTURES_DIR = join(__dirname, 'fixtures');

function loadFixture(name: string): AnalysisSpecification | null {
  const path = join(FIXTURES_DIR, name);
  if (!existsSync(path)) return null;
  const text = readFileSync(path, 'utf8');
  if (text.trim() === '404: Not Found') return null;
  const parsed = JSON.parse(text) as Record<string, unknown>;
  // Minimal validation: must have moduleSpecifications
  if (!Array.isArray(parsed.moduleSpecifications)) return null;
  return parsed as unknown as AnalysisSpecification;
}

function extractCohorts(spec: AnalysisSpecification): Array<{ cohortId: number }> {
  const sr = spec.sharedResources.find(
    (r) =>
      Array.isArray((r as Record<string, unknown>).attr_class) &&
      ((r as Record<string, unknown>).attr_class as string[]).includes('CohortDefinitionSharedResources')
  ) as { cohortDefinitions?: Array<{ cohortId: number }> } | undefined;
  return sr?.cohortDefinitions ?? [];
}

function extractNcs(spec: AnalysisSpecification): Array<{ cohortId: number }> {
  const sr = spec.sharedResources.find(
    (r) =>
      Array.isArray((r as Record<string, unknown>).attr_class) &&
      ((r as Record<string, unknown>).attr_class as string[]).includes('NegativeControlOutcomeSharedResources')
  ) as { negativeControlOutcomes?: { negativeControlOutcomeCohortSet?: Array<{ cohortId: number }> } } | undefined;
  return sr?.negativeControlOutcomes?.negativeControlOutcomeCohortSet ?? [];
}

function getModuleSet(spec: AnalysisSpecification): Set<string> {
  return new Set(spec.moduleSpecifications.map((m) => m.module));
}

// ---------------------------------------------------------------------------
// Fixture catalogue
// ---------------------------------------------------------------------------

interface FixtureDescriptor {
  file: string;
  /** Description of why a module appears in orig but not reserialised, or vice-versa */
  knownModuleGaps?: string;
  /** If true, the spec has no CohortDefinitionSharedResources (e.g. ES-only specs) */
  noCohortSR?: boolean;
}

const FIXTURES: FixtureDescriptor[] = [
  {
    file: 'tutorial-strategus-study.json',
    // PLP appears in original; after round-trip it is preserved because
    // PatientLevelPredictionModule is recognised and roundtripped.
  },
  {
    file: 'glp1-dili.json',
    // CD and SCCS not present in this study (only Characterization, CohortIncidence, CohortMethod)
  },
  {
    file: 'anti-vegf-kidney.json',
    // PLP settings are in legacy flat-array format (settings is an array, not {modelDesignList:[...]}),
    // so the plugin cannot reconstruct the PLP design from this spec.
    // The module is still recognised and preserved in the module set.
  },
  {
    file: 'semaglutide-naion-es.json',
    // ES-only spec with no sharedResources CohortDefinitionSharedResources.
    noCohortSR: true,
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Real OHDSI spec round-trip', () => {
  beforeEach(() => setActivePinia(createPinia()));

  for (const descriptor of FIXTURES) {
    const spec = loadFixture(descriptor.file);

    // If the fixture file is missing (e.g. network unavailable during setup),
    // skip all tests for this fixture rather than crashing the suite.
    if (!spec) {
      describe.skip(`${descriptor.file} (fixture not available)`, () => {
        it('placeholder', () => {});
      });
      continue;
    }

    describe(descriptor.file, () => {
      it('deserializes without throwing', () => {
        const store = useStrategusStore();
        expect(() => deserializeSpec(spec, store)).not.toThrow();
      });

      it('preserves the set of modules', () => {
        const store = useStrategusStore();
        deserializeSpec(spec, store);
        const reserialized = serializeSpec(store);

        const origModules = getModuleSet(spec);
        const newModules = getModuleSet(reserialized);

        // CohortGeneratorModule is always injected by our serializer —
        // remove it from both sides before comparing.
        origModules.delete('CohortGeneratorModule');
        newModules.delete('CohortGeneratorModule');

        expect(newModules).toEqual(origModules);
      });

      if (descriptor.noCohortSR) {
        it.skip('preserves the cohort definitions (spec has no CohortDefinitionSharedResources)', () => {
          // Skipped: this ES-only spec carries no cohort definitions.
        });
      } else {
        it('preserves the cohort definitions', () => {
          const store = useStrategusStore();
          deserializeSpec(spec, store);
          const reserialized = serializeSpec(store);

          const origIds = extractCohorts(spec).map((c) => c.cohortId).sort((a, b) => a - b);
          const newIds = extractCohorts(reserialized).map((c) => c.cohortId).sort((a, b) => a - b);
          expect(newIds).toEqual(origIds);
        });
      }

      it('preserves the negative control outcomes', () => {
        const store = useStrategusStore();
        deserializeSpec(spec, store);
        const origNcs = extractNcs(spec);
        if (origNcs.length === 0) {
          // Spec has no NCs — verify the reserialised spec also has none.
          const newNcs = extractNcs(serializeSpec(store));
          expect(newNcs.length).toBe(0);
          return;
        }
        const newNcs = extractNcs(serializeSpec(store));
        expect(newNcs.length).toBe(origNcs.length);
      });

      it('produces a structurally valid spec', () => {
        const store = useStrategusStore();
        deserializeSpec(spec, store);
        const reserialized = serializeSpec(store);

        expect(reserialized.attr_class).toBe('AnalysisSpecifications');
        expect(Array.isArray(reserialized.sharedResources)).toBe(true);
        expect(Array.isArray(reserialized.moduleSpecifications)).toBe(true);
        // CohortGeneratorModule must always be first
        expect(reserialized.moduleSpecifications[0]?.module).toBe('CohortGeneratorModule');
      });

      it('stores load cohorts into the store', () => {
        if (descriptor.noCohortSR) return; // no cohorts to check
        const store = useStrategusStore();
        deserializeSpec(spec, store);
        const origCohortCount = extractCohorts(spec).length;
        expect(store.cohorts.length).toBe(origCohortCount);
      });

      it('stores load negative controls into the store', () => {
        const store = useStrategusStore();
        deserializeSpec(spec, store);
        const origNcs = extractNcs(spec);
        expect(store.negativeControls.length).toBe(origNcs.length);
      });
    });
  }
});

// ---------------------------------------------------------------------------
// Documented gaps
// ---------------------------------------------------------------------------
//
// 1. anti-vegf-kidney.json — PLP settings in legacy flat-array format:
//    The spec stores PatientLevelPredictionModule.settings as a bare JSON array
//    (each element is a modelDesign object). The plugin expects
//    settings = { modelDesignList: [...] }. The deserializer silently skips
//    the PLP settings in this case, resulting in default PLP settings after
//    import. The module itself IS preserved in the module set.
//
// 2. Subset definitions with definitionId < 1000:
//    Real study specs generated by Strategus R package use definitionId 1..N
//    for TCI-generated subset defs. The plugin skips those on import (only
//    reconstructs user-defined subsets with id >= 1000) and rebuilds them
//    from comparisons during export. This means subset def content may differ
//    from the original but the cohort set and structure are preserved.
//
// 3. semaglutide-naion-es.json — ES-only spec:
//    This spec has no sharedResources (no cohorts, no NCs). After round-trip,
//    the serializer adds an empty CohortDefinitionSharedResources. This is
//    structurally valid for Strategus even if the original had none.
//
// 4. CohortDiagnosticsModule attr_class order:
//    Some real specs have attr_class as ['CohortDiagnosticsModuleSpecifications',
//    'ModuleSpecifications'] (reversed vs our output). The deserializer only
//    uses modSpec.module (not attr_class) for dispatch, so this is harmless.
