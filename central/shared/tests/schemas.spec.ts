import { describe, it, expect } from 'vitest';
import {
  createSiteSchema,
  initiateSubmissionSchema,
  createStudySchema,
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
});
