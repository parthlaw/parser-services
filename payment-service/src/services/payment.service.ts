import { IPaymentProvider, WebhookEventAction, WebhookEventResourceType, WebhookEventResponse } from '@/resources/payment-providers/payment-provider.interface';
import { paymentProviderFactory } from '@/resources/payment-providers/payment-provider.factory';
import logger from '@/utils/logger';
import PaymentRepositoryFactory, { PaymentRepository } from '@/repositories/payment-db.repository';
import { User } from '@supabase/supabase-js';
import { OrderStatus, PaymentGateway, SubscriptionStatus } from '@/types/database.models';
import { CreateSubscriptionResult } from '@/types/payment.models';

export class PaymentService {
  private provider: IPaymentProvider;
  private db: PaymentRepository;

  constructor(
    providerType?: 'paypal' | 'razorpay',
    currency?: string,
    region?: string,
    userToken?: string
  ) {
    // Smart provider selection
    if (providerType) {
      this.provider = paymentProviderFactory.createProvider(providerType);
    } else if (currency) {
      this.provider = paymentProviderFactory.getProviderByCurrency(currency);
    } else if (region) {
      this.provider = paymentProviderFactory.getProviderByRegion(region);
    } else {
      this.provider = paymentProviderFactory.getDefaultProvider();
    }
    this.db = PaymentRepositoryFactory.createPaymentRepository('supabase', userToken);

    logger.info(`PaymentService initialized with provider: ${this.provider.constructor.name}`);
  }

