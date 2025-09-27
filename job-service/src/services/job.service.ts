import {
  IJob,
  ICreateJobInput,
  IBankStatementResults,
  IJsonlPaginationOptions,
  JobStatus,
  IDownloadUrlOptions,
  IDownloadUrlResult,
  SupportedDownloadFormat,
  IJobListFilters,
  IJobListResponse,
  IJobListItem,
  IJsonlReadResult,
  IPageCredit,
} from '@/types/models';
import { IJobRepository } from '@/repositories/job.repository';
import { DynamoDBJobRepository } from '@/repositories/dynamodb.job.repository';
import { SupabaseJobRepository } from '@/repositories/supabase.job.repository';
import { IJsonlRepository, JsonlRepository } from '@/repositories/jsonl.repository';
import { downloadFileToDisk, getDownloadUrl, checkFileExists } from '@/resources/s3/operations';
import { getQueueUrl, sendMessage } from '@/resources/sqs/operations';
import { BankStatementDecodeQueueMessage } from '@/types';
import config from '@/config/environment';
import { InternalErrorCodes, NotFoundError, ValidationError } from '@/utils/errors';
import { IPageCreditRepository } from '@/repositories/page-credit.repository';
import { SupabasePageCreditRepository } from '@/repositories/supabase.page-credit.repository';
import { v4 as uuidv4 } from 'uuid';
import logger from '@/utils/logger';

export class JobService {
  private readonly jsonlRepository: IJsonlRepository;
  private readonly jobRepository: IJobRepository;
  private readonly userId: string | null;
  private readonly pageCreditRepository: IPageCreditRepository;
  constructor(userId?: string) {
    this.jobRepository = userId ? new SupabaseJobRepository() : new DynamoDBJobRepository();
    this.jsonlRepository = new JsonlRepository();
    this.userId = userId || null;
    this.pageCreditRepository = new SupabasePageCreditRepository();
  }
  /**
   * Creates a new job for processing a bank statement
   * @param input Job creation input
   * @returns Created job
   */
  async createJob(input: ICreateJobInput): Promise<IJob> {
    // Use Supabase for logged-in users, DynamoDB for anonymous users
    const repository = this.jobRepository;
    const job = await repository.createJob(input);
    const queueMessage: BankStatementDecodeQueueMessage = {
      filename: input.sourceKey,
      mode: 'decode',
      job_id: job.id,
      user_id: input.user_id as string,
      source_key: input.sourceKey,
      pages: 100,
    };
    await sendMessage(
      JSON.stringify(queueMessage),
      getQueueUrl(config.QUEUE_NAME),
      undefined,
      undefined,
      job.id
    );
    return job;
  }

  /**
   * Gets the current status and details of a job
   * @param id Job ID
   * @param userId Required user ID for logged-in users
   * @returns Job details or null if not found
   */
  /**
   * Gets detailed job information including metadata
   * @param id Job ID
   * @returns Detailed job information or null if not found
   */
  async getJob(id: string): Promise<IJob | null> {
    const job = await this.jobRepository.getJob(id, this.userId as string);

    if (!job) {
      return null;
    }

    // Ensure filename is populated
    if (!job.filename && job.source_key) {
      try {
        const parsed = new URL(job.source_key);
        job.filename = parsed.pathname.split('/').pop() || 'Unknown';
      } catch (err) {
        job.filename = 'Unknown';
      }
    }

    return {
      ...job,
      filename: job.filename || 'Unknown',
    };
  }
  /**
   * Gets many jobs
   * @param userId Required user ID for logged-in users
   * @returns Jobs details or null if not found
   */
  /**
   * Gets a paginated list of jobs with optional filters and status counts
   * @param filters Optional filters and pagination options
   * @returns Job list response with pagination and status counts
   */
  async getJobs(filters?: IJobListFilters): Promise<IJobListResponse> {
    const { page = 1, limit = 10, status: _status, filename: _filename } = filters || {};
    const offset = (page - 1) * limit;

    // Get jobs with pagination
    const result = await this.jobRepository.getJobs(this.userId as string, offset, limit);
    const jobs = result?.data || [];
    const total = result?.total || 0;
    if (!jobs) {
      return {
        jobs: [],
        total: 0,
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrevious: false,
        },
      };
    }

    // Apply pagination
    const totalPages = Math.ceil(total / limit);
    // Process jobs to ensure filename is populated
    const processedJobs: IJobListItem[] = jobs.map((job) => ({
      id: job.id,
      filename: job.filename || 'Unknown',
      status: job.status,
      created_at: job.created_at,
      updated_at: job.updated_at,
      credits_spent: job.credits_spent,
      failure_reason: job.failure_reason,
      download_data: job.download_data,
    }));

