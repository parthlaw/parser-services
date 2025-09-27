import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ISubscription, ICreateSubscriptionInput, IUpdateSubscriptionInput } from '@/types/models';
import { ISubscriptionRepository } from './subscription.repository';
import envConfig from '@/config/environment';

export class SupabaseSubscriptionRepository implements ISubscriptionRepository {
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
      return 'subscriptions_dev';
    }
    return 'subscriptions';
  }
  async createSubscription(input: ICreateSubscriptionInput): Promise<ISubscription> {
    const { data, error } = await this.supabase
      .from(this.getTableName())
      .insert({
        id: input.id,
        user_id: input.user_id,
        currency: input.currency || 'USD',
        start_date: input.start_date,
        end_date: input.end_date,
        subscription_id: input.subscription_id,
        item_price_id: input.item_price_id,
        status: input.status,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as ISubscription;
  }

  async getSubscription(id: string, userId: string): Promise<ISubscription | null> {
    const { data, error } = await this.supabase
      .from(this.getTableName())
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

    return data as ISubscription;
  }

  async getSubscriptionsByUserId(userId: string): Promise<ISubscription[]> {
    const { data, error } = await this.supabase
      .from(this.getTableName())
      .select()
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('start_date', { ascending: false });

    if (error) {
      throw error;
    }

    return data as ISubscription[];
  }

  async getActiveSubscriptions(userId: string): Promise<ISubscription[]> {
    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from(this.getTableName())
      .select()
      .eq('user_id', userId)
      .lte('start_date', now)
      .gte('end_date', now)
      .order('start_date', { ascending: false });

    if (error) {
      throw error;
    }

    return data as ISubscription[];
  }

  async updateSubscription(input: IUpdateSubscriptionInput): Promise<ISubscription> {
    const updateData: any = {};

    if (input.currency !== undefined) updateData.currency = input.currency;
    if (input.start_date !== undefined) updateData.start_date = input.start_date;
    if (input.end_date !== undefined) updateData.end_date = input.end_date;
    if (input.subscription_id !== undefined) updateData.subscription_id = input.subscription_id;
    if (input.item_price_id !== undefined) updateData.item_price_id = input.item_price_id;
    if (input.status !== undefined) updateData.status = input.status;

    const { data, error } = await this.supabase
      .from(this.getTableName())
      .update(updateData)
      .eq('id', input.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as ISubscription;
  }

  async deleteSubscription(id: string, userId: string): Promise<void> {
    const { error } = await this.supabase
      .from(this.getTableName())
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      throw error;
    }
  }

  async getSubscriptionByExternalId(subscriptionId: string): Promise<ISubscription | null> {
    const { data, error } = await this.supabase
      .from(this.getTableName())
      .select()
      .eq('subscription_id', subscriptionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Record not found
        return null;
      }
      throw error;
    }

    return data as ISubscription;
  }
}
