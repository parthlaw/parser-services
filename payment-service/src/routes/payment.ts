import { Router } from "express";
import { createOrder, captureOrder, createSubscription, cancelSubscription } from "@/controllers/payment.controllers";
import { withJwtAuth } from "@/middleware/auth";

const router = Router();

router.post("/order",withJwtAuth, createOrder);
router.post("/capture",withJwtAuth, captureOrder);
router.post("/subscription",withJwtAuth, createSubscription);
router.post("/cancel",withJwtAuth, cancelSubscription);

export default router;