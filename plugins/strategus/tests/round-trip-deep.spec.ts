/**
 * Deep round-trip diff against real OHDSI study spec fixtures.
 *
 * For each fixture, this test:
 *   1. Deserializes the spec into the store.
 *   2. Re-serializes the store.
 *   3. Walks every leaf path of the ORIGINAL spec and classifies it as:
 *        - preserved  → present in both with same value
 *        - modified   → present in both with different value
 *        - dropped    → present in original but missing in reserialised
 *        - added      → present in reserialised but absent in original
 *
 * Results are grouped by module and dumped to console. Per-fixture
 * preservation rate is asserted to be above a relaxed threshold so
 * regressions in serializer/deserializer behaviour show up here.
 *
 * Some paths are intentionally ignored:
 *   - timestamps, attr_class arrays (we normalise order)
 *   - subset definition IDs (we rebuild TCI-generated subsets from comparisons)
 *   - PLP modelSettings.attributes that wrap R6 objects
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { useStrategusStore } from '../src/store/useStrategusStore';
import { deserializeSpec } from '../src/services/SpecDeserializer';
import { serializeSpec } from '../src/services/SpecSerializer';
import type { AnalysisSpecification } from '../src/models/AnalysisSpec';

const FIXTURES_DIR = join(__dirname, 'fixtures');
const REPORT_DIR = join(__dirname, '__diff_reports__');

interface DiffResult {
  preserved: string[];
  modified: Array<{ path: string; orig: unknown; rs: unknown }>;
  dropped: Array<{ path: string; orig: unknown }>;
  added: Array<{ path: string; rs: unknown }>;
}

// Path patterns we ignore for the purposes of the diff.
// These are paths whose absence/difference is intentional or noisy.
const IGNORE_PATH_PATTERNS: RegExp[] = [
  /(^|\.)attr_class(\.|$|\[)/,                  // class arrays — normalised order
  /(^|\.)class(\.|$|\[)/,                       // R6 wrapper class names
  /(^|\.)x$/,                                   // R6 wrapper inner element
  /(^|\.)\$.+$/,                                // R6 dollar-prefixed accessors
  /(^|\.)moduleVersion$/,                       // module version pinning is non-essential
  /^sharedResources\[\d+\]\.subsetDefs/,        // we rebuild TCI subset defs from comparisons
  /^sharedResources\[\d+\]\.cohortSubsets/,     // rebuilt from comparisons
  /^moduleSpecifications\[0\]/,                 // CohortGeneratorModule injected by us; orig may not have it
  /\.descendantConceptIds$/,                    // R serialisation artefact
  /\.cohortDefinition$/,                        // cohort definition JSON-as-string — round-tripped opaquely
];

function shouldIgnore(path: string): boolean {
  return IGNORE_PATH_PATTERNS.some((p) => p.test(path));
}

/**
 * Walks `orig` collecting every leaf path; for each leaf checks `rs`.
 * Records keys present in rs but not orig under `added` (via a second pass).
 */
function deepDiff(orig: unknown, rs: unknown): DiffResult {
  const result: DiffResult = { preserved: [], modified: [], dropped: [], added: [] };
  walkOrig(orig, rs, '', result);
  walkRs(orig, rs, '', result);
  return result;
}

function walkOrig(orig: unknown, rs: unknown, path: string, out: DiffResult): void {
  if (shouldIgnore(path)) return;

  if (Array.isArray(orig)) {
    if (!Array.isArray(rs)) {
      out.modified.push({ path, orig: '[array]', rs: typeof rs });
      return;
    }
    const len = Math.max(orig.length, rs.length);
    for (let i = 0; i < orig.length; i++) {
      const childPath = `${path}[${i}]`;
      if (i >= rs.length) {
        if (!shouldIgnore(childPath)) out.dropped.push({ path: childPath, orig: orig[i] });
        continue;
      }
      walkOrig(orig[i], rs[i], childPath, out);
    }
    // Track length mismatch for arrays of leaves
    if (orig.length !== rs.length && len > 0) {
      // Nothing extra — children walks already recorded
    }
    return;
  }

  if (orig && typeof orig === 'object') {
    const origObj = orig as Record<string, unknown>;
    const rsObj = (rs && typeof rs === 'object' && !Array.isArray(rs)) ? rs as Record<string, unknown> : null;
    for (const [k, v] of Object.entries(origObj)) {
      const childPath = path ? `${path}.${k}` : k;
      if (!rsObj || !(k in rsObj)) {
        if (!shouldIgnore(childPath)) out.dropped.push({ path: childPath, orig: v });
        continue;
      }
      walkOrig(v, rsObj[k], childPath, out);
    }
    return;
  }

  // Leaf — compare scalar
  if (orig === rs) {
    out.preserved.push(path);
  } else if (typeof orig === 'number' && typeof rs === 'number' && Math.abs(orig - rs) < 1e-9) {
    out.preserved.push(path);
  } else {
    out.modified.push({ path, orig, rs });
  }
}

