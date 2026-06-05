import { describe, it, expect } from 'vitest';
import {
  createSiteSchema,
  initiateSubmissionSchema,
  createStudySchema,
  signupSchema,
} from '../src/schemas';

describe('createSiteSchema', () => {
  it('accepts a valid body', () => {
    const r = createSiteSchema.safeParse({ name: 'Site A', contact: 'a@x.org' });
    expect(r.success).toBe(true);
  });
  it('rejects empty name', () => {
    const r = createSiteSchema.safeParse({ name: '', contact: 'a@x.org' });
    expect(r.success).toBe(false);
  });
});

describe('createStudySchema', () => {
  it('requires name and version', () => {
    expect(createStudySchema.safeParse({ description: 'd' }).success).toBe(false);
    expect(
      createStudySchema.safeParse({ name: 'S', description: '', version: '1.0.0' }).success,
    ).toBe(true);
  });
});

describe('initiateSubmissionSchema', () => {
  it('requires at least one .db file', () => {
    expect(initiateSubmissionSchema.safeParse({ files: [] }).success).toBe(false);
  });
  it('rejects non-.db filenames', () => {
    const r = initiateSubmissionSchema.safeParse({ files: [{ filename: 'results.csv' }] });
    expect(r.success).toBe(false);
  });
  it('accepts .db filenames', () => {
    const r = initiateSubmissionSchema.safeParse({ files: [{ filename: 'results.db' }] });
    expect(r.success).toBe(true);
  });
  it('accepts .db.gz filenames', () => {
    const r = initiateSubmissionSchema.safeParse({ files: [{ filename: 'results.db.gz' }] });
    expect(r.success).toBe(true);
  });
  it('still rejects non-db filenames', () => {
    const r = initiateSubmissionSchema.safeParse({ files: [{ filename: 'results.zip' }] });
    expect(r.success).toBe(false);
  });
  it('rejects unsafe characters even with a .db.gz suffix', () => {
    const r = initiateSubmissionSchema.safeParse({ files: [{ filename: '../evil.db.gz' }] });
    expect(r.success).toBe(false);
  });
});

describe('signupSchema', () => {
  it('accepts name + contact', () => {
    expect(signupSchema.safeParse({ name: 'Site A', contact: 'a@x.org' }).success).toBe(true);
  });
  it('rejects empty name', () => {
    expect(signupSchema.safeParse({ name: '', contact: 'a@x.org' }).success).toBe(false);
  });
  it('rejects missing contact', () => {
    expect(signupSchema.safeParse({ name: 'A' }).success).toBe(false);
  });
});
