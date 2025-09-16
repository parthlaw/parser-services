
export enum OrderStatus {
  CREATED = 'created',
  ATTEMPTED = 'attempted',
  PAID = 'paid',
}

export enum PaymentStatus {
  CREATED = 'created',
  AUTHORIZED = 'authorized',
  CAPTURED = 'captured',
  REFUNDED = 'refunded',
  FAILED = 'failed',
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

export enum RefundStatus {
  PENDING = 'pending',
  PROCESSED = 'processed',
  FAILED = 'failed',
}

export interface RazorpayOrder {
  id: string;
  entity: string;
  amount: number; // in paise (smallest currency unit)
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: OrderStatus;
  attempts: number;
  notes: Record<string, string>;
  created_at: number; // Unix timestamp
}

export interface RazorpayOrderRequest {
  amount: number; // in paise
  currency: string;
  receipt?: string;
  notes?: Record<string, string>;
  partial_payment?: boolean;
}

export interface RazorpayPayment {
  id: string;
  entity: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  order_id: string;
  invoice_id?: string;
  international: boolean;
  method: "card" | "netbanking" | "wallet" | "emi" | "upi";
  amount_refunded: number;
  refund_status?: "null" | "partial" | "full";
  captured: boolean;
  description?: string;
  card_id?: string;
  bank?: string;
  wallet?: string;
  vpa?: string;
  email: string;
  contact: string;
  notes: Record<string, string>;
  fee?: number;
  tax?: number;
  error_code?: string;
  error_description?: string;
  created_at: number;
}

export interface RazorpaySubscription {
  id: string;
  entity: string;
  plan_id: string;
  customer_id?: string;
  status: SubscriptionStatus;
  current_start?: number;
  current_end?: number;
  ended_at?: number;
  quantity: number;
  notes: Record<string, string>;
  charge_at: number;
  start_at?: number;
  end_at?: number;
  auth_attempts: number;
  total_count: number;
  paid_count: number;
  customer_notify: boolean;
  created_at: number;
  expire_by?: number;
  short_url?: string;
}

export interface RazorpayPlan {
  id: string;
  entity: string;
  interval: number;
  period: "daily" | "weekly" | "monthly" | "yearly";
  item: {
    id: string;
    active: boolean;
    name: string;
    description?: string;
    amount: number;
    unit_amount: number;
    currency: string;
    type: "plan";
    unit?: string;
    tax_inclusive: boolean;
    hsn_code?: string;
    sac_code?: string;
    tax_rate?: number;
    tags: string[];
    notes: Record<string, string>;
    created_at: number;
    updated_at: number;
  };
  notes: Record<string, string>;
  created_at: number;
}

export interface RazorpayPlanRequest {
  period: "daily" | "weekly" | "monthly" | "yearly";
  interval: number;
  item: {
    name: string;
    amount: number; // in paise
    currency: string;
    description?: string|null;
  };
  notes?: Record<string, string>;
}

export interface RazorpayCustomer {
  id: string;
  entity: string;
  name: string;
  email: string;
  contact: string;
  gstin?: string;
  notes: Record<string, string>;
  created_at: number;
}

export interface RazorpayCustomerRequest {
  name: string;
  email: string;
  contact: string;
  fail_existing?: "0" | "1";
  notes?: Record<string, string>;
  gstin?: string;
}

export interface RazorpayRefund {
  id: string;
  entity: string;
  amount: number;
  currency: string;
  payment_id: string;
  notes: Record<string, string>;
  receipt?: string;
  acquirer_data: {
    arn?: string;
  };
  created_at: number;
  batch_id?: string;
  status: RefundStatus;
  speed_processed: "normal" | "optimum";
  speed_requested: "normal" | "optimum";
}

export interface RazorpayRefundRequest {
  amount?: number; // in paise
  speed?: "normal" | "optimum";
  notes?: Record<string, string>;
  receipt?: string;
}

export interface RazorpayWebhookEvent {
  entity: string;
  account_id: string;
  event: string;
  contains: string[];
  payload: {
    payment?: {
      entity: RazorpayPayment;
    };
    order?: {
      entity: RazorpayOrder;
    };
    subscription?: {
      entity: RazorpaySubscription;
    };
    refund?: {
      entity: RazorpayRefund;
    };
  };
  created_at: number;
}