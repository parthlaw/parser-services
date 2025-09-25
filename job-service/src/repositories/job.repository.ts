import { IJob, ICreateJobInput, IUpdateJobInput } from '@/types/models';

export interface JobCounts {
  total: number;
  completed: number;
  failed: number;
}

export interface IJobRepository {
  createJob(input: ICreateJobInput): Promise<IJob>;
  getJob(id: string, userId: string): Promise<IJob | null>;
  getJobs(
    userId: string,
    offset: number,
    limit: number
  ): Promise<{ data: IJob[]; total: number } | null>;
  getJobCounts(userId: string): Promise<JobCounts>;
  updateJob(id: string, input: IUpdateJobInput): Promise<IJob>;
}
