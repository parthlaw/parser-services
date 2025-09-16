import envConfig from "@/config/environment";
import {
  IPaymentProvider,
  PaymentProviderConfig,
  CreateOrderRequest,
  PaymentOrder,
  CaptureResponse,
  Subscription,
  RefundRequest,
  Refund,
  WebhookEvent,
} from "@/resources/payment-providers/payment-provider.interface";
import {
  RazorpayOrder,
  RazorpayOrderRequest,
  RazorpayPayment,
  RazorpayCustomer,
  RazorpaySubscription,
  RazorpayRefund,
  RazorpayRefundRequest,
  PaymentStatus,
} from "@/types/razorpay.types";
import logger from "@/utils/logger";
import crypto from "crypto";

export class RazorpayProvider implements IPaymentProvider {
  private baseUrl: string;
  private keyId: string;
  private keySecret: string;
  private webhookSecret: string;

  constructor(config?: PaymentProviderConfig) {
    this.baseUrl = config?.baseUrl || envConfig.RAZORPAY_BASE_URL;
    this.keyId = config?.clientId || envConfig.RAZORPAY_KEY_ID;
    this.keySecret = config?.clientSecret || envConfig.RAZORPAY_KEY_SECRET;
    this.webhookSecret = config?.webhookSecret || envConfig.RAZORPAY_WEBHOOK_SECRET;
  }

  getProviderName(): string {
    return 'razorpay';
  }

