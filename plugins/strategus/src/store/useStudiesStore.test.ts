// @vitest-environment jsdom
// The default project environment is 'node' (no DOM globals); this file's
// migration tests need a real `localStorage`, so jsdom is opted in locally.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

const request = vi.fn();
vi.mock('../api/graphqlClient', () => ({
  GraphqlClient: vi.fn().mockImplementation(() => ({ request })),
  defaultGraphqlEndpoint: () => 'http://g/graphql',
}));
// serializeSpec needs the full strategus snapshot; stub it so save/delete can be
// tested with a lightweight editor stub.
vi.mock('../services/SpecSerializer', () => ({
  serializeSpec: () => ({ moduleSpecifications: [], sharedResources: [] }),
}));

import { useStudiesStore } from './useStudiesStore';
import { useStrategusStore } from './useStrategusStore';
import { deserializeSpec, parseTciRestriction } from '../services/SpecDeserializer';
import type { serializeSpec as SerializeSpecFn } from '../services/SpecSerializer';

describe('useStudiesStore (GraphQL-backed)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    request.mockReset();
    localStorage.clear();
  });

  it('saveCurrent CREATEs when no rowId, tracks it, UPDATEs after', async () => {
    request.mockResolvedValueOnce({
      createNotebookAnalysisDefinition: { notebookAnalysisDefinition: { rowId: 'R1' } },
    });
    const s = useStudiesStore();
    const strat = useStrategusStore();
    strat.studyName = 'A';
    const rowId = await s.saveCurrent();
    expect(rowId).toBe('R1');
    expect(s.currentRowId).toBe('R1');
    expect(request.mock.calls[0][0]).toContain('createNotebookAnalysisDefinition');

    request.mockResolvedValueOnce({ updateNotebookAnalysisDefinitionByRowId: { clientMutationId: null } });
    await s.saveCurrent();
    expect(request.mock.calls[1][0]).toContain('updateNotebookAnalysisDefinitionByRowId');
  });

  it('deleteCurrent soft-deletes (patch deletedAt) then closes', async () => {
    const s = useStudiesStore();
    s.currentRowId = 'R1';
    s.mode = 'editor';
    request.mockResolvedValueOnce({ updateNotebookAnalysisDefinitionByRowId: { clientMutationId: null } });
    await s.deleteCurrent();
    const [q, vars] = request.mock.calls[0];
    expect(q).toContain('updateNotebookAnalysisDefinitionByRowId');
    expect(vars.patch).toHaveProperty('deletedAt');
    expect(s.mode).toBe('list');
    expect(s.currentRowId).toBeNull();
  });

  it('listStudies filters soft-deleted', async () => {
    request.mockResolvedValueOnce({
      allNotebookAnalysisDefinitions: {
        nodes: [
          { rowId: 'R1', name: 'A', description: '', updatedAt: '2026-01-02', deletedAt: null },
          { rowId: 'R2', name: 'B', description: '', updatedAt: '2026-01-01', deletedAt: '2026-01-03' },
        ],
      },
    });
    const out = await useStudiesStore().listStudies();
    expect(out.map((s) => s.rowId)).toEqual(['R1']);
  });

  it('listStudies migrates un-migrated legacy localStorage studies once, then clears the key', async () => {
    localStorage.setItem(
      'strategus-plugin:studies',
      JSON.stringify([
        { name: 'Legacy A', description: 'old', state: { moduleSpecifications: [] } },
        { name: 'Already migrated', description: '', serverId: 'srv-9', state: {} },
      ])
    );
    request
      .mockResolvedValueOnce({
        createNotebookAnalysisDefinition: { notebookAnalysisDefinition: { rowId: 'NEW1' } },
      })
      .mockResolvedValueOnce({ allNotebookAnalysisDefinitions: { nodes: [] } });

    const out = await useStudiesStore().listStudies();

    expect(request.mock.calls[0][0]).toContain('createNotebookAnalysisDefinition');
    expect(request.mock.calls[0][1]).toMatchObject({ name: 'Legacy A', description: 'old' });
    expect(request).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem('strategus-plugin:studies')).toBeNull();
    expect(out).toEqual([]);
  });

  it('listStudies migration failure is swallowed and does not break listing', async () => {
    localStorage.setItem('strategus-plugin:studies', '{not json');
    request.mockResolvedValueOnce({ allNotebookAnalysisDefinitions: { nodes: [] } });

    const out = await useStudiesStore().listStudies();

    expect(out).toEqual([]);
    expect(request).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('strategus-plugin:studies')).toBeNull();
  });
});

