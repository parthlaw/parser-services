import { ApiError, asyncHandler } from "@/middleware/errorHandler";
import PaymentService from "@/services/payment.service";
import { cancelSubscriptionSchema, captureOrderSchema, createOrderSchema, createSubscriptionSchema } from "@/types/payment.models";
import ApiResponseHandler from "@/utils/apiResponseHandler";
import { User } from "@supabase/supabase-js";
import { Request, Response } from "express";

const createPaymentService = (req: Request) => {
  const userToken = req.headers["authorization"]?.split(" ")[1];
  return new PaymentService(req.headers["provider-type"] as "paypal" | "razorpay", req.headers["currency"] as string, req.headers["region"] as string, userToken)
}

export const createOrder = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { error, data } = createOrderSchema.safeParse(req.body);
  const user = req.user;
  if (error) {
    throw new ApiError(error.message, 400);
  }
  const paymentService = createPaymentService(req)
  const { amount, currency } = data;
  const order = await paymentService.createPayment(amount.toString(), currency, user as User);
  ApiResponseHandler.success(res, order, "Order created successfully");
});

export const captureOrder = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { error, data } = captureOrderSchema.safeParse(req.body);
  if (error) {
    throw new ApiError(error.message, 400);
  }
  const paymentService = createPaymentService(req)
  const { orderId } = data;
  const capture = await paymentService.capturePayment(orderId);
  ApiResponseHandler.success(res, capture, "Order captured successfully");
});

export const createSubscription = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
  const { error, data } = createSubscriptionSchema.safeParse(req.body);
  const user = req.user;
  if (error) {
    throw new ApiError(error.message, 400);
  }
  const paymentService = createPaymentService(req)
  const { planId, price, currency } = data;
  const subscription = await paymentService.createSubscription(planId, price.toString(), currency,"MONTH", user as User);
  ApiResponseHandler.success(res, subscription, "Subscription created successfully");
  } catch (error) {
    if (error instanceof ApiError) {
      ApiResponseHandler.error(res, error, "Error creating subscription", error.statusCode);
    } else {
      ApiResponseHandler.error(res, error, "Error creating subscription");
    }
  }
});

export const cancelSubscription = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const paymentService = createPaymentService(req)
  const { error, data } = cancelSubscriptionSchema.safeParse(req.body);
  if (error) {
    throw new ApiError(error.message, 400);
  }
  const { subscriptionId } = data;
  const subscription = await paymentService.cancelSubscription(subscriptionId);
  ApiResponseHandler.success(res, subscription, "Subscription cancelled successfully");
});

export const processWebhook = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const data =req.body;
  const paymentService = createPaymentService(req)
  const result = await paymentService.processWebhook(data);
  ApiResponseHandler.success(res, result, "Webhook processed successfully");
});