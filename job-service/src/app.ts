import express, { Application } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import config from '@/config/environment';
import logger, { loggerStream } from '@/utils/logger';
import routes from '@/routes';
import { errorHandler, notFoundHandler } from '@/middleware/errorHandler';

/**
 * Create Express application
 */
const createApp = (): Application => {
  const app: Application = express();

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP for API
    crossOriginEmbedderPolicy: false,
  }));

  // CORS is handled by API Gateway, not Express

  // Compression disabled - let API Gateway handle it
  // app.use(compression());

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // HTTP request logging
  if (config.NODE_ENV === 'development') {
    app.use(morgan('dev'));
  } else {
    app.use(morgan('combined', { stream: loggerStream }));
  }

  // Custom request logging
  app.use((req, _res, next) => {
    logger.info('Incoming request', {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });
    next();
  });

  // Health check endpoint (outside API versioning)
  app.get('/ping', (_req, res) => {
    res.status(200).json({ message: 'pong', timestamp: new Date().toISOString() });
  });

  // Mount routes
  app.use('/', routes);

  // Error handling middleware (must be last)
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

export default createApp;
