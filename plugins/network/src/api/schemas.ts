import { z } from 'zod';

export const initiateSubmissionSchema = z.object({
  files: z
    .array(
      z.object({
        filename: z
          .string()
          .trim()
          .min(1)
          .regex(/\.db$/, 'must be a .db file')
          .regex(/^[A-Za-z0-9._-]+$/, 'invalid filename'),
      }),
    )
    .min(1)
    .max(50),
});

export type InitiateSubmissionInput = z.infer<typeof initiateSubmissionSchema>;
