import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  IPageCredit,
  ICreatePageCreditInput,
  IUpdatePageCreditInput,
  IPageCreditBalance,
} from '@/types/models';
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

  async getPageCredit(id: string, userId: string): Promise<IPageCredit | null> {
    const { data, error } = await this.supabase
      .from('page_credits')
      .select()
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Record not found
        return null;
      }
      throw error;
    }

    return data as IPageCredit;
  }

  async getPageCreditsByUserId(userId: string): Promise<IPageCredit[]> {
    const { data, error } = await this.supabase
      .from('page_credits')
      .select()
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data as IPageCredit[];
  }

  async getPageCreditsByReason(reason: string): Promise<IPageCredit[]> {
    const { data, error } = await this.supabase
      .from('page_credits')
      .select()
      .eq('reason', reason)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data as IPageCredit[];
  }

  async getPageCreditsBySourceType(sourceType: string): Promise<IPageCredit[]> {
    const { data, error } = await this.supabase
      .from('page_credits')
      .select()
      .eq('source_type', sourceType)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data as IPageCredit[];
  }

  async getPageCreditsByReferenceId(referenceId: string): Promise<IPageCredit[]> {
    const { data, error } = await this.supabase
      .from('page_credits')
      .select()
      .eq('reference_id', referenceId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data as IPageCredit[];
  }

  async updatePageCredit(input: IUpdatePageCreditInput): Promise<IPageCredit> {
    const updateData: any = {};

    if (input.change !== undefined) updateData.change = input.change;
    if (input.reason !== undefined) updateData.reason = input.reason;
    if (input.source_type !== undefined) updateData.source_type = input.source_type;
    if (input.reference_id !== undefined) updateData.reference_id = input.reference_id;
    if (input.expires_at !== undefined) updateData.expires_at = input.expires_at;

    const { data, error } = await this.supabase
      .from('page_credits')
      .update(updateData)
      .eq('id', input.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as IPageCredit;
  }

  async deletePageCredit(id: string, userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('page_credits')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      throw error;
    }
  }

  async getRemainingPageCredits(userId: string): Promise<IPageCreditBalance[]> {
    const { data, error } = await this.supabase.rpc('get_remaining_page_credits', {
      uid: userId,
    });
    console.log('>>> data', JSON.stringify(data, null, 2));
    console.log('>>> error', JSON.stringify(error, null, 2));

    if (error) {
      throw error;
    }

    return data || [];
  }
}