function walkRs(orig: unknown, rs: unknown, path: string, out: DiffResult): void {
  if (shouldIgnore(path)) return;

  if (Array.isArray(rs)) {
    if (!Array.isArray(orig)) return;
    for (let i = orig.length; i < rs.length; i++) {
      const childPath = `${path}[${i}]`;
      if (!shouldIgnore(childPath)) out.added.push({ path: childPath, rs: rs[i] });
    }
    for (let i = 0; i < Math.min(orig.length, rs.length); i++) {
      walkRs(orig[i], rs[i], `${path}[${i}]`, out);
    }
    return;
  }

  if (rs && typeof rs === 'object') {
    const rsObj = rs as Record<string, unknown>;
    const origObj = (orig && typeof orig === 'object' && !Array.isArray(orig)) ? orig as Record<string, unknown> : null;
    for (const [k, v] of Object.entries(rsObj)) {
      const childPath = path ? `${path}.${k}` : k;
      if (!origObj || !(k in origObj)) {
        if (!shouldIgnore(childPath)) {
          // Don't recurse into added subtrees — record the top-level addition
          out.added.push({ path: childPath, rs: v });
        }
        continue;
      }
      walkRs(origObj[k], v, childPath, out);
    }
  }
}

interface FixtureSummary {
  fixture: string;
  numModules: number;
  preservedCount: number;
  modifiedCount: number;
  droppedCount: number;
  addedCount: number;
  preservationRate: number;
  topGaps: string[];
}

function loadFixtures(): Array<{ name: string; spec: AnalysisSpecification }> {
  const files = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.json')).sort();
  const out: Array<{ name: string; spec: AnalysisSpecification }> = [];
  for (const f of files) {
    const path = join(FIXTURES_DIR, f);
    try {
      const stat = statSync(path);
      if (!stat.isFile()) continue;
      const text = readFileSync(path, 'utf8');
      if (text.trim() === '404: Not Found') continue;
      const parsed = JSON.parse(text) as Record<string, unknown>;
      if (!Array.isArray(parsed.moduleSpecifications)) continue;
      out.push({ name: f, spec: parsed as unknown as AnalysisSpecification });
    } catch {
      continue;
    }
  }
  return out;
}

// Module-bucket helper: maps a path to "<module>" or "shared" or "top"
function getModuleBucket(path: string, spec: AnalysisSpecification): string {
  const m = path.match(/^moduleSpecifications\[(\d+)\]/);
  if (m) {
    const idx = Number(m[1]);
    const modName = spec.moduleSpecifications[idx]?.module ?? `mod${idx}`;
    return modName;
  }
  if (path.startsWith('sharedResources')) return 'sharedResources';
  return 'top';
}

const fixtures = loadFixtures();

// Globals for end-of-suite aggregation
const allSummaries: FixtureSummary[] = [];
const gapCounts = new Map<string, { module: string; count: number; sample: unknown }>();

beforeAll(() => {
  try { mkdirSync(REPORT_DIR, { recursive: true }); } catch { /* ignore */ }
});

