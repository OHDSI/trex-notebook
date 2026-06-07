export interface ManualCohort {
  cohortId: number;
  cohortName: string;
  subjectCount: null;
  cohortDefinition: string;
}

export type ParseManualCohortResult =
  | { ok: true; cohort: ManualCohort }
  | { ok: false; error: string };

/**
 * Build a cohort entry from a pasted cohort-definition JSON.
 *
 * The name is taken from `nameOverride` if given, else the JSON's `name` field.
 * The id is taken from the JSON's numeric `id` field if present, else `fallbackId`.
 * The full pasted JSON text is stored verbatim as `cohortDefinition` (what the
 * Strategus spec embeds), so the caller pastes whatever the backend expects.
 */
export function parseManualCohort(
  jsonText: string,
  nameOverride: string,
  fallbackId: number
): ParseManualCohortResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    return { ok: false, error: `Invalid JSON: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: 'Cohort JSON must be an object.' };
  }
  const obj = parsed as Record<string, unknown>;
  const name = nameOverride.trim() || (typeof obj.name === 'string' ? obj.name.trim() : '');
  if (!name) {
    return { ok: false, error: 'Provide a name, or include a "name" field in the cohort JSON.' };
  }
  const id = typeof obj.id === 'number' && Number.isFinite(obj.id) ? obj.id : fallbackId;
  return {
    ok: true,
    cohort: { cohortId: id, cohortName: name, subjectCount: null, cohortDefinition: jsonText },
  };
}
