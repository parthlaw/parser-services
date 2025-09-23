import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { IUserGatewayId, ICreateUserGatewayIdInput } from '@/types/models';
import { IUserGatewayIdRepository } from './user-gateway-id.repository';
import envConfig from '@/config/environment';

export class SupabaseUserGatewayIdRepository implements IUserGatewayIdRepository {
  private readonly supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = envConfig.SUPABASE_URL;
    const supabaseKey = envConfig.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration is missing');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async createUserGatewayId(input: ICreateUserGatewayIdInput): Promise<IUserGatewayId> {
    const { data, error } = await this.supabase
      .from('user_gateway_id')
      .insert({
        user_id: input.user_id,
        gateway_user_id: input.gateway_user_id,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as IUserGatewayId;
  }

  async getUserGatewayId(userId: string): Promise<IUserGatewayId | null> {
    const { data, error } = await this.supabase
      .from('user_gateway_id')
      .select()
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Record not found
        return null;
      }
      throw error;
    }

    return data as IUserGatewayId;
  }

  async getUserGatewayIdsByUserId(userId: string): Promise<IUserGatewayId[]> {
    const { data, error } = await this.supabase
      .from('user_gateway_id')
      .select()
      .eq('user_id', userId);

    if (error) {
      throw error;
    }

    return data as IUserGatewayId[];
  }

  async getUserGatewayIdsByGatewayUserId(gatewayUserId: string): Promise<IUserGatewayId | null> {
    const { data, error } = await this.supabase
      .from('user_gateway_id')
      .select()
      .eq('gateway_user_id', gatewayUserId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Record not found
        return null;
      }
      throw error;
    }

    return data as IUserGatewayId;
  }

  async deleteUserGatewayId(userId: string, gatewayUserId: string): Promise<void> {
    const { error } = await this.supabase
      .from('user_gateway_id')
      .delete()
      .eq('user_id', userId)
      .eq('gateway_user_id', gatewayUserId);

    if (error) {
      throw error;
    }
  }
}
