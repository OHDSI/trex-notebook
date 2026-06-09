/**
 * Deep round-trip diff machinery shared between the deep-diff report test and
 * the fidelity guard.
 *
 * `diffSpec(orig, rs)` walks every leaf path of the ORIGINAL spec and classifies
 * it as:
 *   - preserved  → present in both with same value
 *   - modified   → present in both with different value
 *   - dropped    → present in original but missing in reserialised
 *   - added      → present in reserialised but absent in original
 *
 * Some paths are intentionally ignored (timestamps, attr_class arrays, subset
 * definition IDs we rebuild, PLP R6 wrappers, etc.).
 */

export interface DiffResult {
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
  /(^|\.)generateStats$/,                       // CohortGeneratorModule's only setting; always emitted (at index 0)
                                                //   but orig may place CohortGeneratorModule at a different index,
                                                //   so an index-aligned diff misreads it as dropped.
  /\.descendantConceptIds$/,                    // R serialisation artefact
  /\.cohortDefinition$/,                        // cohort definition JSON-as-string — round-tripped opaquely
];

export function shouldIgnore(path: string): boolean {
  return IGNORE_PATH_PATTERNS.some((p) => p.test(path));
}

/**
 * Walks `orig` collecting every leaf path; for each leaf checks `rs`.
 * Records keys present in rs but not orig under `added` (via a second pass).
 */
export function diffSpec(orig: unknown, rs: unknown): DiffResult {
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
