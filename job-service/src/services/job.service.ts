import { IJob, ICreateJobInput, IBankStatementResults, IJsonlPaginationOptions, JobStatus } from '@/types/models';
import { IJobRepository } from '@/repositories/job.repository';
import { DynamoDBJobRepository } from '@/repositories/dynamodb.job.repository';
import { SupabaseJobRepository } from '@/repositories/supabase.job.repository';
import { IJsonlRepository, JsonlRepository } from '@/repositories/jsonl.repository';
import { downloadFileToDisk } from '@/resources/s3/operations';
import { getQueueUrl, sendMessage } from '@/resources/sqs/operations';
import { BankStatementDecodeQueueMessage } from '@/types';
import config from '@/config/environment';
import { NotFoundError } from '@/utils/errors';

export class JobService {
  private readonly jsonlRepository: IJsonlRepository;
  private readonly jobRepository: IJobRepository;
  constructor(userId?: string) {
    this.jobRepository = userId ? new SupabaseJobRepository() : new DynamoDBJobRepository();
    this.jsonlRepository = new JsonlRepository();
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
    await sendMessage(JSON.stringify(queueMessage), getQueueUrl(config.QUEUE_NAME), undefined, undefined, job.id);
    return job;
  }

  /**
   * Gets the current status and details of a job
   * @param id Job ID
   * @param userId Required user ID for logged-in users
   * @returns Job details or null if not found
   */
  async getJob(id: string, userId?: string): Promise<IJob | null> {
    // Use Supabase for logged-in users, DynamoDB for anonymous users
    const repository = this.jobRepository;
    const result = await repository.getJob(id, userId as string);
    console.log("RESULT", result);
    return result;
  }
  /**
   * Gets many jobs
   * @param userId Required user ID for logged-in users
   * @returns Jobs details or null if not found
   */
  async getJobs(userId?: string): Promise<IJob[] | null> {
    // Use Supabase for logged-in users, DynamoDB for anonymous users
    const repository = this.jobRepository;
    return repository.getJobs(userId as string);
  }

  async getResults(id: string, userId?: string, pagination?: IJsonlPaginationOptions): Promise<IBankStatementResults | null> {
    // Get job from repository
    const job = await this.getJob(id, userId as string);
    if (!job) {
      // return 404 error
      throw new NotFoundError(`Job not found with id: ${id}`);
    }
    if (job.status == JobStatus.FAILED) {
      return { transactions: [], total: 0, hasMore: false, status: JobStatus.FAILED };
    }
    if (job.status == JobStatus.PROCESSING) {
      return { transactions: [], total: 0, hasMore: false, status: JobStatus.PROCESSING };
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
      // Download the file from S3 to Lambda's temp directory
      await downloadFileToDisk(job.result_s3_path, tempFilePath);

      // Read the file in a paginated manner using the JSONL repository
      const result = await this.jsonlRepository.readJsonlFile(tempFilePath, pagination);

      return { transactions: result.data as Record<string, any>[], total: result.totalRead, hasMore: result.hasMore, status: JobStatus.SUCCESS };
    } finally {
      // Clean up the temp file
      const fs = await import('fs/promises');
      await fs.unlink(tempFilePath).catch(() => { }); // Ignore errors in cleanup
    }
  }
}
