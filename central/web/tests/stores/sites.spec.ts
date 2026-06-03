import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useSitesStore } from '../../src/stores/sites';
import type { ApiClient } from '../../src/api/client';

beforeEach(() => setActivePinia(createPinia()));

function fakeApi(overrides: Partial<ApiClient>): ApiClient {
  return overrides as unknown as ApiClient;
}

describe('sites store', () => {
  it('fetchAll loads sites', async () => {
    const get = vi.fn().mockResolvedValue([{ siteId: 's1', name: 'A' }]);
    const store = useSitesStore(fakeApi({ get }));
    await store.fetchAll();
    expect(store.sites).toHaveLength(1);
    expect(get).toHaveBeenCalledWith('/sites');
  });

  it('register posts and exposes the one-time secret', async () => {
    const post = vi
      .fn()
      .mockResolvedValue({ siteId: 's2', name: 'B', clientId: 'cid', clientSecret: 'sec' });
    const get = vi.fn().mockResolvedValue([]);
    const store = useSitesStore(fakeApi({ post, get }));
    const created = await store.register({ name: 'B', contact: 'b@x.org' });
    expect(created.clientSecret).toBe('sec');
    expect(post).toHaveBeenCalledWith('/sites', { name: 'B', contact: 'b@x.org' });
  });

  it('approve() POSTs to the approve route then refreshes', async () => {
    const calls: string[] = [];
    const get = vi.fn().mockImplementation(async (p: string) => { calls.push(`GET ${p}`); return []; });
    const post = vi.fn().mockImplementation(async (p: string) => { calls.push(`POST ${p}`); return {}; });
    const store = useSitesStore(fakeApi({ get, post }));
    await store.approve('s1');
    expect(calls).toContain('POST /sites/s1/approve');
    expect(calls).toContain('GET /sites');
  });
});
