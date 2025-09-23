import { Router } from 'express';
import healthRoutes from './health';
import config from '@/config/environment';
import jobsRoutes from './jobs';
import uploadsRoutes from './upload';
import paymentRoutes from './payment.routes';
const router = Router();

// API version prefix
const apiPrefix = `${config.API_VERSION}`;

// Mount routes
router.use('/health', healthRoutes);
router.use(`/${apiPrefix}/jobs`, jobsRoutes);
router.use(`/${apiPrefix}/uploads`, uploadsRoutes);
router.use(`/${apiPrefix}/payment`, paymentRoutes);
// Root endpoint
router.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'Job Service API',
    version: config.API_VERSION,
    timestamp: new Date().toISOString(),
  });
});

export default router;
