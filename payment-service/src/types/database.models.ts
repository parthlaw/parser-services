import { SubscriptionStatus as PayPalSubscriptionStatus, RefundStatus as PayPalRefundStatus, PaymentStatus as PayPalPaymentStatus, OrderStatus as PayPalOrderStatus } from "./paypal.types";
import { OrderStatus as RazorpayOrderStatus, PaymentStatus as RazorpayPaymentStatus, RefundStatus as RazorpayRefundStatus, SubscriptionStatus as RazorpaySubscriptionStatus } from "./razorpay.types";
// Database entity types based on the payment schema migration

export type PaymentGateway = 'razorpay' | 'paypal';
export type SubscriptionStatus = PayPalSubscriptionStatus | RazorpaySubscriptionStatus;
export type OrderStatus = PayPalOrderStatus | RazorpayOrderStatus;
export type PaymentStatus = PayPalPaymentStatus | RazorpayPaymentStatus;
export type RefundStatus = PayPalRefundStatus | RazorpayRefundStatus;

export interface DbSubscription {
  id: number;
  user_id: string;
  gateway_plan_id: string;
  gateway_subscription_id: string;
  gateway: PaymentGateway;
  status: SubscriptionStatus;
  start_date: string; // ISO date string
  end_date?: string; // ISO date string
  created_at: string;
}

export interface DbOrder {
  id: number;
  user_id: string;
  gateway_order_id: string;
  gateway: PaymentGateway;
  amount: number; // decimal(10,2)
  currency: string;
  status: OrderStatus;
  created_at: string;
}

export interface DbPayment {
  id: number;
  order_id?: string;
  subscription_id?: number;
  gateway_payment_id: string;
  gateway: PaymentGateway;
  amount: number; // decimal(10,2)
  currency: string;
  status: PaymentStatus;
  payment_date: string;
}

export interface DbRefund {
  id: number;
  payment_id: number;
  gateway_refund_id: string;
  amount: number; // decimal(10,2)
  status: RefundStatus;
  created_at: string;
}

// Create/Update DTOs (Data Transfer Objects)
export interface CreateSubscriptionDto {
  user_id: string;
  gateway_plan_id: string;
  gateway_subscription_id: string;
  gateway: PaymentGateway;
  status?: SubscriptionStatus;
  start_date: string;
  end_date?: string;
  updated_at: string;
  created_at: string;
}

export interface UpdateSubscriptionDto {
  gateway_subscription_id?: string;
  status?: SubscriptionStatus;
  end_date?: string;
  updated_at: string;
}

export interface CreateOrderDto {
  user_id: string;
  gateway_order_id: string;
  gateway: PaymentGateway;
  amount: number;
  currency: string;
  status?: OrderStatus;
  created_at: string;
  updated_at: string;
}

export interface UpdateOrderDto {
  status?: OrderStatus;
  updated_at: string;
}

export interface CreatePaymentDto {
  order_id?: number;
  subscription_id?: number;
  gateway_payment_id: string;
  gateway: PaymentGateway;
  amount: number;
  currency: string;
  status?: PaymentStatus;
  updated_at: string;
  created_at: string;
}

export interface UpdatePaymentDto {
  status?: PaymentStatus;
}

export interface CreateRefundDto {
  payment_id: number;
  gateway_refund_id: string;
  amount: number;
  status?: RefundStatus;
  updated_at: string;
  created_at: string;
}

export interface UpdateRefundDto {
  status?: RefundStatus;
  updated_at: string;
}

// Query filters
export interface SubscriptionFilters {
  user_id?: string;
  gateway?: PaymentGateway;
  status?: SubscriptionStatus;
  gateway_subscription_id?: string;
}

export interface OrderFilters {
  user_id?: string;
  gateway?: PaymentGateway;
  status?: OrderStatus;
  gateway_order_id?: string;
}

export interface PaymentFilters {
  order_id?: number;
  subscription_id?: number;
  gateway?: PaymentGateway;
  status?: PaymentStatus;
  gateway_payment_id?: string;
}

export interface RefundFilters {
  payment_id?: number;
  status?: RefundStatus;
  gateway_refund_id?: string;
}

// Joined entities for complex queries
export interface PaymentWithOrder extends DbPayment {
  order?: DbOrder;
}

export interface PaymentWithSubscription extends DbPayment {
  subscription?: DbSubscription;
}

export interface PaymentWithDetails extends DbPayment {
  order?: DbOrder;
  subscription?: DbSubscription;
  refunds?: DbRefund[];
}

export interface RefundWithPayment extends DbRefund {
  payment?: DbPayment;
}
