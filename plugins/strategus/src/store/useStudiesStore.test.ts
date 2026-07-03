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
import { deserializeSpec } from '../services/SpecDeserializer';
import type { serializeSpec as SerializeSpecFn } from '../services/SpecSerializer';

const strat = { studyName: 'My Study', description: 'desc', snapshot: () => ({ a: 1 }) };
const createPayload = {
  createNotebookAnalysisDefinition: { notebookAnalysisDefinition: { rowId: 'srv-1' } },
};

describe('useStudiesStore save/delete (server upsert)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    request.mockReset();
    request.mockResolvedValue(createPayload);
  });

  it('saveCurrent creates a server definition when none exists and tracks the rowId', async () => {
    const store = useStudiesStore();
    const rec = await store.saveCurrent(strat);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][0]).toContain('createNotebookAnalysisDefinition');
    expect(store.currentServerId).toBe('srv-1');
    expect(store.studies).toHaveLength(1);
    expect(rec.serverId).toBe('srv-1');
    expect(rec.name).toBe('My Study');
  });

  it('saveCurrent updates (not creates) once a server id is known — no duplicate', async () => {
    const store = useStudiesStore();
    await store.saveCurrent(strat); // create
    await store.saveCurrent(strat); // update
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[1][0]).toContain('updateNotebookAnalysisDefinitionByRowId');
    expect(request.mock.calls[1][0]).not.toContain('createNotebook');
    expect(store.studies).toHaveLength(1);
  });

  it('deleteCurrent deletes the server definition and removes the local study', async () => {
    const store = useStudiesStore();
    await store.saveCurrent(strat);
    await store.deleteCurrent();
    const last = String(request.mock.calls[request.mock.calls.length - 1][0]);
    expect(last).toContain('deleteNotebookAnalysisDefinitionByRowId');
    expect(store.studies).toHaveLength(0);
    expect(store.mode).toBe('list');
    expect(store.currentServerId).toBeNull();
  });

  it('first save issues no update/delete mutation', async () => {
    const store = useStudiesStore();
    await store.saveCurrent(strat);
    expect(request.mock.calls.every((c) => !/update|delete/i.test(String(c[0])))).toBe(true);
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
