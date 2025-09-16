import { Router } from 'express';
import { healthCheck, getApiInfo } from '@/controllers/health.controller';

const router = Router();

// Health check routes
router.get('/', healthCheck);
router.get('/info', getApiInfo);

export default router;
