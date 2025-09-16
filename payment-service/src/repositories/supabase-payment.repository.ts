import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PaymentRepository } from './payment.repository';
import {
  DbSubscription,
  DbOrder,
  DbPayment,
  DbRefund,
  CreateSubscriptionDto,
  UpdateSubscriptionDto,
  CreateOrderDto,
  UpdateOrderDto,
  CreatePaymentDto,
  UpdatePaymentDto,
  CreateRefundDto,
  UpdateRefundDto,
  SubscriptionFilters,
  OrderFilters,
  PaymentFilters,
  RefundFilters,
  PaymentWithDetails,
  RefundWithPayment
} from '../types/database.models';

export class SupabasePaymentRepository implements PaymentRepository {
  private supabase: SupabaseClient;

  constructor(supabaseUrl: string, supabaseKey: string, userToken?: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey, {
      global: userToken ? {
        headers: {
          Authorization: userToken
        }
      } : undefined
    });
  }

  // Helper method to handle Supabase errors
  private handleError(error: any, operation: string): never {
    console.error(`Supabase ${operation} error:`, error);
    throw new Error(`Database ${operation} failed: ${error.message || error}`);
  }

  // Subscription operations
  async createSubscription(data: CreateSubscriptionDto): Promise<DbSubscription> {
    const { data: subscription, error } = await this.supabase
      .from('subscriptions')
      .insert(data)
      .select()
      .single();

    if (error) this.handleError(error, 'subscription creation');
    return subscription;
  }

  async getSubscriptionById(id: string): Promise<DbSubscription | null> {
    const { data: subscription, error } = await this.supabase
      .from('subscriptions')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      this.handleError(error, 'subscription fetch');
    }
    return subscription || null;
  }

  async getSubscriptionByGatewayId(gatewaySubscriptionId: string): Promise<DbSubscription | null> {
    const { data: subscription, error } = await this.supabase
      .from('subscriptions')
      .select('*')
      .eq('gateway_subscription_id', gatewaySubscriptionId)
      .single();

    if (error && error.code !== 'PGRST116') {
      this.handleError(error, 'subscription fetch by gateway ID');
    }
    return subscription || null;
  }

  async getSubscriptions(filters?: SubscriptionFilters): Promise<DbSubscription[]> {
    let query = this.supabase.from('subscriptions').select('*');

    if (filters) {
      if (filters.user_id) query = query.eq('user_id', filters.user_id);
      if (filters.gateway) query = query.eq('gateway', filters.gateway);
      if (filters.status) query = query.eq('status', filters.status);
      if (filters.gateway_subscription_id) {
        query = query.eq('gateway_subscription_id', filters.gateway_subscription_id);
      }
    }

    const { data: subscriptions, error } = await query;

    if (error) this.handleError(error, 'subscriptions fetch');
    return subscriptions || [];
  }

  async updateSubscription(id: string, data: UpdateSubscriptionDto): Promise<DbSubscription> {
    const { data: subscription, error } = await this.supabase
      .from('subscriptions')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) this.handleError(error, 'subscription update');
    return subscription;
  }

  async deleteSubscription(id: number): Promise<boolean> {
    const { error } = await this.supabase
      .from('subscriptions')
      .delete()
      .eq('id', id);

    if (error) this.handleError(error, 'subscription deletion');
    return true;
  }

  // Order operations
  async createOrder(data: CreateOrderDto): Promise<DbOrder> {
    const { data: order, error } = await this.supabase
      .from('orders')
      .insert(data)
      .select()
      .single();

    if (error) this.handleError(error, 'order creation');
    return order;
  }

  async getOrderById(id: string): Promise<DbOrder | null> {
    const { data: order, error } = await this.supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      this.handleError(error, 'order fetch');
    }
    return order || null;
  }

  async getOrderByGatewayId(gatewayOrderId: string): Promise<DbOrder | null> {
    const { data: order, error } = await this.supabase
      .from('orders')
      .select('*')
      .eq('gateway_order_id', gatewayOrderId)
      .single();

    if (error && error.code !== 'PGRST116') {
      this.handleError(error, 'order fetch by gateway ID');
    }
    return order || null;
  }

  async getOrders(filters?: OrderFilters): Promise<DbOrder[]> {
    let query = this.supabase.from('orders').select('*');

    if (filters) {
      if (filters.user_id) query = query.eq('user_id', filters.user_id);
      if (filters.gateway) query = query.eq('gateway', filters.gateway);
      if (filters.status) query = query.eq('status', filters.status);
      if (filters.gateway_order_id) {
        query = query.eq('gateway_order_id', filters.gateway_order_id);
      }
    }

    const { data: orders, error } = await query;

    if (error) this.handleError(error, 'orders fetch');
    return orders || [];
  }

  async updateOrder(id: string, data: UpdateOrderDto): Promise<DbOrder> {
    const { data: order, error } = await this.supabase
      .from('orders')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) this.handleError(error, 'order update');
    return order;
  }

  async updateOrderByGatewayId(gatewayOrderId: string, data: UpdateOrderDto): Promise<DbOrder> {
    const { data: order, error } = await this.supabase
      .from('orders')
      .update(data)
      .eq('gateway_order_id', gatewayOrderId)
      .select()
      .single();

    if (error) this.handleError(error, 'order update by gateway ID');
    return order;
  }
  // Payment operations
  async createPayment(data: CreatePaymentDto): Promise<DbPayment> {
    const { data: payment, error } = await this.supabase
      .from('payments')
      .insert(data)
      .select()
      .single();

    if (error) this.handleError(error, 'payment creation');
    return payment;
  }

  async getPaymentById(id: string): Promise<DbPayment | null> {
    const { data: payment, error } = await this.supabase
      .from('payments')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      this.handleError(error, 'payment fetch');
    }
    return payment || null;
  }

  async getPaymentByGatewayId(gatewayPaymentId: string): Promise<DbPayment | null> {
    const { data: payment, error } = await this.supabase
      .from('payments')
      .select('*')
      .eq('gateway_payment_id', gatewayPaymentId)
      .single();

    if (error && error.code !== 'PGRST116') {
      this.handleError(error, 'payment fetch by gateway ID');
    }
    return payment || null;
  }

  async getPayments(filters?: PaymentFilters): Promise<DbPayment[]> {
    let query = this.supabase.from('payments').select('*');

    if (filters) {
      if (filters.order_id) query = query.eq('order_id', filters.order_id);
      if (filters.subscription_id) query = query.eq('subscription_id', filters.subscription_id);
      if (filters.gateway) query = query.eq('gateway', filters.gateway);
      if (filters.status) query = query.eq('status', filters.status);
      if (filters.gateway_payment_id) {
        query = query.eq('gateway_payment_id', filters.gateway_payment_id);
      }
    }

    const { data: payments, error } = await query;

    if (error) this.handleError(error, 'payments fetch');
    return payments || [];
  }

  async getPaymentsWithDetails(filters?: PaymentFilters): Promise<PaymentWithDetails[]> {
    let query = this.supabase
      .from('payments')
      .select(`
        *,
        order:orders(*),
        subscription:subscriptions(*),
        refunds(*)
      `);

    if (filters) {
      if (filters.order_id) query = query.eq('order_id', filters.order_id);
      if (filters.subscription_id) query = query.eq('subscription_id', filters.subscription_id);
      if (filters.gateway) query = query.eq('gateway', filters.gateway);
      if (filters.status) query = query.eq('status', filters.status);
      if (filters.gateway_payment_id) {
        query = query.eq('gateway_payment_id', filters.gateway_payment_id);
      }
    }

    const { data: payments, error } = await query;

    if (error) this.handleError(error, 'payments with details fetch');
    return payments || [];
  }

  async updatePayment(id: string, data: UpdatePaymentDto): Promise<DbPayment> {
    const { data: payment, error } = await this.supabase
      .from('payments')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) this.handleError(error, 'payment update');
    return payment;
  }


  // Refund operations
  async createRefund(data: CreateRefundDto): Promise<DbRefund> {
    const { data: refund, error } = await this.supabase
      .from('refunds')
      .insert(data)
      .select()
      .single();

    if (error) this.handleError(error, 'refund creation');
    return refund;
  }

  async getRefundById(id: string): Promise<DbRefund | null> {
    const { data: refund, error } = await this.supabase
      .from('refunds')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      this.handleError(error, 'refund fetch');
    }
    return refund || null;
  }

  async getRefundByGatewayId(gatewayRefundId: string): Promise<DbRefund | null> {
    const { data: refund, error } = await this.supabase
      .from('refunds')
      .select('*')
      .eq('gateway_refund_id', gatewayRefundId)
      .single();

    if (error && error.code !== 'PGRST116') {
      this.handleError(error, 'refund fetch by gateway ID');
    }
    return refund || null;
  }

  async getRefunds(filters?: RefundFilters): Promise<DbRefund[]> {
    let query = this.supabase.from('refunds').select('*');

    if (filters) {
      if (filters.payment_id) query = query.eq('payment_id', filters.payment_id);
      if (filters.status) query = query.eq('status', filters.status);
      if (filters.gateway_refund_id) {
        query = query.eq('gateway_refund_id', filters.gateway_refund_id);
      }
    }

    const { data: refunds, error } = await query;

    if (error) this.handleError(error, 'refunds fetch');
    return refunds || [];
  }

  async getRefundsWithPayment(filters?: RefundFilters): Promise<RefundWithPayment[]> {
    let query = this.supabase
      .from('refunds')
      .select(`
        *,
        payment:payments(*)
      `);

    if (filters) {
      if (filters.payment_id) query = query.eq('payment_id', filters.payment_id);
      if (filters.status) query = query.eq('status', filters.status);
      if (filters.gateway_refund_id) {
        query = query.eq('gateway_refund_id', filters.gateway_refund_id);
      }
    }

    const { data: refunds, error } = await query;

    if (error) this.handleError(error, 'refunds with payment fetch');
    return refunds || [];
  }

  async updateRefund(id: string, data: UpdateRefundDto): Promise<DbRefund> {
    const { data: refund, error } = await this.supabase
      .from('refunds')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) this.handleError(error, 'refund update');
    return refund;
  }
}
