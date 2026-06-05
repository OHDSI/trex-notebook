import { z } from 'zod';

const nonEmpty = z.string().trim().min(1);

export const createSiteSchema = z.object({
  name: nonEmpty,
  contact: z.string().trim().email().or(nonEmpty),
});

export const signupSchema = z.object({
  name: nonEmpty,
  contact: z.string().trim().email().or(nonEmpty),
});

export const updateSiteSchema = z
  .object({
    name: nonEmpty.optional(),
    status: z.enum(['active', 'disabled']).optional(),
  })
  .refine((b) => b.name !== undefined || b.status !== undefined, {
    message: 'at least one field required',
  });

export const createOperatorSchema = z.object({ email: z.string().trim().email() });

export const createStudySchema = z.object({
  name: nonEmpty,
  description: z.string().default(''),
  version: nonEmpty,
});

export const updateStudySchema = z
  .object({
    name: nonEmpty.optional(),
    description: z.string().optional(),
    version: nonEmpty.optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: 'at least one field required' });

const dbFile = z.object({
  filename: z
    .string()
    .trim()
    .min(1)
    .regex(/\.db(\.gz)?$/, 'must be a .db or .db.gz file')
    .regex(/^[A-Za-z0-9._-]+$/, 'invalid filename'),
});

export const initiateSubmissionSchema = z.object({
  files: z.array(dbFile).min(1).max(50),
});
