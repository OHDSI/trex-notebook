import { describe, it, expect, vi } from 'vitest';
import { HadesClient } from '../src/api/hadesClient';

describe('strategus HadesClient.execute', () => {
  it('POSTs spec + cdmSchema + envName and returns jobId', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ jobId: 'run1' }) });
    vi.stubGlobal('fetch', fetchMock);
    const c = new HadesClient('http://x/plugins/hades-api/hades-api');
    const id = await c.execute({ spec: { a: 1 }, cdmSchema: 'cdm', envName: 'study1', name: 't' });
    expect(id).toBe('run1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://x/plugins/hades-api/hades-api/jobs');
    expect(JSON.parse(init.body)).toMatchObject({ cdmSchema: 'cdm', envName: 'study1' });
  });

  it('listEnvs GETs the envs endpoint and returns the array', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ envs: [{ envName: 'study1', path: '/e/study1' }] }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const c = new HadesClient('http://x/plugins/hades-api/hades-api');
    const envs = await c.listEnvs();
    expect(fetchMock).toHaveBeenCalledWith(
      'http://x/plugins/hades-api/hades-api/envs',
      expect.any(Object)
    );
    expect(envs).toEqual([{ envName: 'study1', path: '/e/study1' }]);
  });
});

describe('strategus HadesClient auth', () => {
  it('sends the host IdP token as-is, without a /trex-token exchange', async () => {
    const { setAuthToken } = await import('../src/api/authToken');
    const idpToken = [
      btoa(JSON.stringify({ alg: 'RS256' })),
      btoa(JSON.stringify({ sub: 'u1', aud: 'https://idp', exp: Math.floor(Date.now() / 1000) + 3600 })),
      'sig',
    ].join('.');
    setAuthToken(idpToken);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ envs: [] }) });
    vi.stubGlobal('fetch', fetchMock);
    await new HadesClient('http://x/hades-api').listEnvs();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${idpToken}`);
    setAuthToken(null);
  });
});
