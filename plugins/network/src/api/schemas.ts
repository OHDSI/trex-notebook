import { z } from 'zod';

export const initiateSubmissionSchema = z.object({
  files: z
    .array(
      z.object({
        filename: z
          .string()
          .trim()
          .min(1)
          .regex(/\.db(\.gz)?$/, 'must be a .db or .db.gz file')
          .regex(/^[A-Za-z0-9._-]+$/, 'invalid filename'),
      }),
    )
    .min(1)
    .max(50),
});

export type InitiateSubmissionInput = z.infer<typeof initiateSubmissionSchema>;
