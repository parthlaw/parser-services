import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { IBundle, ICreateBundleInput, IUpdateBundleInput } from '@/types/models';
import { IBundleRepository } from './bundle.repository';
import envConfig from '@/config/environment';

export class SupabaseBundleRepository implements IBundleRepository {
  private readonly supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = envConfig.SUPABASE_URL;
    const supabaseKey = envConfig.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration is missing');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async createBundle(input: ICreateBundleInput): Promise<IBundle> {
    const { data, error } = await this.supabase
      .from('bundles')
      .insert({
        id: input.id,
        user_id: input.user_id,
        bundle_type: input.bundle_type,
        pages: input.pages,
        price: input.price,
        currency: input.currency || 'USD',
        purchased_at: input.purchased_at,
        valid_until: input.valid_until,
        invoice_id: input.invoice_id,
        invoice_line_item_id: input.invoice_line_item_id,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as IBundle;
  }

  async getBundle(id: string, userId: string): Promise<IBundle | null> {
    const { data, error } = await this.supabase
      .from('bundles')
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

    return data as IBundle;
  }

  async getBundlesByUserId(userId: string): Promise<IBundle[]> {
    const { data, error } = await this.supabase
      .from('bundles')
      .select()
      .eq('user_id', userId)
      .order('purchased_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data as IBundle[];
  }

  async getBundlesByType(bundleType: string): Promise<IBundle[]> {
    const { data, error } = await this.supabase
      .from('bundles')
      .select()
      .eq('bundle_type', bundleType)
      .order('purchased_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data as IBundle[];
  }

  async updateBundle(input: IUpdateBundleInput): Promise<IBundle> {
    const updateData: any = {};

    if (input.bundle_type !== undefined) updateData.bundle_type = input.bundle_type;
    if (input.pages !== undefined) updateData.pages = input.pages;
    if (input.price !== undefined) updateData.price = input.price;
    if (input.currency !== undefined) updateData.currency = input.currency;
    if (input.valid_until !== undefined) updateData.valid_until = input.valid_until;

    const { data, error } = await this.supabase
      .from('bundles')
      .update(updateData)
      .eq('id', input.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as IBundle;
  }

  async deleteBundle(id: string, userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('bundles')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      throw error;
    }
  }
}
