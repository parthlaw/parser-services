import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { IPageCredit, ICreatePageCreditInput, IPageCreditBalance } from '@/types/models';
import { IPageCreditRepository } from './page-credit.repository';
import envConfig from '@/config/environment';
import { v4 as uuidv4 } from 'uuid';

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
  getTableName(): string {
    const env = envConfig.STAGE;
    if (env === 'dev') {
      return 'page_credits_dev';
    }
    return 'page_credits';
  }
  getRemainingPageCreditsFunction(): string {
    const env = envConfig.STAGE;
    if (env === 'dev') {
      return 'get_remaining_page_credits_dev';
    }
    return 'get_remaining_page_credits';
  }

  async createPageCredit(input: ICreatePageCreditInput): Promise<IPageCredit> {
    const { data, error } = await this.supabase
      .from(this.getTableName())
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

    const { data, error } = await this.supabase.from(this.getTableName()).insert(insertData).select();

    if (error) {
      throw error;
    }

    return data as IPageCredit[];
  }

  async getRemainingPageCredits(userId: string): Promise<IPageCreditBalance[]> {
    const { data, error } = await this.supabase.rpc(this.getRemainingPageCreditsFunction(), {
      uid: userId,
    });

    if (error) {
      throw error;
    }

    return data || [];
  }

  async getPageCreditsCountByJobId(jobId: string): Promise<number> {
    const { error, count } = await this.supabase
      .from(this.getTableName())
      .select('id', { count: 'exact' })
      .eq('job_id', jobId)
      .limit(1);
    if (error) {
      throw error;
    }
    if (count == null || count == undefined) {
      return 1;
    }
    return count;
  }

  async getPageCreditByReferenceId(referenceId: string): Promise<IPageCredit | null> {
    const { data, error } = await this.supabase
      .from(this.getTableName())
      .select()
      .eq('reference_id', referenceId)
      .single();
    if (error) {
      return null;
    }
    return data as IPageCredit;
  }

  async grantMonthlyFreeCredits(userId: string): Promise<IPageCredit[]> {
    // Get the start and end of the current month in UTC
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));

    // Check if we already granted free credits this month
    const { data: existingCredits } = await this.supabase
      .from(this.getTableName())
      .select('id')
      .eq('user_id', userId)
      .eq('source_type', 'FREE_MONTHLY')
      .gte('created_at', monthStart.toISOString())
      .lte('created_at', monthEnd.toISOString())
      .limit(1);

    if (existingCredits && existingCredits.length > 0) {
      return []; // Already granted this month
    }
    console.log(">>> GRANTING MONTHLY FREE CREDITS", userId,envConfig.FREE_REGISTERED_LIMIT, process.env.FREE_REGISTERED_LIMIT);
    // Create the free credit entry
    const credit: ICreatePageCreditInput = {
      id: uuidv4(),
      user_id: userId,
      change: envConfig.FREE_REGISTERED_LIMIT,
      reason: 'MONTHLY_FREE',
      source_type: 'FREE_MONTHLY',
      reference_id: null,
      created_at: new Date().toISOString(),
      expires_at: monthEnd.toISOString()
    };

    return this.createPageCredits([credit]);
  }
}
