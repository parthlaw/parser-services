export enum OrderStatus {
  CREATED = 'CREATED',
  SAVED = 'SAVED',
  APPROVED = 'APPROVED',
  VOIDED = 'VOIDED',
  COMPLETED = 'COMPLETED',
  PAYER_ACTION_REQUIRED = 'PAYER_ACTION_REQUIRED',
}

export enum PaymentStatus {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  PENDING = 'PENDING',
  REFUNDED = 'REFUNDED',
}

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export enum RefundStatus {
  CANCELLED = 'CANCELLED',
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
}

export interface PayPalAccessToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export interface PayPalAmount {
  currency_code: string;
  value: string;
}

export interface PayPalPurchaseUnit {
  reference_id?: string;
  amount: PayPalAmount;
  description?: string;
  custom_id?: string;
  invoice_id?: string;
  soft_descriptor?: string;
}

export interface PayPalApplicationContext {
  brand_name?: string;
  locale?: string;
  landing_page?: "LOGIN" | "BILLING" | "NO_PREFERENCE";
  shipping_preference?: "GET_FROM_FILE" | "NO_SHIPPING" | "SET_PROVIDED_ADDRESS";
  user_action?: "CONTINUE" | "PAY_NOW";
  payment_method?: {
    payer_selected?: string;
    payee_preferred?: "UNRESTRICTED" | "IMMEDIATE_PAYMENT_REQUIRED";
  };
  return_url?: string;
  cancel_url?: string;
}

export interface PayPalOrderRequest {
  intent: "CAPTURE" | "AUTHORIZE";
  purchase_units: PayPalPurchaseUnit[];
  application_context?: PayPalApplicationContext;
}

export interface PayPalLink {
  href: string;
  rel: string;
  method: string;
}

export interface PayPalOrder {
  id: string;
  status: OrderStatus;
  links: PayPalLink[];
  intent: string;
  purchase_units: PayPalPurchaseUnit[];
  create_time?: string;
  update_time?: string;
}

export interface PayPalCaptureResponse {
  id: string;
  status: PaymentStatus;
  purchase_units: Array<{
    reference_id: string;
    payments: {
      captures: Array<{
        id: string;
        status: string;
        amount: PayPalAmount;
        create_time: string;
        update_time: string;
      }>;
    };
  }>;
}

// Subscription Types
export interface PayPalProduct {
  id?: string;
  name: string;
  description?: string;
  type: "PHYSICAL" | "DIGITAL" | "SERVICE";
  category?: string;
  image_url?: string;
  home_url?: string;
}

export interface PayPalBillingCycle {
  frequency: {
    interval_unit: "DAY" | "WEEK" | "MONTH" | "YEAR";
    interval_count: number;
  };
  tenure_type: "TRIAL" | "REGULAR";
  sequence: number;
  total_cycles?: number;
  pricing_scheme: {
    fixed_price: PayPalAmount;
  };
}

export interface PayPalPlan {
  id?: string;
  product_id: string;
  name: string;
  description?: string;
  status?: SubscriptionStatus;
  billing_cycles: PayPalBillingCycle[];
  payment_preferences?: {
    auto_bill_outstanding?: boolean;
    setup_fee?: PayPalAmount;
    setup_fee_failure_action?: "CONTINUE" | "CANCEL";
    payment_failure_threshold?: number;
  };
  taxes?: {
    percentage: string;
    inclusive: boolean;
  };
}

export interface PayPalSubscriber {
  name?: {
    given_name: string | null;
    surname: string | null;
  };
  email_address: string | null;
  payer_id?: string;
}

export interface PayPalSubscription {
  id?: string;
  plan_id: string;
  start_time?: string;
  quantity?: string;
  shipping_amount?: PayPalAmount;
  subscriber: PayPalSubscriber;
  application_context?: {
    brand_name?: string;
    locale?: string;
    shipping_preference?: "GET_FROM_FILE" | "NO_SHIPPING" | "SET_PROVIDED_ADDRESS";
    user_action?: "SUBSCRIBE_NOW" | "CONTINUE";
    payment_method?: {
      payer_selected?: string;
      payee_preferred?: "UNRESTRICTED" | "IMMEDIATE_PAYMENT_REQUIRED";
    };
    return_url?: string;
    cancel_url?: string;
  };
  status?: SubscriptionStatus;
  links?: PayPalLink[];
}

// Webhook Types
export interface PayPalWebhookEvent {
  id: string;
  event_version: string;
  create_time: string;
  resource_type: string;
  event_type: string;
  summary: string;
  resource: any;
  links: PayPalLink[];
}

// Refund Types
export interface PayPalRefundRequest {
  amount?: PayPalAmount;
  invoice_id?: string;
  note_to_payer?: string;
}

export interface PayPalRefund {
  id: string;
  status: RefundStatus;
  amount: PayPalAmount;
  create_time: string;
  update_time: string;
  links: PayPalLink[];
}