  /**
   * Make authenticated request to Razorpay API
   */
  private async makeRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
    body?: any,
    headers?: Record<string, string>
  ): Promise<T> {
    try {
      const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
      
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...headers,
        },
        ...(body && { body: JSON.stringify(body) }),
      });
      if (!response.ok) {
        throw new Error(`Razorpay API error: ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json() as T;
      } else {
        return {} as T;
      }
    } catch (error) {
      logger.error(`Error making Razorpay API request to ${endpoint}:`, error);
      throw error;
    }
  }

  /**
   * Convert currency amount to paise (smallest unit)
   */
  private toPaise(amount: string): number {
    return Math.round(parseFloat(amount) * 100);
  }

  /**
   * Convert paise to currency amount
   */
  private fromPaise(paise: number): string {
    return (paise / 100).toFixed(2);
  }

  /**
   * Generate receipt ID
   */
  private generateReceiptId(): string {
    return `rcpt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ==================== INTERFACE IMPLEMENTATION ====================

  /**
   * Create a Razorpay order (implements IPaymentProvider)
   */
  async createOrder(orderData: CreateOrderRequest): Promise<PaymentOrder> {
    try{
    logger.info('Creating Razorpay order:', orderData);
    
    const razorpayOrderData: RazorpayOrderRequest = {
      amount: this.toPaise(orderData.amount.value),
      currency: orderData.amount.currency_code,
      receipt: orderData.reference_id || this.generateReceiptId(),
      notes: {
        description: orderData.description || '',
        customer_email: orderData.customer?.email || '',
        customer_name: orderData.customer?.name || '',
        return_url: orderData.return_url || '',
        cancel_url: orderData.cancel_url || '',
      },
    };

    const razorpayOrder = await this.makeRequest<RazorpayOrder>('/v1/orders', 'POST', razorpayOrderData);
    
    // Transform Razorpay response to common interface
    return {
      id: razorpayOrder.id,
      status: razorpayOrder.status,
      amount: {
        currency_code: razorpayOrder.currency,
        value: this.fromPaise(razorpayOrder.amount),
      },
      created_at: new Date(razorpayOrder.created_at * 1000).toISOString(),
      // Razorpay doesn't provide direct checkout links like PayPal
      // The frontend will need to use Razorpay Checkout with the order ID
      links: [{
        href: `https://checkout.razorpay.com/v1/checkout.js`,
        rel: 'checkout',
        method: 'GET',
      }],
    };
    } catch (error : any) {
      // 400 error error and we have to print the whole response by razorpay

      if (error.response) {
        logger.error('Error creating Razorpay order:', error.response);
      }
      throw error;
    }
  }

  /**
   * Get order details by ID
   */
  async getOrder(orderId: string): Promise<PaymentOrder> {
    logger.info(`Getting Razorpay order: ${orderId}`);
    const razorpayOrder = await this.makeRequest<RazorpayOrder>(`/v1/orders/${orderId}`);
    
    return {
      id: razorpayOrder.id,
      status: razorpayOrder.status,
      amount: {
        currency_code: razorpayOrder.currency,
        value: this.fromPaise(razorpayOrder.amount),
      },
      created_at: new Date(razorpayOrder.created_at * 1000).toISOString(),
      links: [{
        href: `https://checkout.razorpay.com/v1/checkout.js`,
        rel: 'checkout',
        method: 'GET',
      }],
    };
  }

  /**
   * Capture payment for an order (Razorpay auto-captures by default)
   */
  async captureOrder(orderId: string): Promise<CaptureResponse> {
    logger.info(`Getting Razorpay order payments: ${orderId}`);
    
    // Get payments for this order
    const payments = await this.makeRequest<{ items: RazorpayPayment[] }>(`/v1/orders/${orderId}/payments`);
    
    if (!payments.items || payments.items.length === 0) {
      throw new Error(`No payments found for order ${orderId}`);
    }

    const payment = payments.items[0]; // Get the first payment
    
    if (payment.status !== PaymentStatus.CAPTURED) {
      throw new Error(`Payment ${payment.id} is not captured. Status: ${payment.status}`);
    }

    return {
      id: payment.id,
      status: payment.status,
      amount: {
        currency_code: payment.currency,
        value: this.fromPaise(payment.amount),
      },
      created_at: new Date(payment.created_at * 1000).toISOString(),
      updated_at: new Date(payment.created_at * 1000).toISOString(),
    };
  }

  /**
   * Create a subscription
   */
  async createSubscription(subscriptionData: Subscription): Promise<Subscription> {
    logger.info('Creating Razorpay subscription:', subscriptionData);
    const razorpaySubscriptionData = {
      plan_id: subscriptionData.plan_id,
      customer_notify: 1,
      quantity: 1,
      total_count: 12, // Default to 12 payments, can be customized
      notes: {
        customer_name: subscriptionData?.customer?.name || '',
        customer_email: subscriptionData?.customer?.email,
      },
    };

    const subscription = await this.makeRequest<RazorpaySubscription>('/v1/subscriptions', 'POST', razorpaySubscriptionData);
    
    return {
      id: subscription.id,
      plan_id: subscription.plan_id,
      status: subscription.status,
      start_time: subscription.start_at ? new Date(subscription.start_at * 1000).toISOString() : '',
      links: subscription.short_url ? [{
        href: subscription.short_url,
        rel: 'authenticate',
        method: 'GET',
      }]: [],
    };
  }

  /**
   * Get subscription details by ID
   */
  async getSubscription(subscriptionId: string): Promise<Subscription> {
    logger.info(`Getting Razorpay subscription: ${subscriptionId}`);
    const subscription = await this.makeRequest<RazorpaySubscription>(`/v1/subscriptions/${subscriptionId}`);
    
    return {
      id: subscription.id,
      plan_id: subscription.plan_id,
      customer: {
        name: subscription.notes.customer_name,
        email: subscription.notes.customer_email,
      },
      status: subscription.status,
      start_time: subscription.start_at ? new Date(subscription.start_at * 1000).toISOString() : null,
      links: subscription.short_url ? [{
        href: subscription.short_url,
        rel: 'authenticate',
        method: 'GET',
      }] : [],
    };
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(subscriptionId: string, _reason?: string): Promise<Subscription> {
    logger.info(`Cancelling Razorpay subscription: ${subscriptionId}`);
    const subscription = await this.makeRequest<RazorpaySubscription>(`/v1/subscriptions/${subscriptionId}/cancel`, 'POST', {
      cancel_at_cycle_end: 0, // Cancel immediately
    });
    return {
      id: subscription.id,
      plan_id: subscription.plan_id,
      status: subscription.status,
      start_time: subscription.start_at ? new Date(subscription.start_at * 1000).toISOString() : null,
      links: subscription.short_url ? [{
        href: subscription.short_url,
        rel: 'authenticate',
        method: 'GET',
      }] : [],
      customer: {
        name: subscription.notes.customer_name,
        email: subscription.notes.customer_email,
      },
    };
  }

  /**
   * Refund a captured payment
   */
  async refundPayment(paymentId: string, refundData?: RefundRequest): Promise<Refund> {
    logger.info(`Refunding Razorpay payment: ${paymentId}`, refundData);
    
    if (!refundData?.amount?.value) {
      throw new Error('Amount is required');
    }
    const razorpayRefundData: RazorpayRefundRequest = {
      amount: this.toPaise(refundData?.amount?.value),
      speed: 'normal',
      notes: refundData?.notes || { reason: refundData?.reason || 'Refund requested' },
    };

    const refund = await this.makeRequest<RazorpayRefund>(`/v1/payments/${paymentId}/refund`, 'POST', razorpayRefundData);
    
    return {
      id: refund.id,
      status: refund.status,
      amount: {
        currency_code: refund.currency,
        value: this.fromPaise(refund.amount),
      },
      created_at: new Date(refund.created_at * 1000).toISOString(),
      updated_at: new Date(refund.created_at * 1000).toISOString(),
    };
  }

  /**
   * Get refund details by ID
   */
  async getRefund(refundId: string): Promise<Refund> {
    logger.info(`Getting Razorpay refund: ${refundId}`);
    const refund = await this.makeRequest<RazorpayRefund>(`/v1/refunds/${refundId}`);
    
    return {
      id: refund.id,
      status: refund.status,
      amount: {
        currency_code: refund.currency,
        value: this.fromPaise(refund.amount),
      },
      created_at: new Date(refund.created_at * 1000).toISOString(),
      updated_at: new Date(refund.created_at * 1000).toISOString(),
    };
  }

  /**
   * Verify webhook signature
   */
  async verifyWebhookSignature(headers: Record<string, string>, body: string): Promise<{ verified: boolean }> {
    try {
      const signature = headers['x-razorpay-signature'];
      if (!signature) {
        return { verified: false };
      }

      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(body)
        .digest('hex');

      const verified = signature === expectedSignature;
      logger.info(`Razorpay webhook signature verification: ${verified}`);
      
      return { verified };
    } catch (error) {
      logger.error('Error verifying Razorpay webhook signature:', error);
      return { verified: false };
    }
  }

  /**
   * Process webhook event
   */
  async processWebhookEvent(event: WebhookEvent): Promise<void> {
    logger.info(`Processing Razorpay webhook event: ${event.event_type}`, event);

    switch (event.event_type) {
      case 'payment.captured':
        logger.info('Payment captured:', event.resource);
        break;
      case 'payment.failed':
        logger.info('Payment failed:', event.resource);
        break;
      case 'subscription.created':
        logger.info('Subscription created:', event.resource);
        break;
      case 'subscription.activated':
        logger.info('Subscription activated:', event.resource);
        break;
      case 'subscription.cancelled':
        logger.info('Subscription cancelled:', event.resource);
        break;
      case 'subscription.charged':
        logger.info('Subscription charged:', event.resource);
        break;
      case 'refund.created':
        logger.info('Refund created:', event.resource);
        break;
      default:
        logger.info(`Unhandled webhook event type: ${event.event_type}`);
    }
  }

  // ==================== RAZORPAY SPECIFIC METHODS ====================

  /**
   * Get payment details by ID
   */
  async getPayment(paymentId: string): Promise<RazorpayPayment> {
    logger.info(`Getting Razorpay payment: ${paymentId}`);
    return await this.makeRequest<RazorpayPayment>(`/v1/payments/${paymentId}`);
  }

  /**
   * Capture a specific payment (for manual capture)
   */
  async capturePayment(paymentId: string, amount?: number): Promise<RazorpayPayment> {
    logger.info(`Capturing Razorpay payment: ${paymentId}`);
    const captureData = amount ? { amount } : {};
    return await this.makeRequest<RazorpayPayment>(`/v1/payments/${paymentId}/capture`, 'POST', captureData);
  }

  /**
   * Get customer by ID
   */
  async getCustomer(customerId: string): Promise<RazorpayCustomer> {
    logger.info(`Getting Razorpay customer: ${customerId}`);
    return await this.makeRequest<RazorpayCustomer>(`/v1/customers/${customerId}`);
  }
}
