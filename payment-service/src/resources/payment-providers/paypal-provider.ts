import envConfig from "@/config/environment";
import {
  IPaymentProvider,
  PaymentProviderConfig,
  CreateOrderRequest,
  PaymentOrder,
  CaptureResponse,
  SubscriptionProduct,
  Subscription,
  RefundRequest,
  Refund,
  WebhookEvent,
} from "@/resources/payment-providers/payment-provider.interface";
import {
  PayPalAccessToken,
  PayPalOrder,
  PayPalOrderRequest,
  PayPalCaptureResponse,
  PayPalProduct,
  PayPalSubscription,
  PayPalRefund,
  PayPalRefundRequest,
} from "@/types/paypal.types";
import logger from "@/utils/logger";

export class PayPalProvider implements IPaymentProvider {
  private baseUrl: string;
  private clientId: string;
  private clientSecret: string;
  private webhookId: string;

  constructor(config?: PaymentProviderConfig) {
    this.baseUrl = config?.baseUrl || envConfig.PAYPAL_BASE_URL;
    this.clientId = config?.clientId || envConfig.PAYPAL_CLIENT_ID;
    this.clientSecret = config?.clientSecret || envConfig.PAYPAL_CLIENT_SECRET;
    this.webhookId = config?.webhookSecret || envConfig.PAYPAL_WEBHOOK_ID;
  }

  getProviderName(): string {
    return 'paypal';
  }

  /**
   * Get PayPal access token using OAuth 2.0
   */
  async getAccessToken(): Promise<string> {
    try {
      const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      
      const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json',
          'Accept-Language': 'en_US',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to get access token: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as PayPalAccessToken;
      return data.access_token;
    } catch (error) {
      logger.error('Error getting PayPal access token:', error);
      throw error;
    }
  }

