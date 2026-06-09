// Deep-overlay `managed` onto `base`: plain objects recurse so base-only keys
// survive; arrays and primitives from `managed` replace base wholesale.
export function overlay(
  base: Record<string, unknown>,
  managed: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(managed)) {
    const b = out[k];
    if (isPlainObject(b) && isPlainObject(v)) {
      out[k] = overlay(b, v);
    } else if (v == null && (isPlainObject(b) || Array.isArray(b))) {
      // The editor emits a `null` placeholder for a field it does not model,
      // but the imported (base) value carries real structure. Keep the base so
      // those imported options are not dropped on round-trip.
      // (A `null` over a scalar/null base still replaces normally.)
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Index-wise overlay of a built array against a raw (captured) array.
 *
 * For each element of `built`, if a raw element exists at the same index and
 * both are plain objects, deep-overlay the built element onto the raw element
 * (so raw-only nested fields the editor doesn't model survive while editor
 * values win). Otherwise the built element is used as-is. The result has the
 * same length as `built` (the editor owns element count).
 */
export function overlayArrayByIndex(
  rawArr: unknown,
  builtArr: unknown[],
  options: { keepRawTail?: boolean } = {},
): unknown[] {
  const raw = Array.isArray(rawArr) ? rawArr : [];
  const merged = builtArr.map((builtEl, i) => {
    const rawEl = raw[i];
    if (isPlainObject(rawEl) && isPlainObject(builtEl)) {
      return overlay(rawEl, builtEl);
    }
    return builtEl;
  });
  // When the editor doesn't truly own the element count (the array is derived
  // from the model and may be a subset of what was imported), keep the raw tail
  // elements so imported options are not dropped on round-trip.
  if (options.keepRawTail && raw.length > builtArr.length) {
    for (let i = builtArr.length; i < raw.length; i++) merged.push(raw[i]);
  }
  return merged;
}

/**
 * Overlay a built scalar/id array against a raw array element-wise, keeping any
 * raw tail values beyond the built length. Used for derived id lists (e.g.
 * Characterization targetIds) the editor re-derives as a subset of the import.
 */
export function overlayScalarArrayKeepTail(rawArr: unknown, builtArr: unknown[]): unknown[] {
  const raw = Array.isArray(rawArr) ? rawArr : [];
  const merged = [...builtArr];
  for (let i = builtArr.length; i < raw.length; i++) merged.push(raw[i]);
  return merged;
}
