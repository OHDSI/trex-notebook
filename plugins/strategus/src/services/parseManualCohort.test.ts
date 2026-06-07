import { describe, it, expect } from 'vitest';
import { parseManualCohort } from './parseManualCohort';

describe('parseManualCohort', () => {
  it('derives name + id from the cohort JSON and stores the JSON as cohortDefinition', () => {
    const json = '{"id": 42, "name": "New users of drug X", "expression": {"ConceptSets": []}}';
    const r = parseManualCohort(json, '', 1);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.cohort.cohortId).toBe(42);
      expect(r.cohort.cohortName).toBe('New users of drug X');
      expect(r.cohort.cohortDefinition).toBe(json);
      expect(r.cohort.subjectCount).toBeNull();
    }
  });

  it('uses the name override over the JSON name', () => {
    const r = parseManualCohort('{"name": "From JSON"}', 'Override', 7);
    expect(r.ok && r.cohort.cohortName).toBe('Override');
  });

  it('falls back to fallbackId when the JSON has no numeric id', () => {
    const r = parseManualCohort('{"name": "X"}', '', 99);
    expect(r.ok && r.cohort.cohortId).toBe(99);
  });

  it('errors on invalid JSON', () => {
    const r = parseManualCohort('{not json', '', 1);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Invalid JSON/);
  });

  it('errors when no name is available', () => {
    const r = parseManualCohort('{"expression": {}}', '', 1);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/name/i);
  });

  it('errors when the JSON is not an object', () => {
    expect(parseManualCohort('[1,2,3]', '', 1).ok).toBe(false);
    expect(parseManualCohort('"a string"', '', 1).ok).toBe(false);
  });
});
