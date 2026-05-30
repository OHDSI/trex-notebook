import { describe, it, expect } from 'vitest';
import { health } from '../../src/handlers/health';

describe('health handler', () => {
  it('returns 200 ok:true', async () => {
    const r = await health();
    expect(r.statusCode).toBe(200);
    expect(JSON.parse(r.body)).toEqual({ ok: true });
  });
});
