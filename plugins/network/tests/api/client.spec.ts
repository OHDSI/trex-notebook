import { describe, it, expect, vi } from 'vitest';
import { ApiClient, ApiClientError } from '../../src/api/client';

describe('ApiClient', () => {
  it('attaches bearer token and parses JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{ studyId: 's1' }]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const c = new ApiClient('https://api', () => 'tok', fetchMock);
    const out = await c.get<{ studyId: string }[]>('/studies');
    expect(out[0].studyId).toBe('s1');
    expect((fetchMock.mock.calls[0][1].headers as Record<string, string>).authorization).toBe(
      'Bearer tok',
    );
  });

  it('throws ApiClientError on non-2xx', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'STUDY_NOT_PUBLISHED', message: 'no' } }), {
        status: 409,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const c = new ApiClient('https://api', () => 'tok', fetchMock);
    await expect(c.get('/studies/x/package')).rejects.toBeInstanceOf(ApiClientError);
  });
});
