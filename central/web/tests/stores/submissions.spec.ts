import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useSubmissionsStore } from '../../src/stores/submissions';
import type { ApiClient } from '../../src/api/client';

beforeEach(() => setActivePinia(createPinia()));
const fakeApi = (o: Partial<ApiClient>) => o as unknown as ApiClient;

describe('submissions store', () => {
  it('fetchByStudy loads submissions for a study', async () => {
    const get = vi.fn().mockResolvedValue([{ studyId: 'st1', siteId: 'a', version: 1 }]);
    const store = useSubmissionsStore(fakeApi({ get }));
    await store.fetchByStudy('st1');
    expect(get).toHaveBeenCalledWith('/studies/st1/submissions');
    expect(store.items).toHaveLength(1);
  });

  it('downloadUrls fetches a submission with presigned GET urls', async () => {
    const get = vi.fn().mockResolvedValue({
      studyId: 'st1', siteId: 'a', version: 1,
      urls: [{ filename: 'r.db', url: 'https://get/r.db' }],
    });
    const store = useSubmissionsStore(fakeApi({ get }));
    const urls = await store.downloadUrls('st1__a__1');
    expect(get).toHaveBeenCalledWith('/submissions/st1__a__1');
    expect(urls[0].url).toBe('https://get/r.db');
  });
});
