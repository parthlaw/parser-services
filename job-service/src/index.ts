import serverless from 'serverless-http';
import createApp from './app';
import config from '@/config/environment';
import logger from '@/utils/logger';

/**
 * Server Entry Point
 *
 * This file serves two purposes:
 * 1. Exports a serverless handler for AWS Lambda deployment
 * 2. Runs a local development server when NODE_ENV=development
 *
 * To run locally:
 * - Set NODE_ENV=development in your .env file or environment
 * - Run: npm run dev or node dist/index.js
 * - Server will start on localhost:3000 (or PORT from .env)
 */

// Create Express app
const app = createApp();

// Export handler for serverless deployment
export const handler = serverless(app, {
  // Serverless-http options
  binary: false,
  request: (request: any, event: any, context: any) => {
    // Add AWS Lambda context to request
    request.context = context;
    request.event = event;
  },
  response: (response: any, _event: any, context: any) => {
    // Custom response handling if needed
    logger.info('Lambda response', {
      statusCode: response.statusCode,
      requestId: context.awsRequestId,
      headers: response.headers,
    });
  },
});

// For local development - check both NODE_ENV and if we're not in AWS Lambda
if (config.NODE_ENV === 'development' && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  const PORT = config.PORT;

  app.listen(PORT, 'localhost', () => {
    logger.info(`🚀 Server running in ${config.NODE_ENV} mode on localhost:${PORT}`, {
      port: PORT,
      environment: config.NODE_ENV,
      version: config.API_VERSION,
      url: `http://localhost:${PORT}`,
    });

    // Log available endpoints
    logger.info(`📖 API Documentation available at http://localhost:${PORT}/health`);
    logger.info(`🔗 Server ready at http://localhost:${PORT}`);
  });
}

// Graceful shutdown handling
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error) => {
  logger.error('Unhandled Promise Rejection', { error: err.message, stack: err.stack });
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err: Error) => {
  logger.error('Uncaught Exception', { error: err.message, stack: err.stack });
  process.exit(1);
});

export default app;
