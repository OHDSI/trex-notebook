import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useNetworkStore } from '../../src/store/useNetworkStore';
import type { ApiClient } from '../../src/api/client';
import type { HadesJobDetail } from '../../src/api/hadesTypes';

beforeEach(() => setActivePinia(createPinia()));
const fakeApi = (o: Partial<ApiClient>) => o as unknown as ApiClient;

describe('useNetworkStore', () => {
  it('loadStudies fetches published studies', async () => {
    const get = vi.fn().mockResolvedValue([{ studyId: 's1', status: 'published' }]);
    const store = useNetworkStore(fakeApi({ get }));
    await store.loadStudies();
    expect(get).toHaveBeenCalledWith('/studies');
    expect(store.studies).toHaveLength(1);
  });

  it('rejects a non-.db filename before calling the API', async () => {
    const post = vi.fn();
    const store = useNetworkStore(fakeApi({ post }));
    const file = new File(['x'], 'results.csv');
    await expect(store.submit('s1', [file])).rejects.toThrow();
    expect(post).not.toHaveBeenCalled();
  });

  it('submit initiates, uploads each file, then completes', async () => {
    const post = vi
      .fn()
      .mockResolvedValueOnce({
        studyId: 's1', siteId: 'site-1', version: 2, status: 'pending', files: [],
        submittedAt: '', submittedBy: '',
        urls: [{ filename: 'r.db', url: 'https://put/r.db' }],
      })
      .mockResolvedValueOnce({ studyId: 's1', siteId: 'site-1', version: 2, status: 'complete' });
    const putFile = vi.fn().mockResolvedValue(undefined);
    const store = useNetworkStore(fakeApi({ post }));
    store._putFile = putFile;

    const file = new File(['x'], 'r.db');
    const result = await store.submit('s1', [file]);

    expect(post).toHaveBeenNthCalledWith(1, '/studies/s1/submissions', {
      files: [{ filename: 'r.db' }],
    });
    expect(putFile).toHaveBeenCalledWith('https://put/r.db', file);
    expect(post).toHaveBeenNthCalledWith(2, '/submissions/s1__site-1__2/complete');
    expect(result.status).toBe('complete');
  });

  it('getPackage returns presigned urls', async () => {
    const get = vi.fn().mockResolvedValue({
      studyId: 's1', strategusUrl: 'https://get/strategus', renvLockUrl: 'https://get/renv',
    });
    const store = useNetworkStore(fakeApi({ get }));
    const pkg = await store.getPackage('s1');
    expect(get).toHaveBeenCalledWith('/studies/s1/package');
    expect(pkg.strategusUrl).toBe('https://get/strategus');
  });
});

describe('useNetworkStore submitRun', () => {
  it('initiates, exports via edge fn, then completes', async () => {
    const api = fakeApi({
      post: vi.fn()
        .mockImplementationOnce((_path: string) =>
          Promise.resolve({
            studyId: 's1', siteId: 'site1', version: 2, status: 'pending', files: [],
            submittedAt: 't', submittedBy: 'u',
            urls: [{ filename: 'results.db.gz', url: 'https://s3/put' }],
          }),
        )
        .mockImplementationOnce((_path: string) =>
          Promise.resolve({
            studyId: 's1', siteId: 'site1', version: 2, status: 'complete', files: [],
            submittedAt: 't', submittedBy: 'u',
          }),
        ),
    });
    const store = useNetworkStore(api);
    const exportSpy = vi.fn().mockResolvedValue(undefined);
    store._exportGz.value = exportSpy;

    const sub = await store.submitRun('s1', 'job-123');

    expect(exportSpy).toHaveBeenCalledWith('job-123', 'https://s3/put', undefined);
    expect(sub.status).toBe('complete');
    expect(sub.version).toBe(2);
  });
});

describe('useNetworkStore awaitJob', () => {
  it('resolves on COMPLETED', async () => {
    const store = useNetworkStore();
    store._sleep.value = () => Promise.resolve();
    const seq: HadesJobDetail[] = [
      { jobId: 'j', status: 'RUNNING', currentModule: 'CohortGenerator', modulesCompleted: [], errorMessage: null },
      { jobId: 'j', status: 'COMPLETED', currentModule: null, modulesCompleted: ['CohortGenerator'], errorMessage: null },
    ];
    let i = 0;
    store._hades.value = { execute: vi.fn(), getJob: vi.fn(() => Promise.resolve(seq[i++])) } as never;
    const job = await store.awaitJob('j');
    expect(job.status).toBe('COMPLETED');
  });

  it('throws on FAILED with the error message', async () => {
    const store = useNetworkStore();
    store._sleep.value = () => Promise.resolve();
    store._hades.value = {
      execute: vi.fn(),
      getJob: vi.fn(() => Promise.resolve(
        { jobId: 'j', status: 'FAILED', currentModule: null, modulesCompleted: [], errorMessage: 'boom' },
      )),
    } as never;
    await expect(store.awaitJob('j')).rejects.toThrow('boom');
  });
});
