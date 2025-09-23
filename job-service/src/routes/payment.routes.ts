import { Router } from 'express';
import {
  generateHostedCheckout,
  getSubscription,
  successCallbackHandler,
} from '@/controllers/payment.controller';
import { withJwtAuth } from '@/middleware/auth';

const router = Router();

router.get('/generate-hosted-checkout', withJwtAuth, generateHostedCheckout);
router.get('/success-callback', withJwtAuth, successCallbackHandler);
router.get('/subscription', withJwtAuth, getSubscription);
export default router;
