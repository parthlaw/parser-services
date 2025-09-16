import { z } from "zod";

export const createJobSchema = z.object({
    sourceKey: z.string(),
    filename: z.string(),
    job_id: z.string(),
});

export const getResultsSchema = z.object({
    offset: z.string().optional().transform(val => val ? parseInt(val, 10) : 0),
    limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 100)
});
export type CreateJobSchema = z.infer<typeof createJobSchema>;
export type GetResultsSchema = z.infer<typeof getResultsSchema>;