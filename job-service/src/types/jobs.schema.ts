import { z } from 'zod';

export const createJobSchema = z.object({
  sourceKey: z.string(),
  filename: z.string(),
  job_id: z.string(),
});

export const getResultsSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val) : 100)),
});
export const getJobDownloadUrlSchema = z.object({
  format: z.string(),
});
export const getJobDownloadUrlParamsSchema = z.object({
  id: z.string(),
});

export const jobIdParamSchema = z.object({
  id: z.string().uuid('Invalid job ID format'),
});

export const jobListQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? Math.max(parseInt(val), 1) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => Math.min(val ? parseInt(val) : 10, 100)),
  status: z.string().optional(),
  filename: z.string().optional(),
});
export type CreateJobSchema = z.infer<typeof createJobSchema>;
export type GetResultsSchema = z.infer<typeof getResultsSchema>;
export type GetJobDownloadUrlSchema = z.infer<typeof getJobDownloadUrlSchema>;
export type GetJobDownloadUrlParamsSchema = z.infer<typeof getJobDownloadUrlParamsSchema>;
