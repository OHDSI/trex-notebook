import { describe, it, expect } from 'vitest';
import { initiateSubmissionSchema } from '../../src/api/schemas';

describe('initiateSubmissionSchema (network)', () => {
  it('accepts .db', () => {
    expect(initiateSubmissionSchema.safeParse({ files: [{ filename: 'r.db' }] }).success).toBe(true);
  });
  it('accepts .db.gz', () => {
    expect(initiateSubmissionSchema.safeParse({ files: [{ filename: 'results.db.gz' }] }).success).toBe(true);
  });
  it('rejects .zip', () => {
    expect(initiateSubmissionSchema.safeParse({ files: [{ filename: 'r.zip' }] }).success).toBe(false);
  });
  it('rejects unsafe names', () => {
    expect(initiateSubmissionSchema.safeParse({ files: [{ filename: '../r.db.gz' }] }).success).toBe(false);
  });
});
