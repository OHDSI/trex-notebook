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
