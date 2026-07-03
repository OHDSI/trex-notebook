import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isNetworkActive, isCoordinatorConfigured, publishStudy } from './networkClient';

describe('isNetworkActive', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('true for 200 + status active', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ status: 200, ok: true, json: async () => ({ status: 'active' }) })
    );
    await expect(isNetworkActive('http://n/network-api')).resolves.toBe(true);
  });

  it('false for 503', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ status: 503, ok: false, json: async () => ({ error: 'NOT_CONFIGURED' }) })
    );
    await expect(isNetworkActive('http://n/network-api')).resolves.toBe(false);
  });

  it('false for 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 404, ok: false, json: async () => ({}) }));
    await expect(isNetworkActive('http://n/network-api')).resolves.toBe(false);
  });

  it('false on network error, never throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(isNetworkActive('http://n/network-api')).resolves.toBe(false);
  });

  it('false for 200 with a non-active status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ status: 200, ok: true, json: async () => ({ status: 'pending' }) })
    );
    await expect(isNetworkActive('http://n/network-api')).resolves.toBe(false);
  });
});

describe('isCoordinatorConfigured', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('true for 200 + configured true', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ status: 200, ok: true, json: async () => ({ configured: true }) })
    );
    await expect(isCoordinatorConfigured('http://n/network-api')).resolves.toBe(true);
  });

  it('false for 200 + configured false', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ status: 200, ok: true, json: async () => ({ configured: false }) })
    );
    await expect(isCoordinatorConfigured('http://n/network-api')).resolves.toBe(false);
  });

  it('false for 503', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ status: 503, ok: false, json: async () => ({ error: 'COORDINATOR_NOT_CONFIGURED' }) })
    );
    await expect(isCoordinatorConfigured('http://n/network-api')).resolves.toBe(false);
  });

  it('false on network error, never throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(isCoordinatorConfigured('http://n/network-api')).resolves.toBe(false);
  });
});

describe('publishStudy', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('issues create -> 2 presigned PUTs -> publish, in order', async () => {
    const fetchMock = vi.fn();
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          study: { studyId: 'S1' },
          uploads: {
            strategus: { filename: 'strategus.json', url: 'https://s3/strategus', s3Key: 'k1' },
            renvLock: { filename: 'renv.lock', url: 'https://s3/renv', s3Key: 'k2' },
          },
        }),
      })
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);

    await publishStudy(
      {
        name: 'Study A',
        description: 'desc',
        version: '1.0.0',
        specJson: '{"spec":true}',
        renvLock: 'lockfile-content',
      },
      'http://n/network-api'
    );

    expect(fetchMock).toHaveBeenCalledTimes(4);

    const [createUrl, createInit] = fetchMock.mock.calls[0];
    expect(createUrl).toBe('http://n/network-api/studies');
    expect(createInit.method).toBe('POST');
    expect(JSON.parse(createInit.body)).toEqual({ name: 'Study A', description: 'desc', version: '1.0.0' });

    const [strategusUrl, strategusInit] = fetchMock.mock.calls[1];
    expect(strategusUrl).toBe('https://s3/strategus');
    expect(strategusInit.method).toBe('PUT');
    expect(strategusInit.body).toBe('{"spec":true}');
    expect(strategusInit.headers).toBeUndefined();

    const [renvUrl, renvInit] = fetchMock.mock.calls[2];
    expect(renvUrl).toBe('https://s3/renv');
    expect(renvInit.method).toBe('PUT');
    expect(renvInit.body).toBe('lockfile-content');
    expect(renvInit.headers).toBeUndefined();

    const [publishUrl, publishInit] = fetchMock.mock.calls[3];
    expect(publishUrl).toBe('http://n/network-api/studies/S1/publish');
    expect(publishInit.method).toBe('POST');
  });

  it('throws a useful message when create fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(
      publishStudy(
        { name: 'A', description: '', version: '1.0.0', specJson: '{}', renvLock: 'x' },
        'http://n/network-api'
      )
    ).rejects.toThrow(/create study failed: 500/);
  });
});
