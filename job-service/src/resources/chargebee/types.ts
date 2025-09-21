// Chargebee TypeScript types for common operations

export interface ChargebeeCustomer {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  company?: string;
  created_at: number;
  updated_at: number;
  deleted?: boolean;
}
export interface ChargebeeCustomerCreateDto {
  id?: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  company?: string;
  cf_user_id?: string;
}
export interface ChargebeeItemPrice {
  item_price_id: string;
  quantity?: number;
}
export enum PurchaseType {
  SUBSCRIPTION = 'subscription',
  ONE_TIME = 'bundle',
}
export interface ChargebeeSubscription {
  id: string;
  customer_id: string;
  plan_id: string;
  status: 'active' | 'in_trial' | 'cancelled' | 'non_renewing' | 'paused';
  current_term_start: number;
  current_term_end: number;
  created_at: number;
  updated_at: number;
  trial_end?: number;
  cancelled_at?: number;
  cancel_reason?: string;
}

export interface ChargebeeInvoice {
  id: string;
  customer_id: string;
  subscription_id?: string;
  status: 'paid' | 'payment_due' | 'not_paid' | 'voided' | 'pending';
  amount: number;
  amount_paid: number;
  amount_adjusted: number;
  currency_code: string;
  date: number;
  due_date?: number;
  created_at: number;
  updated_at: number;
}

export interface ChargebeePlan {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency_code: string;
  period: number;
  period_unit: 'month' | 'year';
  trial_period?: number;
  trial_period_unit?: 'day' | 'month';
  status: 'active' | 'archived';
  created_at: number;
  updated_at: number;
}

export interface CreateCustomerRequest {
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  company?: string;
}

export interface CreateSubscriptionRequest {
  customer_id: string;
  plan_id: string;
  trial_end?: number;
}

export interface UpdateSubscriptionRequest {
  plan_id?: string;
  trial_end?: number;
  end_of_term?: boolean;
}

export interface ChargebeeApiResponse<T> {
  list: T[];
  next_offset?: string;
}

export interface ChargebeeError {
  message: string;
  type: string;
  api_error_code?: string;
  param?: string;
}