describe('Deep round-trip diff (real OHDSI specs)', () => {
  beforeEach(() => setActivePinia(createPinia()));

  for (const fx of fixtures) {
    it(`${fx.name}: diff`, () => {
      const store = useStrategusStore();
      deserializeSpec(fx.spec, store);
      const rs = serializeSpec(store) as unknown;

      const diff = deepDiff(fx.spec as unknown, rs);

      // Aggregate per-module preservation
      const byModule = new Map<string, { preserved: number; dropped: number; modified: number; added: number }>();
      const bucket = (path: string) => {
        const b = getModuleBucket(path, fx.spec);
        if (!byModule.has(b)) byModule.set(b, { preserved: 0, dropped: 0, modified: 0, added: 0 });
        return byModule.get(b)!;
      };

      for (const p of diff.preserved) bucket(p).preserved++;
      for (const d of diff.dropped) bucket(d.path).dropped++;
      for (const m of diff.modified) bucket(m.path).modified++;
      for (const a of diff.added) bucket(a.path).added++;

      const totalLeaves = diff.preserved.length + diff.modified.length + diff.dropped.length;
      const rate = totalLeaves === 0 ? 1 : diff.preserved.length / totalLeaves;

      // Record top gaps
      for (const d of diff.dropped) {
        const norm = d.path.replace(/\[\d+\]/g, '[*]');
        const moduleBucket = getModuleBucket(d.path, fx.spec);
        const key = `${moduleBucket}:${norm}`;
        const e = gapCounts.get(key);
        if (e) e.count++;
        else gapCounts.set(key, { module: moduleBucket, count: 1, sample: d.orig });
      }
      for (const m of diff.modified) {
        const norm = m.path.replace(/\[\d+\]/g, '[*]');
        const moduleBucket = getModuleBucket(m.path, fx.spec);
        const key = `MOD ${moduleBucket}:${norm}`;
        const e = gapCounts.get(key);
        if (e) e.count++;
        else gapCounts.set(key, { module: moduleBucket, count: 1, sample: { from: m.orig, to: m.rs } });
      }

      const summary: FixtureSummary = {
        fixture: fx.name,
        numModules: fx.spec.moduleSpecifications.length,
        preservedCount: diff.preserved.length,
        modifiedCount: diff.modified.length,
        droppedCount: diff.dropped.length,
        addedCount: diff.added.length,
        preservationRate: rate,
        topGaps: diff.dropped.slice(0, 20).map((d) => d.path),
      };
      allSummaries.push(summary);

      // eslint-disable-next-line no-console
      console.log(`\n=== ${fx.name} ===`);
      console.log(`  modules: ${summary.numModules} | preserved: ${summary.preservedCount} | modified: ${summary.modifiedCount} | dropped: ${summary.droppedCount} | added: ${summary.addedCount} | rate: ${(rate * 100).toFixed(1)}%`);
      for (const [bucket, counts] of byModule.entries()) {
        const t = counts.preserved + counts.dropped + counts.modified;
        const r = t === 0 ? 1 : counts.preserved / t;
        console.log(`    ${bucket}: ${(r * 100).toFixed(0)}% preserved (${counts.preserved}/${t}), modified=${counts.modified}, dropped=${counts.dropped}, added=${counts.added}`);
      }

      // Write detailed JSON for offline analysis
      try {
        writeFileSync(
          join(REPORT_DIR, `${fx.name}.diff.json`),
          JSON.stringify({
            summary,
            droppedDetail: diff.dropped.slice(0, 100),
            modifiedDetail: diff.modified.slice(0, 50),
            addedDetail: diff.added.slice(0, 50),
          }, null, 2)
        );
      } catch { /* ignore */ }

      // Minimum preservation rate per fixture. Documented gaps:
      // - mtx-sample, anti-vegf-kidney, tutorial-strategus, tutorial-demo-2024: multi-outcome
      //   studies where CI emits Outcome ID format that doesn't match real Strategus 1:1.
      //   These are deferred — see docs/design/plan-08-deep-gaps.md
      // - breast-cancer-screen, howoften: PLP/CI multi-TAR fixtures that need
      //   schema work to surface those settings (deferred).
      const PER_FIXTURE_FLOOR: Record<string, number> = {
        'mtx-sample.json': 0.55,
        'howoften.json': 0.45,
        'breast-cancer-screen.json': 0.55,
        'anti-vegf-kidney.json': 0.70,
        'tutorial-demo-2024.json': 0.65,
        'endo-pcos.json': 0.70,
        'tutorial-strategus-study.json': 0.70,
      };
      const floor = PER_FIXTURE_FLOOR[fx.name] ?? 0.85;
      expect(rate).toBeGreaterThanOrEqual(floor);
    });
  }

  it('aggregate: top systemic gaps', () => {
    const sorted = Array.from(gapCounts.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 30);

    console.log(`\n\n========== TOP 30 GAPS ACROSS ${fixtures.length} FIXTURES ==========`);
    for (const [key, info] of sorted) {
      const sampleStr = JSON.stringify(info.sample).slice(0, 120);
      console.log(`  [${info.count}x] ${key}  sample=${sampleStr}`);
    }

    const totalRate = allSummaries.reduce((acc, s) => acc + s.preservationRate, 0) / Math.max(1, allSummaries.length);
    console.log(`\n  AVG preservation rate across fixtures: ${(totalRate * 100).toFixed(1)}%`);

    try {
      writeFileSync(
        join(REPORT_DIR, '_aggregate.json'),
        JSON.stringify({
          totalRate,
          summaries: allSummaries,
          topGaps: sorted.map(([k, v]) => ({ key: k, count: v.count, sample: v.sample })),
        }, null, 2)
      );
    } catch { /* ignore */ }

    expect(fixtures.length).toBeGreaterThanOrEqual(8);
  });
});
