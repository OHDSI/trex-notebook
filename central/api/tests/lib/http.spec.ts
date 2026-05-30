import { describe, it, expect } from 'vitest';
import { ok, created, noContent, errorResult } from '../../src/lib/http';
import { ApiError } from '../../src/lib/errors';

describe('http result helpers', () => {
  it('ok() returns 200 with JSON body', () => {
    const r = ok({ hello: 'world' });
    expect(r.statusCode).toBe(200);
    expect(JSON.parse(r.body)).toEqual({ hello: 'world' });
    expect(r.headers['content-type']).toBe('application/json');
  });
  it('created() returns 201', () => {
    expect(created({ id: 'x' }).statusCode).toBe(201);
  });
  it('noContent() returns 204 with empty body', () => {
    const r = noContent();
    expect(r.statusCode).toBe(204);
    expect(r.body).toBe('');
  });
  it('errorResult() maps ApiError to its status and envelope', () => {
    const r = errorResult(new ApiError(404, 'STUDY_NOT_FOUND', 'nope'));
    expect(r.statusCode).toBe(404);
    expect(JSON.parse(r.body)).toEqual({
      error: { code: 'STUDY_NOT_FOUND', message: 'nope', details: undefined },
    });
  });
  it('errorResult() maps unknown errors to 500 INTERNAL', () => {
    const r = errorResult(new Error('boom'));
    expect(r.statusCode).toBe(500);
    expect(JSON.parse(r.body).error.code).toBe('INTERNAL');
  });
});
