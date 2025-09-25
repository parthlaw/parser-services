import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { IPageCredit, ICreatePageCreditInput, IPageCreditBalance } from '@/types/models';
import { IPageCreditRepository } from './page-credit.repository';
import envConfig from '@/config/environment';

export class SupabasePageCreditRepository implements IPageCreditRepository {
  private readonly supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = envConfig.SUPABASE_URL;
    const supabaseKey = envConfig.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration is missing');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async createPageCredit(input: ICreatePageCreditInput): Promise<IPageCredit> {
    const { data, error } = await this.supabase
      .from('page_credits')
      .insert({
        id: input.id,
        user_id: input.user_id,
        change: input.change,
        reason: input.reason,
        source_type: input.source_type,
        reference_id: input.reference_id,
        created_at: input.created_at,
        expires_at: input.expires_at,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as IPageCredit;
  }
  async createPageCredits(input: ICreatePageCreditInput[]): Promise<IPageCredit[]> {
    const insertData = input.map((item) => ({
      id: item.id,
      user_id: item.user_id,
      change: item.change,
      reason: item.reason,
      source_type: item.source_type,
      reference_id: item.reference_id,
      created_at: item.created_at,
      expires_at: item.expires_at,
    }));

    const { data, error } = await this.supabase.from('page_credits').insert(insertData).select();

    if (error) {
      throw error;
    }

    return data as IPageCredit[];
  }

  async getRemainingPageCredits(userId: string): Promise<IPageCreditBalance[]> {
    const { data, error } = await this.supabase.rpc('get_remaining_page_credits', {
      uid: userId,
    });

    if (error) {
      throw error;
    }

    return data || [];
  }

  async getPageCreditsCountByJobId(jobId: string): Promise<number> {
    const { error,count } = await this.supabase.from('page_credits').select('id', { count: 'exact' }).eq('job_id', jobId).limit(1);
    if (error) {
      throw error;
    }
    if(count==null || count==undefined) {
      return 1;
    }
    return count;
  }

  async getPageCreditByReferenceId(referenceId: string): Promise<IPageCredit | null> {
    const { data, error } = await this.supabase.from('page_credits').select().eq('reference_id', referenceId).single();
    if (error) {
      return null;
    }
    return data as IPageCredit;
  }
}
