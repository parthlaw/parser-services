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

export interface PaymentRepository {
  // Subscription operations
  createSubscription(data: CreateSubscriptionDto): Promise<DbSubscription>;
  getSubscriptionById(id: string): Promise<DbSubscription | null>;
  getSubscriptionByGatewayId(gatewaySubscriptionId: string): Promise<DbSubscription | null>;
  getSubscriptions(filters?: SubscriptionFilters): Promise<DbSubscription[]>;
  updateSubscription(id: string, data: UpdateSubscriptionDto): Promise<DbSubscription>;
  deleteSubscription(id: number): Promise<boolean>;

  // Order operations
  createOrder(data: CreateOrderDto): Promise<DbOrder>;
  getOrderById(id: string): Promise<DbOrder | null>;
  getOrderByGatewayId(gatewayOrderId: string): Promise<DbOrder | null>;
  getOrders(filters?: OrderFilters): Promise<DbOrder[]>;
  updateOrder(id: string, data: UpdateOrderDto): Promise<DbOrder>;
  updateOrderByGatewayId(gatewayOrderId: string, data: UpdateOrderDto): Promise<DbOrder>;
  // Payment operations
  createPayment(data: CreatePaymentDto): Promise<DbPayment>;
  getPaymentById(id: string): Promise<DbPayment | null>;
  getPaymentByGatewayId(gatewayPaymentId: string): Promise<DbPayment | null>;
  getPayments(filters?: PaymentFilters): Promise<DbPayment[]>;
  getPaymentsWithDetails(filters?: PaymentFilters): Promise<PaymentWithDetails[]>;
  updatePayment(id: string, data: UpdatePaymentDto): Promise<DbPayment>;

  // Refund operations
  createRefund(data: CreateRefundDto): Promise<DbRefund>;
  getRefundById(id: string): Promise<DbRefund | null>;
  getRefundByGatewayId(gatewayRefundId: string): Promise<DbRefund | null>;
  getRefunds(filters?: RefundFilters): Promise<DbRefund[]>;
  getRefundsWithPayment(filters?: RefundFilters): Promise<RefundWithPayment[]>;
  updateRefund(id: string, data: UpdateRefundDto): Promise<DbRefund>;
}