  /**
   * Create a simple one-time payment order
   */
  async createPayment(
    amount: string,
    currency: string = 'USD',
    user: User
  ) {
    try {
      logger.info(`Creating payment for ${amount} ${currency}`);
      const order = await this.provider.createOrder(
        {
          intent: 'CAPTURE',
          amount: {
            currency_code: currency,
            value: amount,
          },
          customer: {
            email: user.email,
          },
        }
      );
      await this.db.createOrder({
        user_id: user.id,
        gateway_order_id: order.id,
        gateway: this.provider.getProviderName() as PaymentGateway,
        currency: currency,
        amount: parseFloat(amount),
        status: order.status as OrderStatus,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      return order;
    } catch (error) {
      logger.error('Error creating payment:', error);
      throw error;
    }
  }

  /**
   * Capture a payment after user approval
   */
  async capturePayment(orderId: string) {
    try {
      logger.info(`Capturing payment for order: ${orderId}`);
      const result = await this.provider.captureOrder(orderId);
      await this.db.updateOrderByGatewayId(orderId, {
        status: result.status as OrderStatus,
        updated_at: new Date().toISOString(),
      });
      return result;
    } catch (error) {
      logger.error('Error capturing payment:', error);
      throw error;
    }
  }

  /**
   * Create a subscription with flexible interval
   */
  async createSubscription(
    planId: string,
    price: string,
    currency: string,
    interval: 'DAY' | 'WEEK' | 'MONTH' | 'YEAR',
    user: User,
    subscriptionId?: string|null,
  ): Promise<CreateSubscriptionResult> {
    try {
      logger.info(`Creating ${interval.toLowerCase()} subscription for ${user.email}: ${planId} - ${price} ${currency}`);
      const result = await this.provider.createSubscription(
        {
          id: subscriptionId || '',
          plan_id: planId,
          customer: {
            name: user.user_metadata.name || null,
            email: user.email || null,
          },
        }
      );
      await this.db.createSubscription({
        user_id: user.id,
        gateway_plan_id: planId,
        gateway_subscription_id: subscriptionId || result.id || '',
        gateway: this.provider.getProviderName() as PaymentGateway,
        status: result.status as SubscriptionStatus,
        start_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      });
      return {
        subscriptionId: result.id,
        startDate: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Error creating subscription:', error);
      throw error;
    }
  }

  /**
   * Create a monthly subscription (convenience method)
   */
  async createMonthlySubscription(
    planId: string,
    monthlyPrice: string,
    user: User,
    currency: string = 'USD',
  ) {
    return await this.createSubscription(
      planId,
      monthlyPrice,
      currency,
      'MONTH',
      user,
      null
    );
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(subscriptionId: string, reason: string = 'Customer requested cancellation') {
    try {
      logger.info(`Cancelling subscription: ${subscriptionId}`);
      const result = await this.provider.cancelSubscription(subscriptionId, reason);
      await this.db.updateSubscription(subscriptionId, {
        status: result.status as SubscriptionStatus,
        updated_at: new Date().toISOString(),
      });
      return { success: true, message: 'Subscription cancelled successfully' };
    } catch (error) {
      logger.error('Error cancelling subscription:', error);
      throw error;
    }
  }

  /**
   * Process refund for a captured payment
   */
  async processRefund(captureId: string, amount?: string, currency?: string, reason?: string) {
    try {
      logger.info(`Processing refund for capture: ${captureId}`);
      const refundData = amount && currency ? {
        amount: { currency_code: currency, value: amount },
        reason: reason || 'Refund requested',
      } : { reason: reason || 'Full refund requested' };

      const refund = await this.provider.refundPayment(captureId, refundData);
      return refund;
    } catch (error) {
      logger.error('Error processing refund:', error);
      throw error;
    }
  }

  /**
   * Get payment/order details
   */
  async getPaymentDetails(orderId: string) {
    try {
      logger.info(`Getting payment details for order: ${orderId}`);
      const order = await this.provider.getOrder(orderId);
      return order;
    } catch (error) {
      logger.error('Error getting payment details:', error);
      throw error;
    }
  }

  /**
   * Get subscription details
   */
  async getSubscriptionDetails(subscriptionId: string) {
    try {
      logger.info(`Getting subscription details: ${subscriptionId}`);
      const subscription = await this.provider.getSubscription(subscriptionId);
      return subscription;
    } catch (error) {
      logger.error('Error getting subscription details:', error);
      throw error;
    }
  }

  /**
   * Get refund details
   */
  async getRefundDetails(refundId: string) {
    try {
      logger.info(`Getting refund details: ${refundId}`);
      const refund = await this.provider.getRefund(refundId);
      return refund;
    } catch (error) {
      logger.error('Error getting refund details:', error);
      throw error;
    }
  }

  /**
   * Verify webhook signature
   */
  async verifyWebhook(headers: Record<string, string>, body: string) {
    try {
      logger.info('Verifying webhook signature');
      if (!this.provider.verifyWebhookSignature) {
        throw new Error('Webhook verification not supported by provider');
      }
      const result = await this.provider.verifyWebhookSignature(headers, body);
      return result;
    } catch (error) {
      logger.error('Error verifying webhook:', error);
      throw error;
    }
  }
  private async handleWebhookEventUpdate(result: WebhookEventResponse) {
    switch (result.resource) {
      case WebhookEventResourceType.SUBSCRIPTION:
        await this.db.updateSubscription(result.data.subscriptionId, {
          status: result.data.status,
          updated_at: new Date().toISOString(),
          // last_payment_at: result.data.last_payment_at || null,
        });
      case WebhookEventResourceType.PAYMENT:
        if (result.data.subscriptionId) {
          await this.db.updateSubscription(result.data.subscriptionId, {
            status: result.data.status,
            updated_at: new Date().toISOString(),
            // last_payment_at: result.data.last_payment_at || null,
          });
        }
        break;
    }
  }
  /**
   * Process webhook event
   */
  async processWebhook(event: any) {
    try {
      logger.info('Processing webhook event:', event);
      if (!this.provider.processWebhookEvent) {
        throw new Error('Webhook processing not supported by provider');
      }
      const result = await this.provider.processWebhookEvent(event);
      switch (result.action) {
        case WebhookEventAction.UPDATED:
          await this.handleWebhookEventUpdate(result);
          break;
      }
      return { success: true, message: 'Webhook processed successfully' };
    } catch (error) {
      logger.error('Error processing webhook:', error);
      throw error;
    }
  }
  
}

export default PaymentService;