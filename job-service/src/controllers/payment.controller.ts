import { Request, Response } from "express";
import { PaymentService } from "@/services/payment.service";
import { User } from "@supabase/supabase-js";
import ApiResponseHandler from "@/utils/apiResponseHandler";
import { asyncHandler } from "@/middleware/errorHandler";
import { PurchaseType } from "@/resources/chargebee/types";

const getPaymentService = (req: Request) => {
    return new PaymentService(req.user as User);
}

export const generateHostedCheckout = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const paymentService = getPaymentService(req);
    const priceId = req.query.priceId as string;
    const purchaseType = req.query.purchaseType as PurchaseType
    const hostedCheckout = await paymentService.generateHostedCheckout([{ item_price_id: priceId }], purchaseType);
    ApiResponseHandler.success(res, { hostedCheckout: hostedCheckout }, "Hosted checkout generated successfully");
});

export const successCallbackHandler = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const paymentService = getPaymentService(req);
    const hostedCheckoutId = req.query.hostedCheckoutId as string;
    const result = await paymentService.successCallbackHandler(hostedCheckoutId);
    ApiResponseHandler.success(res, result, "Payment successful");
});

export const getSubscription = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const paymentService = getPaymentService(req);
    const subscription = await paymentService.getSubscription(req.user?.id as string);
    ApiResponseHandler.success(res, { subscription }, "Subscription fetched successfully");
});