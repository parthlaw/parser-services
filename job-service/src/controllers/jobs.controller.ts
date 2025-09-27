import { JobService } from '@/services/job.service';
import {
  createJobSchema,
  getResultsSchema,
  getJobDownloadUrlSchema,
  getJobDownloadUrlParamsSchema,
  jobIdParamSchema,
  jobListQuerySchema,
} from '@/types/jobs.schema';
import ApiResponseHandler from '@/utils/apiResponseHandler';
import { Request, Response } from 'express';
import { asyncHandler } from '@/middleware/errorHandler';
import { NotFoundError, ValidationError } from '@/utils/errors';
import { SupportedDownloadFormat } from '@/types/models';
import logger from '@/utils/logger';

export const getJobService = (userId?: string): JobService => {
  return new JobService(userId);
};

export const createJob = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { sourceKey, filename, job_id } = createJobSchema.parse(req.body);
  const job = await getJobService(req.user?.id as string).createJob({
    sourceKey,
    user_id: req.user?.id as string,
    filename,
    job_id,
  });
  ApiResponseHandler.created(res, job, 'Job created successfully');
});

export const getJob = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = jobIdParamSchema.parse(req.params);
  const jobService = getJobService(req.user?.id as string);
  const job = await jobService.getJob(id);

  if (!job) {
    ApiResponseHandler.notFound(res, 'Job not found');
    return;
  }

  ApiResponseHandler.success(res, job, 'Job fetched successfully');
});

export const getResults = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    const { page, limit } = getResultsSchema.parse(req.query);
    const { id } = req.params;
    const pagination = { offset: page * limit, limit };
    const results = await getJobService(req.user?.id as string).getResults(id, pagination);
    ApiResponseHandler.success(res, results, 'Results fetched successfully');
  } catch (error) {
    if (error instanceof NotFoundError) {
      ApiResponseHandler.notFound(res, error.message);
    } else {
      ApiResponseHandler.error(res, error, 'An error occurred');
    }
  }
});

export const getJobs = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const filters = jobListQuerySchema.parse(req.query);
  const jobService = getJobService(req.user?.id as string);
  const jobList = await jobService.getJobs(filters);
  ApiResponseHandler.success(res, jobList, 'Jobs fetched successfully');
});

export const getJobDownloadUrl = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { format } = getJobDownloadUrlSchema.parse(req.query);
      const { id } = getJobDownloadUrlParamsSchema.parse(req.params);
      const jobDownloadUrl = await getJobService(req.user?.id as string).getJobDownloadUrl({
        jobId: id,
        format: format as SupportedDownloadFormat,
      });
      ApiResponseHandler.success(
        res,
        { downloadUrl: jobDownloadUrl },
        'Job download URL fetched successfully'
      );
    } catch (error: any) {
      logger.error(error);
      if (error instanceof ValidationError) {
        ApiResponseHandler.badRequest(res, error.message, error.errorCode);
      } else {
        ApiResponseHandler.error(res, error, 'An error occurred');
      }
    }
  }
);
