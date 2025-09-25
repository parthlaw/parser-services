import { DynamoDBOperations } from '@/resources/dynamodb/operations';
import { IJob, ICreateJobInput, JobStatus, IUpdateJobInput } from '@/types/models';
import { IJobRepository, JobCounts } from './job.repository';

export class DynamoDBJobRepository implements IJobRepository {
  private readonly tableName: string;
  private readonly dynamoDB: DynamoDBOperations;

  constructor() {
    this.tableName = process.env.JOBS_TABLE_NAME || 'jobs';
    this.dynamoDB = new DynamoDBOperations();
  }

  async createJob(input: ICreateJobInput): Promise<IJob> {
    const now = new Date().toISOString();
    const job: IJob = {
      id: input.job_id,
      source_key: input.sourceKey,
      filename: input.filename,
      status: JobStatus.PROCESSING,
      created_at: now,
      updated_at: now,
      result_s3_path: undefined,
      result_score: undefined,
      num_pages: undefined,
      user_id: input.user_id,
    };

    return this.dynamoDB.put({
      tableName: this.tableName,
      item: job as unknown as Record<string, unknown>,
    });
  }
  async getJob(id: string, _userId: string): Promise<IJob | null> {
    return this.dynamoDB.get({
      tableName: this.tableName,
      key: { id },
    });
  }

  async getJobs(_userId: string, _offset: number, _limit: number): Promise<{ data: IJob[], total: number } | null> {
    return {
      data: [],
      total: 0,
    };
  }
  async getJobCounts(_userId: string): Promise<JobCounts> {
    return {
      total: 0,
      completed: 0,
      failed: 0,
    };
  }
  async updateJob(_id: string, _input: IUpdateJobInput): Promise<IJob> {
    // no-op for DynamoDB
    return null as unknown as IJob;
  }
}
