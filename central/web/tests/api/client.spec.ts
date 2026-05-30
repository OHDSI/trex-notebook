import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClient } from '../../src/api/client';

beforeEach(() => vi.restoreAllMocks());

describe('ApiClient', () => {
  it('attaches the bearer token and parses JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{ siteId: 's1' }]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const c = new ApiClient('https://api', () => 'tok', fetchMock);
    const out = await c.get<{ siteId: string }[]>('/sites');
    expect(out).toEqual([{ siteId: 's1' }]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api/sites');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer tok');
  });

  it('throws an ApiClientError carrying the error envelope', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'FORBIDDEN', message: 'no' } }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const c = new ApiClient('https://api', () => 'tok', fetchMock);
    await expect(c.get('/sites')).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });
});
