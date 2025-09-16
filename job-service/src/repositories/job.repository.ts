import { IJob, ICreateJobInput } from '@/types/models';

export interface IJobRepository {
  createJob(input: ICreateJobInput): Promise<IJob>;
  getJob(id: string, userId: string): Promise<IJob | null>;
  getJobs(userId: string): Promise<IJob[] | null>;
}
