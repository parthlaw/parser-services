import { ApiError, asyncHandler } from "@/middleware/errorHandler";
import PaymentService from "@/services/payment.service";
import { cancelSubscriptionSchema, captureOrderSchema, createOrderSchema, createSubscriptionSchema } from "@/types/payment.models";
import { Request, Response } from "express";

const createPaymentService = (req: Request) => {
  return new PaymentService(req.headers["provider-type"] as "paypal" | "razorpay", req.headers["currency"] as string, req.headers["region"] as string)
}

export const createOrder = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { error, data } = createOrderSchema.safeParse(req.body);
  const user = req.user;
  if (error) {
    throw new ApiError(error.message, 400);
  }
  const paymentService = createPaymentService(req)
  const { amount, currency } = data;
  const order = await paymentService.createPayment(amount.toString(), currency, user?.email);
  res.status(200).json(order);
});

export const captureOrder = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { error, data } = captureOrderSchema.safeParse(req.body);
  if (error) {
    throw new ApiError(error.message, 400);
  }
  const paymentService = createPaymentService(req)
  const { orderId } = data;
  const capture = await paymentService.capturePayment(orderId);
  res.status(200).json(capture);
});

export const createSubscription = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { error, data } = createSubscriptionSchema.safeParse(req.body);
  const user = req.user;
  if (error) {
    throw new ApiError(error.message, 400);
  }
  const paymentService = createPaymentService(req)
  const { productName, planName, price, currency } = data;
  const subscriberEmail = user?.email;
  const subscriberName = user?.name;
  const subscription = await paymentService.createSubscription(productName, planName, price.toString(), currency,"MONTH", subscriberEmail || '', subscriberName || '');
  res.status(200).json(subscription);
});

export const cancelSubscription = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const paymentService = createPaymentService(req)
  const { error, data } = cancelSubscriptionSchema.safeParse(req.body);
  if (error) {
    throw new ApiError(error.message, 400);
  }
  const { subscriptionId } = data;
  const subscription = await paymentService.cancelSubscription(subscriptionId);
  res.status(200).json(subscription);
});

