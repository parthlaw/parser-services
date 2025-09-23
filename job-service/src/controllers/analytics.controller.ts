import { Request, Response } from 'express';
import { asyncHandler } from '@/middleware/errorHandler';
import ApiResponseHandler from '@/utils/apiResponseHandler';
import { AnalyticsService } from '@/services/analytics.service';
import { UnauthorizedError } from '@/utils/errors';

export const getAnalytics = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  // Ensure user is authenticated
  if (!req.user?.id) {
    throw new UnauthorizedError('Authentication required for analytics');
  }

  const analyticsService = new AnalyticsService(req.user.id);
  const analytics = await analyticsService.getAnalytics();

  ApiResponseHandler.success(res, analytics, 'Analytics fetched successfully');
});
