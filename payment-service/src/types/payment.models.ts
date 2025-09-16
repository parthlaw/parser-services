import { z } from "zod";

const createOrderSchema = z.object({
  amount: z.number(),
  currency: z.string(),
});

const captureOrderSchema = z.object({
  orderId: z.string(),
});

const createSubscriptionSchema = z.object({
  productName: z.string(),
  planName: z.string(),
  price: z.number(),
  currency: z.string(),
});

const cancelSubscriptionSchema = z.object({
  subscriptionId: z.string(),
});

export { createOrderSchema, captureOrderSchema, createSubscriptionSchema, cancelSubscriptionSchema };