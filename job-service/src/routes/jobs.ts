import { Router } from 'express';
import {
  getJobs,
  getJob,
  createJob,
  getResults,
  getJobDownloadUrl,
} from '@/controllers/jobs.controller';
import { getAnalytics } from '@/controllers/analytics.controller';
import { withJwtAuth, withJwtAuthNoAuth } from '@/middleware/auth';

const router = Router();

router.get('/analytics', withJwtAuth, getAnalytics);
router.get('/', withJwtAuth, getJobs);
router.get('/:id', withJwtAuth, getJob);
router.post('/', withJwtAuthNoAuth, createJob);
router.get('/:id/results', withJwtAuthNoAuth, getResults);
router.get('/:id/download-url', withJwtAuthNoAuth, getJobDownloadUrl);

export default router;
