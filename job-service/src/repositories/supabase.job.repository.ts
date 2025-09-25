import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { IJob, ICreateJobInput, JobStatus, IUpdateJobInput } from '@/types/models';
import { IJobRepository, JobCounts } from './job.repository';
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
        id: input.job_id,
        status: JobStatus.PROCESSING,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as IJob;
  }
  async updateJob(id: string, input: IUpdateJobInput): Promise<IJob> {
    const { data, error } = await this.supabase
      .from('jobs')
      .update(input)
      .eq('id', id)
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
      if (error.code === 'PGRST116') {
        // Record not found
        return null;
      }
      throw error;
    }

    return data as IJob;
  }

  async getJobs(userId: string, offset: number, limit: number): Promise<{ data: IJob[], total: number } | null> {
    const { data, error,count } = await this.supabase
      .from('jobs')
      .select("*", { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      if (error.code === 'PGRST116') {
        // Record not found
        return null;
      }
      throw error;
    }

    return {
      data: data as IJob[],
      total: count || data.length,
    };
  }

  async getJobCounts(userId: string): Promise<JobCounts> {
    try {
      // Calculate start of current month
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      // Get total jobs count
      const totalResult = await this.supabase
        .from('jobs')
        .select('id', { count: 'exact' })
        .eq('user_id', userId)
        .gte('created_at', startOfMonth);

      if (totalResult.error) {
        throw new Error(`Failed to get total jobs count: ${totalResult.error.message}`);
      }

      const totalJobs = totalResult.count;

      // // Get completed jobs count
      const completedResult = await this.supabase
        .from('jobs')
        .select('id', { count: 'exact' })
        .eq('user_id', userId)
        .eq('status', JobStatus.SUCCESS)
        .gte('created_at', startOfMonth);
      const completedJobs = completedResult.count;

      if (completedResult.error) {
        throw new Error(`Failed to get completed jobs count: ${completedResult.error.message}`);
      }

      // // Get failed jobs count
      const failedResult = await this.supabase
        .from('jobs')
        .select('id', { count: 'exact' })
        .eq('user_id', userId)
        .eq('status', JobStatus.FAILED)
        .gte('created_at', startOfMonth);
      const failedJobs = failedResult.count;

      if (failedResult.error) {
        throw new Error(`Failed to get failed jobs count: ${failedResult.error.message}`);
      }

      // Log final counts before returning
      const counts = {
        total: totalJobs || 0,
        completed: completedJobs || 0,
        failed: failedJobs || 0,
      };

      return counts;
    } catch (error) {
      throw new Error(
        `Failed to get job counts: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
