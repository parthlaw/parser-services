// Common interfaces for payment providers

export interface PaymentAmount {
  currency_code: string;
  value: string;
}

export interface PaymentOrder {
  id: string;
  status: string;
  links?: Array<{
    href: string;
    rel: string;
    method: string;
  }>;
  amount: PaymentAmount;
  created_at?: string;
  updated_at?: string;
}

export interface CreateOrderRequest {
  intent: 'CAPTURE' | 'AUTHORIZE';
  amount: PaymentAmount;
  description?: string;
  reference_id?: string;
  return_url?: string;
  cancel_url?: string;
  customer?: {
    name?: string;
    email?: string|null;
    phone?: string|null;
  };
}

export interface CaptureResponse {
  id: string;
  status: string;
  amount: PaymentAmount;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionProduct {
  id?: string;
  name: string;
  description?: string;
  type: 'PHYSICAL' | 'DIGITAL' | 'SERVICE';
}

export interface SubscriptionPlan {
  id?: string;
  product_id: string;
  name: string;
  description?: string|null;
  amount: PaymentAmount;
  interval: 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';
  interval_count: number;
  total_count?: number; // 0 for infinite
}

export interface Subscription {
  id?: string;
  plan_id: string;
  customer?: {
    name?: string | null;
    email: string | null;
    phone?: string;
  };
  status?: string;
  start_time?: string|null;
  links?: Array<{
    href: string;
    rel: string;
    method: string;
  }>;
}

export interface RefundRequest {
  amount?: PaymentAmount;
  reason?: string;
  notes?: Record<string, string>;
}

export interface Refund {
  id: string;
  status: string;
  amount: PaymentAmount;
  created_at: string;
  updated_at: string;
}

export interface WebhookEvent {
  id: string;
  event_type: string;
  created_at: string;
  resource_type: string;
  resource: any;
}

// Main payment provider interface
export interface IPaymentProvider {
  // Authentication
  getAccessToken?(): Promise<string>;
  getProviderName(): string;
  // Order Management (One-time payments)
  createOrder(orderData: CreateOrderRequest): Promise<PaymentOrder>;
  getOrder(orderId: string): Promise<PaymentOrder>;
  captureOrder(orderId: string): Promise<CaptureResponse>;
  authorizeOrder?(orderId: string): Promise<any>;

  // Subscription Management
  createSubscription(subscriptionData: Subscription): Promise<Subscription>;
  getSubscription(subscriptionId: string): Promise<Subscription>;
  cancelSubscription(subscriptionId: string, reason?: string): Promise<Subscription>;
  
  // Optional subscription methods
  activateSubscription?(subscriptionId: string, reason?: string): Promise<void>;
  suspendSubscription?(subscriptionId: string, reason?: string): Promise<void>;

  // Payment Management
  refundPayment(captureId: string, refundData?: RefundRequest): Promise<Refund>;
  getRefund(refundId: string): Promise<Refund>;

  // Webhook Management
  verifyWebhookSignature?(headers: Record<string, string>, body: string): Promise<{ verified: boolean }>;
  processWebhookEvent?(event: WebhookEvent): Promise<void>;
}

// Provider configuration interface
export interface PaymentProviderConfig {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  webhookSecret?: string;
  environment: 'sandbox' | 'production';
}

// Factory interface for creating payment providers
export interface IPaymentProviderFactory {
  createProvider(type: 'paypal' | 'razorpay', config: PaymentProviderConfig): IPaymentProvider;
}
