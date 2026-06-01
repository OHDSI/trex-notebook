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
