import { Router } from "express";
import { createOrder, captureOrder, createSubscription, cancelSubscription, processWebhook } from "@/controllers/payment.controllers";
import { withJwtAuth } from "@/middleware/auth";

const router = Router();

router.post("/order",withJwtAuth, createOrder);
router.post("/capture",withJwtAuth, captureOrder);
router.post("/subscription",withJwtAuth, createSubscription);
router.post("/cancel",withJwtAuth, cancelSubscription);
router.post("/webhook", processWebhook);

export default router;