// Decision D1 gate: persisting only `spec` (not the editor's live `state`) is
// lossless iff serialize -> deserialize -> serialize is a fixed point. This
// module-level test file stubs SpecSerializer for the save/delete suite above,
// so pull in the real implementation via importActual to exercise genuine
// serializer/deserializer logic instead of the stub.
describe('spec round-trip is lossless (D1)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('spec survives serialize -> deserialize -> serialize unchanged', async () => {
    const { serializeSpec } = await vi.importActual<{ serializeSpec: typeof SerializeSpecFn }>(
      '../services/SpecSerializer'
    );
    const strategus = useStrategusStore();

    // Study metadata
    strategus.studyName = 'RT Gate Study';
    strategus.description = 'Exercises every serializer section for the D1 gate';
    strategus.studyStartDate = '2015-01-01';
    strategus.studyEndDate = '2020-12-31';

    // Cohorts across all roles
    strategus.cohorts = [
      { cohortId: 1, cohortName: 'Target', role: 'Target', subjectCount: 1000, cohortDefinition: '{"t":1}' },
      { cohortId: 2, cohortName: 'Comparator', role: 'Comparator', subjectCount: 900, cohortDefinition: '{"c":1}' },
      { cohortId: 3, cohortName: 'Outcome', role: 'Outcome', subjectCount: 50, cohortDefinition: '{"o":1}' },
    ];

    // Comparisons (TCI), including a real age/gender restriction and an
    // excluded-covariate override, so the subset-generation and CohortMethod/
    // SCCS covariate paths are all exercised.
    strategus.comparisons = [
      {
        targetId: 1,
        comparatorId: 2,
        indicationId: null,
        genderConceptIds: [8507],
        minAge: 18,
        maxAge: 65,
        excludedCovariateConceptIds: [12345],
      },
    ];

    // Outcomes and negative controls
    strategus.outcomes = [{ cohortId: 3, cleanWindow: 30 }];
    strategus.negativeControls = [
      { cohortId: 99, cohortName: 'NC 1', outcomeConceptId: 111, domainId: 'Condition' },
    ];
    strategus.ncOccurrenceType = 'all';
    strategus.ncDetectOnDescendants = false;

    // Time-at-risk
    strategus.timeAtRisk = [
      { label: 'On treatment', riskWindowStart: 1, startAnchor: 'cohort start', riskWindowEnd: 0, endAnchor: 'cohort end' },
    ];

    // Enable a spread of analysis modules (CohortDiagnostics/Characterization/
    // CohortIncidence/CohortMethod/SCCS are already enabled by default)
    strategus.cohortMethodSettings.analyses[0].psAdjustmentMethod = 'matching';
    strategus.cohortMethodSettings.useEmpiricalCalibration = true;
    strategus.sccsSettings.useEmpiricalCalibration = true;
    strategus.characterizationSettings.includeTargetBaseline = true;
    strategus.characterizationSettings.includeRiskFactors = true;

    // serializeSpec/deserializeSpec duck-type the store against their own
    // structural snapshot interfaces; the Pinia store satisfies them at runtime.
    const editor = strategus as unknown as Parameters<typeof serializeSpec>[0];
    const spec1 = serializeSpec(editor);
    deserializeSpec(spec1, editor as unknown as Parameters<typeof deserializeSpec>[1]);
    const spec2 = serializeSpec(editor);

    expect(spec2).toEqual(spec1);
  });
});

// Unit coverage for the TCI restriction reader that backs the D1 round-trip.
// The serializer encodes a comparison's age/gender restriction into a subset
// def's DemographicSubsetOperator entries and OMITS the gender operator when the
// TCI is unrestricted — which the UI represents as BOTH genders [8507, 8532].
// So "no gender operator" must read back as both genders, not an empty selection.
describe('parseTciRestriction (D1 gender/age read-back)', () => {
  const BOTH_GENDERS = [8507, 8532];
  const limitOp = { subsetType: 'LimitSubsetOperator', priorTime: 365, followUpTime: 1, limitTo: 'firstEver' };

  it('reads a gender-only restriction and leaves ages null', () => {
    const r = parseTciRestriction([limitOp, { subsetType: 'DemographicSubsetOperator', gender: [8507] }]);
    expect(r).toEqual({ genderConceptIds: [8507], minAge: null, maxAge: null });
  });

  it('reads an age-only restriction and defaults gender to both', () => {
    const r = parseTciRestriction([limitOp, { subsetType: 'DemographicSubsetOperator', ageMin: 18, ageMax: 65 }]);
    expect(r).toEqual({ genderConceptIds: BOTH_GENDERS, minAge: 18, maxAge: 65 });
  });

  it('reads minAge without maxAge (maxAge stays null)', () => {
    const r = parseTciRestriction([limitOp, { subsetType: 'DemographicSubsetOperator', ageMin: 40 }]);
    expect(r).toEqual({ genderConceptIds: BOTH_GENDERS, minAge: 40, maxAge: null });
  });

  it('defaults an unrestricted TCI (no demographic operator) to both genders', () => {
    const r = parseTciRestriction([limitOp]);
    expect(r).toEqual({ genderConceptIds: BOTH_GENDERS, minAge: null, maxAge: null });
  });

  it('reads combined gender + age restriction across separate operators', () => {
    const r = parseTciRestriction([
      limitOp,
      { subsetType: 'DemographicSubsetOperator', gender: [8532] },
      { subsetType: 'DemographicSubsetOperator', ageMin: 0, ageMax: 17 },
    ]);
    expect(r).toEqual({ genderConceptIds: [8532], minAge: 0, maxAge: 17 });
  });

  it('returns graceful defaults for absent/malformed operators without crashing', () => {
    expect(parseTciRestriction([])).toEqual({ genderConceptIds: BOTH_GENDERS, minAge: null, maxAge: null });
    // Non-demographic / unknown operators are ignored; malformed field types are skipped.
    const r = parseTciRestriction([
      { subsetType: 'CohortSubsetOperator', cohortIds: [7] } as unknown as Record<string, unknown>,
      { subsetType: 'DemographicSubsetOperator', gender: 'nonsense', ageMin: 'x' } as unknown as Record<string, unknown>,
      {} as unknown as Record<string, unknown>,
    ]);
    expect(r).toEqual({ genderConceptIds: BOTH_GENDERS, minAge: null, maxAge: null });
  });
});
