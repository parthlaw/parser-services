import { JobService } from "@/services/job.service";
import { createJobSchema, getResultsSchema } from "@/types/jobs.schema";
import ApiResponseHandler from "@/utils/apiResponseHandler";
import { Request, Response } from "express";
import { asyncHandler } from "@/middleware/errorHandler";
import { NotFoundError } from "@/utils/errors";

export const getJobService = (userId?: string): JobService => {
    return new JobService(userId);
}

export const createJob = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { sourceKey, filename, job_id } = createJobSchema.parse(req.body);
    const job = await getJobService(req.user?.id as string).createJob({ sourceKey, user_id: req.user?.id as string, filename, job_id });
    ApiResponseHandler.created(res, job, "Job created successfully");
})

export const getJob = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const job = await getJobService(req.user?.id as string).getJob(id, req.user?.id as string);
    ApiResponseHandler.success(res, job, "Job fetched successfully");
})

export const getResults = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
        const { page, limit } = getResultsSchema.parse(req.query);
        const { id } = req.params;
        const pagination = { offset: page * limit, limit };
        const results = await getJobService(req.user?.id as string).getResults(id, req.user?.id as string, pagination);
        ApiResponseHandler.success(res, results, "Results fetched successfully");
    } catch (error) {
        if (error instanceof NotFoundError) {
            ApiResponseHandler.notFound(res, error.message);
        } else {
            ApiResponseHandler.error(res, error, "An error occurred");
        }
    }
})

export const getJobs = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const jobs = await getJobService(req.user?.id as string).getJobs(req.user?.id as string);
    ApiResponseHandler.success(res, jobs, "Jobs fetched successfully");
})
