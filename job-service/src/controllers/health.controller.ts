import { Request, Response } from 'express';
import { ApiResponse } from '@/types';
import config from '@/config/environment';
import { asyncHandler } from '@/middleware/errorHandler';
import logger from '@/utils/logger';

/**
 * Health check endpoint
 */
export const healthCheck = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV,
    version: config.API_VERSION,
    uptime: process.uptime(),
    memory: {
      used: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
      total: Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) / 100,
    },
  };

  logger.info('Health check performed', healthData);

  const response: ApiResponse = {
    success: true,
    message: 'Service is healthy',
    data: healthData,
    meta: {
      timestamp: new Date().toISOString(),
      version: config.API_VERSION,
    },
  };

  res.status(200).json(response);
});

/**
 * API info endpoint
 */
export const getApiInfo = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const apiInfo = {
    name: 'Job Service API',
    version: config.API_VERSION,
    environment: config.NODE_ENV,
    description: 'Modern serverless Express API with TypeScript',
    endpoints: {
      health: '/health',
      auth: {
        login: 'POST /api/v1/auth/login',
        register: 'POST /api/v1/auth/register',
        profile: 'GET /api/v1/auth/profile',
      },
    },
  };

  const response: ApiResponse = {
    success: true,
    message: 'API information retrieved successfully',
    data: apiInfo,
    meta: {
      timestamp: new Date().toISOString(),
      version: config.API_VERSION,
    },
  };

  res.status(200).json(response);
});
