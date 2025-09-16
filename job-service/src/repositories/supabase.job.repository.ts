import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { IJob, ICreateJobInput, JobStatus } from '@/types/models';
import { IJobRepository } from './job.repository';
import envConfig from '@/config/environment';

export class SupabaseJobRepository implements IJobRepository {
  private readonly supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = envConfig.SUPABASE_URL;
    const supabaseKey = envConfig.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration is missing');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async createJob(input: ICreateJobInput): Promise<IJob> {
    const { data, error } = await this.supabase
      .from('jobs')
      .insert({
        user_id: input.user_id,
        source_key: input.sourceKey,
        filename: input.filename,
        job_id: input.job_id,
        status: JobStatus.PROCESSING,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as IJob;
  }
  async getJob(id: string, userId: string): Promise<IJob | null> {
    const { data, error } = await this.supabase
      .from('jobs')
      .select()
      .eq('user_id', userId)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // Record not found
        return null;
      }
      throw error;
    }

    return data as IJob;
  }

  async getJobs(userId: string): Promise<IJob[] | null> {
    const { data, error } = await this.supabase
      .from('jobs')
      .select()
      .eq('user_id', userId);
    

    if (error) {
      if (error.code === 'PGRST116') { // Record not found
        return null;
      }
      throw error;
    }

    return data as IJob[];
  }
}