    return {
      jobs: processedJobs,
      total,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    };
  }

  async getResults(
    id: string,
    pagination?: IJsonlPaginationOptions
  ): Promise<IBankStatementResults | null> {
    // Get job from repository
    const job = await this.getJob(id);
    let deleted = false;
    if (!job) {
      // return 404 error
      throw new NotFoundError(`Job not found with id: ${id}`);
    }
    if (job.status.toLowerCase() == JobStatus.FAILED.toLowerCase()) {
      return {
        transactions: [],
        pagination: { page: 0, limit: 0, total_count: 0, has_more: false },
        status: JobStatus.FAILED,
      };
    }
    if (job.status.toLowerCase() == JobStatus.PROCESSING.toLowerCase()) {
      return {
        transactions: [],
        pagination: { page: 0, limit: 0, total_count: 0, has_more: false },
        status: JobStatus.PROCESSING,
      };
    }
    if (!job.result_s3_path) {
      throw new NotFoundError(`Job ${id} has no results available`);
    }

    // Create a unique temp file path in Lambda's /tmp directory
    const path = require('path');
    const { v4: uuidv4 } = require('uuid');
    const tempFilePath = path.join('/tmp', `${uuidv4()}.jsonl`);

    try {
      if (!pagination) {
        pagination = { offset: 0, limit: 100 };
      }
      let result: IJsonlReadResult<any> = { data: [], total: 0, hasMore: false, totalRead: 0 };
      // Download the file from S3 to Lambda's temp directory
      // if the path is not found in s3, set deleted to true
      if (!(await checkFileExists(job.result_s3_path))) {
        deleted = true;
      } else {
        await downloadFileToDisk(job.result_s3_path, tempFilePath);

        // Read the file in a paginated manner using the JSONL repository
        result = await this.jsonlRepository.readJsonlFile(tempFilePath, pagination);
      }

      return {
        transactions: result.data as Record<string, any>[],
        pagination: {
          page: pagination.offset / pagination.limit,
          limit: pagination.limit,
          total_count: result.total,
          has_more: result.hasMore,
        },
        pdfPages: job.num_pages || 0,
        status: JobStatus.SUCCESS,
        deleted,
      };
    } finally {
      // Clean up the temp file
      const fs = await import('fs/promises');
      await fs.unlink(tempFilePath).catch(() => { }); // Ignore errors in cleanup
    }
  }

  /**
   * Gets a presigned download URL for a job's result file in a specific format
   * @param options Download URL options including job ID, format and expiration time
   * @param userId Optional user ID for authenticated users
   * @returns Download URL result object
   */
  async getJobDownloadUrl(options: IDownloadUrlOptions): Promise<IDownloadUrlResult> {
    const { jobId, format, expiresIn = 3600 } = options;
    // Validate format
    const supportedFormats: SupportedDownloadFormat[] = ['csv', 'json', 'xlsx', 'jsonl'];
    if (!supportedFormats.includes(format)) {
      throw new ValidationError(
        `Invalid format '${format}'. Supported formats: ${supportedFormats.join(', ')}`
      );
    }

    // Get job details
    const job = await this.getJob(jobId);
    if (!job) {
      throw new NotFoundError(`Job ${jobId} not found or you don't have permission to access it.`);
    }
    if (this.userId) {

      let pdfPages = job.num_pages || 0;
      const pageCreditsCount = await this.pageCreditRepository.getPageCreditsCountByJobId(job.id);

      if (pageCreditsCount > 0) {
        logger.info('Job has already been charged for, skipping page credit deduction');
      } else {
        // Grant monthly free credits if needed
        await this.pageCreditRepository.grantMonthlyFreeCredits(this.userId);

        // Get available credits
        const pageCredits = await this.pageCreditRepository.getRemainingPageCredits(this.userId);

        // Sort based on expires_at
        pageCredits.sort(
          (a, b) =>
            new Date(a.expires_at as string).getTime() - new Date(b.expires_at as string).getTime()
        );
        const totalPageCredits = pageCredits.reduce((acc, credit) => acc + credit.balance, 0);
        if (totalPageCredits <= 0) {
          throw new ValidationError(`Job ${jobId} has no page credits available.`, InternalErrorCodes.OVERUSE_LIMIT_EXCEEDED);
        }
        const negativePageCredits: IPageCredit[] = [];
        for (const credit of pageCredits) {
          if (pdfPages <= 0) {
            break;
          }
          const balanceToDeduct = Math.min(credit.balance, pdfPages);
          pdfPages -= balanceToDeduct;
          negativePageCredits.push({
            reference_id: credit.reference_id,
            source_type: credit.source_type,
            expires_at: credit.expires_at,
            change: -balanceToDeduct,
            reason: 'DOWNLOAD',
            job_id: jobId,
            id: uuidv4(),
            user_id: this.userId,
            created_at: new Date().toISOString(),
          });
        }
        console.log(">>> PDF PAGES", pdfPages);
        // Check if we've exceeded the overuse limit
        if (pdfPages > config.OVERUSE_LIMIT) {
          throw new ValidationError(`Job ${jobId} has exceeded the overuse limit.`, InternalErrorCodes.OVERUSE_LIMIT_EXCEEDED);
        }
        console.log(">>> NEGATIVE PAGE CREDITS", negativePageCredits);
        // Update job and create negative credits
        await this.jobRepository.updateJob(jobId, {
          credits_spent: Math.abs(
            negativePageCredits.reduce((acc, credit) => acc + credit.change, 0)
          ),
          id: jobId,
        });
        console.log(">>> NEGATIVE PAGE CREDITS", negativePageCredits);
        if (negativePageCredits.length > 0) {
          await this.pageCreditRepository.createPageCredits(negativePageCredits);
        }
      }
    }
    // Check if job is completed
    if (job.status !== JobStatus.SUCCESS) {
      throw new ValidationError(`Job ${jobId} is not completed yet. Current status: ${job.status}`);
    }

    // Get the result path
    if (!job.result_s3_path) {
      throw new NotFoundError(`Job ${jobId} has no results available`);
    }

    // Construct the format-specific S3 key
    const baseKey = job.result_s3_path;
    const formatKey = baseKey.replace(/\.[^.]+$/, `.${format}`);

    // Check if the file exists
    const fileExists = await checkFileExists(formatKey);
    if (!fileExists) {
      throw new NotFoundError(`File in format '${format}' not found for this job.`);
    }

    // Generate presigned URL
    const downloadUrl = await getDownloadUrl(formatKey, expiresIn);

    return {
      downloadUrl,
      expiresIn,
      format,
      jobId,
    };
  }
}
