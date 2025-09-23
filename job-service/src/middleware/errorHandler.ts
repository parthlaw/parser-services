import { Request, Response, NextFunction } from 'express';
import { ErrorResponse } from '@/types';
import config from '@/config/environment';
import logger from '@/utils/logger';
import { ZodError } from 'zod';

/**
 * Custom Error class for API errors
 */
export class ApiError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Global error handling middleware
 * Should be the last middleware in the chain
 */
export const errorHandler = (
  error: Error | ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = 500;
  let message = 'Internal Server Error';
  let errorCode = 'INTERNAL_ERROR';

  // Handle different types of errors
  if (error instanceof ApiError) {
    statusCode = error.statusCode;
    message = error.message;
    errorCode = 'API_ERROR';
  } else if (error instanceof ZodError) {
    statusCode = 400;
    message =
      'Validation Error: ' +
      error.issues.map((issue: any) => `${issue.path.join('.')}: ${issue.message}`).join(', ');
    errorCode = 'VALIDATION_ERROR';
  } else if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
    errorCode = 'VALIDATION_ERROR';
  } else if (error.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid data format';
    errorCode = 'INVALID_FORMAT';
  } else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
    errorCode = 'INVALID_TOKEN';
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
    errorCode = 'TOKEN_EXPIRED';
  }

  // Log error details
  logger.error('Error occurred', {
    message: error.message,
    stack: error.stack,
    statusCode,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  // Prepare error response
  const errorResponse: ErrorResponse = {
    success: false,
    message,
    error: errorCode,
    statusCode,
    meta: {
      timestamp: new Date().toISOString(),
      version: config.API_VERSION,
    },
  };

  // Include stack trace in development
  if (config.NODE_ENV === 'development') {
    (errorResponse as any).stack = error.stack;
  }

  res.status(statusCode).json(errorResponse);
};

/**
 * Middleware to handle 404 errors
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  const errorResponse: ErrorResponse = {
    success: false,
    message: `Route ${req.originalUrl} not found`,
    error: 'NOT_FOUND',
    statusCode: 404,
    meta: {
      timestamp: new Date().toISOString(),
      version: config.API_VERSION,
    },
  };

  logger.warn('Route not found', {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
  });

  res.status(404).json(errorResponse);
};

/**
 * Async error wrapper to catch async errors
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
