import { z } from "zod";

const createOrderSchema = z.object({
  amount: z.number(),
  currency: z.string(),
});

const captureOrderSchema = z.object({
  orderId: z.string(),
});

const createSubscriptionSchema = z.object({
  planId: z.string(),
  price: z.number(),
  currency: z.string(),
});

const cancelSubscriptionSchema = z.object({
  subscriptionId: z.string(),
});

export interface CreateSubscriptionResult {
  subscriptionId: string;
  startDate: string;
}

export { createOrderSchema, captureOrderSchema, createSubscriptionSchema, cancelSubscriptionSchema };