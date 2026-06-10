import { describe, it, expect } from 'vitest';
import { overlay } from '../src/services/mergeSettings';
describe('overlay', () => {
  it('keeps base keys, replaces managed keys, recurses plain objects', () => {
    const base = { a: 1, nested: { keep: 9, managed: 0 } };
    const managed = { nested: { managed: 5 } };
    expect(overlay(base, managed)).toEqual({ a: 1, nested: { keep: 9, managed: 5 } });
  });
});
