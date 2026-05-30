import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useStudiesStore } from '../../src/stores/studies';
import type { ApiClient } from '../../src/api/client';

beforeEach(() => setActivePinia(createPinia()));
const fakeApi = (o: Partial<ApiClient>) => o as unknown as ApiClient;

describe('studies store', () => {
  it('createWithUploads posts metadata then PUTs both artifacts', async () => {
    const post = vi.fn().mockResolvedValue({
      study: { studyId: 'st1', status: 'draft' },
      uploads: {
        strategus: { filename: 'strategus.json', s3Key: 'k1', url: 'https://put/k1' },
        renvLock: { filename: 'renv.lock', s3Key: 'k2', url: 'https://put/k2' },
      },
    });
    const putFile = vi.fn().mockResolvedValue(undefined);
    const store = useStudiesStore(fakeApi({ post }));
    store._putFile = putFile; // injected uploader seam

    const strat = new File(['{}'], 'strategus.json');
    const renv = new File(['{}'], 'renv.lock');
    const study = await store.createWithUploads(
      { name: 'S', description: '', version: '1.0.0' },
      strat,
      renv,
    );
    expect(study.studyId).toBe('st1');
    expect(putFile).toHaveBeenCalledWith('https://put/k1', strat);
    expect(putFile).toHaveBeenCalledWith('https://put/k2', renv);
  });

  it('publish posts to the publish route', async () => {
    const post = vi.fn().mockResolvedValue({ studyId: 'st1', status: 'published' });
    const get = vi.fn().mockResolvedValue([]);
    const store = useStudiesStore(fakeApi({ post, get }));
    await store.publish('st1');
    expect(post).toHaveBeenCalledWith('/studies/st1/publish');
  });
});
