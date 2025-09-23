import { IJob, ICreateJobInput } from '@/types/models';

export interface JobCounts {
  total: number;
  completed: number;
  failed: number;
}

export interface IJobRepository {
  createJob(input: ICreateJobInput): Promise<IJob>;
  getJob(id: string, userId: string): Promise<IJob | null>;
  getJobs(userId: string): Promise<IJob[] | null>;
  getJobCounts(userId: string): Promise<JobCounts>;
}
