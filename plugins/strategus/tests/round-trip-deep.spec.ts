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
import { diffSpec } from './helpers/diffSpec';

const FIXTURES_DIR = join(__dirname, 'fixtures');
const REPORT_DIR = join(__dirname, '__diff_reports__');

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

      const diff = diffSpec(fx.spec as unknown, rs);

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