  /**
   * Make authenticated request to PayPal API
   */
  private async makeRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
    body?: any,
    headers?: Record<string, string>
  ): Promise<T> {
    try {
      const accessToken = await this.getAccessToken();
      
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'PayPal-Request-Id': `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          ...headers,
        },
        ...(body && { body: JSON.stringify(body) }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`PayPal API error: ${response.status} ${response.statusText}`, errorText);
        throw new Error(`PayPal API error: ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json() as T;
      } else {
        return {} as T;
      }
    } catch (error) {
      logger.error(`Error making PayPal API request to ${endpoint}:`, error);
      throw error;
    }
  }

  // ==================== INTERFACE IMPLEMENTATION ====================

  /**
   * Create a PayPal order (implements IPaymentProvider)
   */
  async createOrder(orderData: CreateOrderRequest): Promise<PaymentOrder> {
    logger.info('Creating PayPal order:', orderData);
    
    const paypalOrderData: PayPalOrderRequest = {
      intent: orderData.intent,
      purchase_units: [{
        reference_id: orderData.reference_id,
        amount: orderData.amount,
        description: orderData.description,
      }],
      application_context: {
        return_url: orderData.return_url,
        cancel_url: orderData.cancel_url,
        user_action: 'PAY_NOW',
      },
    };

    // Add Prefer header to get full response including purchase_units
    const paypalOrder = await this.makeRequest<PayPalOrder>('/v2/checkout/orders', 'POST', paypalOrderData, {
      'Prefer': 'return=representation'
    });
    console.log("PAYPAL ORDER", paypalOrder);
    
    // Transform PayPal response to common interface
    return {
      id: paypalOrder.id,
      status: paypalOrder.status,
      links: paypalOrder.links,
      amount: paypalOrder.purchase_units[0].amount,
      created_at: paypalOrder.create_time,
      updated_at: paypalOrder.update_time,
    };
  }

  /**
   * Get order details by ID
   */
  async getOrder(orderId: string): Promise<PaymentOrder> {
    logger.info(`Getting PayPal order: ${orderId}`);
    const paypalOrder = await this.makeRequest<PayPalOrder>(`/v2/checkout/orders/${orderId}`, 'GET', undefined, {
      'Prefer': 'return=representation'
    });
    
    return {
      id: paypalOrder.id,
      status: paypalOrder.status,
      links: paypalOrder.links,
      amount: paypalOrder.purchase_units[0].amount,
      created_at: paypalOrder.create_time,
      updated_at: paypalOrder.update_time,
    };
  }

  /**
   * Capture payment for an order
   */
  async captureOrder(orderId: string): Promise<CaptureResponse> {
    logger.info(`Capturing PayPal order: ${orderId}`);
    const captureResult = await this.makeRequest<PayPalCaptureResponse>(`/v2/checkout/orders/${orderId}/capture`, 'POST');
    
    const capture = captureResult.purchase_units[0].payments.captures[0];
    return {
      id: capture.id,
      status: capture.status,
      amount: capture.amount,
      created_at: capture.create_time,
      updated_at: capture.update_time,
    };
  }

  /**
   * Authorize payment for an order
   */
  async authorizeOrder(orderId: string): Promise<any> {
    logger.info(`Authorizing PayPal order: ${orderId}`);
    return await this.makeRequest<any>(`/v2/checkout/orders/${orderId}/authorize`, 'POST');
  }

  /**
   * Create a product for subscriptions
   */
  async createProduct(productData: SubscriptionProduct): Promise<SubscriptionProduct> {
    logger.info('Creating PayPal product:', productData);
    
    const paypalProductData: PayPalProduct = {
      name: productData.name,
      description: productData.description,
      type: productData.type,
    };

    const product = await this.makeRequest<PayPalProduct>('/v1/catalogs/products', 'POST', paypalProductData);
    
    return {
      id: product.id,
      name: product.name!,
      description: product.description,
      type: product.type!,
    };
  }

  /**
   * Create a subscription
   */
  async createSubscription(subscriptionData: Subscription): Promise<Subscription> {
    logger.info('Creating PayPal subscription:', subscriptionData);
    
    const paypalSubscriptionData: PayPalSubscription = {
      plan_id: subscriptionData.plan_id,
      subscriber: {
        name: subscriptionData.customer?.name ? {
          given_name: subscriptionData.customer.name.split(' ')[0],
          surname: subscriptionData.customer.name.split(' ').slice(1).join(' ') || 'User',
        } : {
          given_name: null,
          surname: null,
        },
        email_address: subscriptionData.customer?.email || null,
      },
      application_context: {
        user_action: 'SUBSCRIBE_NOW',
      },
    };

    const subscription = await this.makeRequest<PayPalSubscription>('/v1/billing/subscriptions', 'POST', paypalSubscriptionData);
    
    return {
      id: subscription.id,
      plan_id: subscription.plan_id,
      customer: subscriptionData.customer,
      status: subscription.status,
      start_time: subscription.start_time,
      links: subscription.links,
    };
  }

  /**
   * Get subscription details by ID
   */
  async getSubscription(subscriptionId: string): Promise<Subscription> {
    logger.info(`Getting PayPal subscription: ${subscriptionId}`);
    const subscription = await this.makeRequest<PayPalSubscription>(`/v1/billing/subscriptions/${subscriptionId}`);
    
    return {
      id: subscription.id || "",
      plan_id: subscription.plan_id,
      customer: {
        name: subscription.subscriber.name ? 
          `${subscription.subscriber.name.given_name} ${subscription.subscriber.name.surname}` : 
          null,
        email: subscription.subscriber.email_address || null,
      },
      status: subscription.status || "UNKNOWN",
      start_time: subscription.start_time || null,
      links: subscription.links,
    };
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(subscriptionId: string, reason: string = 'Customer requested cancellation'): Promise<Subscription> {
    logger.info(`Cancelling PayPal subscription: ${subscriptionId}`);
    const subscription = await this.makeRequest<PayPalSubscription>(`/v1/billing/subscriptions/${subscriptionId}/cancel`, 'POST', { reason });
    return {
      id: subscription.id,
      plan_id: subscription.plan_id,
      customer: {
        name: subscription.subscriber.name ? 
          `${subscription.subscriber.name.given_name} ${subscription.subscriber.name.surname}` : 
          null,
        email: subscription.subscriber.email_address || null,
      },
      status: subscription.status,
      start_time: subscription.start_time,
      links: subscription.links,
    };
  }

  /**
   * Activate a subscription
   */
  async activateSubscription(subscriptionId: string, reason: string = 'Reactivating subscription'): Promise<void> {
    logger.info(`Activating PayPal subscription: ${subscriptionId}`);
    await this.makeRequest<void>(`/v1/billing/subscriptions/${subscriptionId}/activate`, 'POST', { reason });
  }

  /**
   * Suspend a subscription
   */
  async suspendSubscription(subscriptionId: string, reason: string = 'Suspending subscription'): Promise<void> {
    logger.info(`Suspending PayPal subscription: ${subscriptionId}`);
    await this.makeRequest<void>(`/v1/billing/subscriptions/${subscriptionId}/suspend`, 'POST', { reason });
  }

  /**
   * Refund a captured payment
   */
  async refundPayment(captureId: string, refundData?: RefundRequest): Promise<Refund> {
    logger.info(`Refunding PayPal capture: ${captureId}`, refundData);
    
    const paypalRefundData: PayPalRefundRequest | undefined = refundData ? {
      amount: refundData.amount,
      note_to_payer: refundData.reason,
    } : undefined;

    const refund = await this.makeRequest<PayPalRefund>(`/v2/payments/captures/${captureId}/refund`, 'POST', paypalRefundData);
    
    return {
      id: refund.id,
      status: refund.status,
      amount: refund.amount,
      created_at: refund.create_time,
      updated_at: refund.update_time,
    };
  }

  /**
   * Get refund details by ID
   */
  async getRefund(refundId: string): Promise<Refund> {
    logger.info(`Getting PayPal refund: ${refundId}`);
    const refund = await this.makeRequest<PayPalRefund>(`/v2/payments/refunds/${refundId}`);
    
    return {
      id: refund.id,
      status: refund.status,
      amount: refund.amount,
      created_at: refund.create_time,
      updated_at: refund.update_time,
    };
  }

  /**
   * Verify webhook signature
   */
  async verifyWebhookSignature(headers: Record<string, string>, body: string): Promise<{ verified: boolean }> {
    try {
      const verificationData = {
        auth_algo: headers['paypal-auth-algo'],
        cert_id: headers['paypal-cert-id'],
        transmission_id: headers['paypal-transmission-id'],
        transmission_sig: headers['paypal-transmission-sig'],
        transmission_time: headers['paypal-transmission-time'],
        webhook_id: this.webhookId,
        webhook_event: JSON.parse(body),
      };

      logger.info('Verifying PayPal webhook signature');
      return await this.makeRequest<{ verified: boolean }>('/v1/notifications/verify-webhook-signature', 'POST', verificationData);
    } catch (error) {
      logger.error('Error verifying PayPal webhook signature:', error);
      throw error;
    }
  }

  /**
   * Process webhook event
   */
  async processWebhookEvent(event: WebhookEvent): Promise<void> {
    logger.info(`Processing PayPal webhook event: ${event.event_type}`, event);

    switch (event.event_type) {
      case 'PAYMENT.CAPTURE.COMPLETED':
        logger.info('Payment capture completed:', event.resource);
        break;
      case 'PAYMENT.CAPTURE.DENIED':
        logger.info('Payment capture denied:', event.resource);
        break;
      case 'BILLING.SUBSCRIPTION.CREATED':
        logger.info('Subscription created:', event.resource);
        break;
      case 'BILLING.SUBSCRIPTION.ACTIVATED':
        logger.info('Subscription activated:', event.resource);
        break;
      case 'BILLING.SUBSCRIPTION.CANCELLED':
        logger.info('Subscription cancelled:', event.resource);
        break;
      case 'BILLING.SUBSCRIPTION.SUSPENDED':
        logger.info('Subscription suspended:', event.resource);
        break;
      case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED':
        logger.info('Subscription payment failed:', event.resource);
        break;
      default:
        logger.info(`Unhandled webhook event type: ${event.event_type}`);
    }
  }
}
