import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { prettyJSON } from 'hono/pretty-json';
import { sqlRoutes } from './routes/sql';
import { storageRoutes } from './routes/storage';
import { usersRoutes } from './routes/users';
import { logsRoutes } from './routes/logs';
import { deploymentRoutes } from './routes/deployments';
import { appLogsRoutes } from './routes/app-logs';
import { initRedshift, closeRedshift, getHealthStatus as getRedshiftHealth } from './services/database/redshift';
import { storageService } from './services/storage-service';
import { requestIdMiddleware, requestLoggerMiddleware, errorHandler, notFoundHandler } from './middleware/error-handler';
import { logger } from './utils/logger';

const app = new Hono();

// Use Hono's built-in onError handler for proper error catching
app.onError((err, c) => {
  const requestId = c.get('requestId') || 'unknown';
  const user = c.get('user');

  // Check if it's an AppError
  if ((err as any).statusCode && (err as any).code) {
    const appError = err as any;
    
    // Log based on whether it's operational
    if (appError.isOperational) {
      logger.warn(`${appError.code}: ${appError.message}`, {
        requestId,
        userId: user?.id,
        username: user?.username,
        method: c.req.method,
        path: c.req.path,
        metadata: { statusCode: appError.statusCode },
      });
    } else {
      logger.error('Request error', err, {
        requestId,
        userId: user?.id,
        username: user?.username,
        method: c.req.method,
        path: c.req.path,
      });
    }

    return c.json(
      {
        status: 'error',
        code: appError.code,
        message: appError.message,
        ...(appError.details && { details: appError.details }),
        requestId,
      },
      appError.statusCode
    );
  }

  // Unknown error
  logger.error('Unexpected error', err, {
    requestId,
    userId: user?.id,
    username: user?.username,
    method: c.req.method,
    path: c.req.path,
  });

  return c.json(
    {
      status: 'error',
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      requestId,
    },
    500
  );
});

// Global middleware (order matters!)
// 1. Request ID first so all logs have it
app.use('*', requestIdMiddleware);
// 2. CORS for cross-origin requests
app.use('*', cors({
  origin: '*',
  credentials: true,
}));
// 3. Pretty JSON for readable responses
app.use('*', prettyJSON());
// 4. Request logger
app.use('*', requestLoggerMiddleware);

// Health check (no auth required)
app.get('/health', (c) => {
  return c.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Health endpoints for each service (no auth required)
app.get('/redshift/health', async (c) => {
  try {
    const health = await getRedshiftHealth();
    return c.json(health, health.connected ? 200 : 503);
  } catch (error) {
    return c.json({ status: 'disconnected', connected: false, error: (error as Error).message }, 503);
  }
});

app.get('/storage/health', async (c) => {
  try {
    const health = await storageService.healthCheck();
    return c.json({
      status: health.connected ? 'connected' : 'disconnected',
      bucket: health.bucket,
      prefix: health.prefix,
      region: process.env.AWS_REGION || 'ap-southeast-1',
      error: health.connected ? null : 'Unable to connect to S3',
    }, health.connected ? 200 : 503);
  } catch (error) {
    return c.json({ status: 'disconnected', connected: false, error: (error as Error).message }, 503);
  }
});

// Routes are now public (no auth required)

// Mount routes
app.route('/redshift', sqlRoutes);
app.route('/storage', storageRoutes);
app.route('/users', usersRoutes);
app.route('/logs', logsRoutes);
app.route('/deployments', deploymentRoutes);
app.route('/app-logs', appLogsRoutes);

// 404 handler
app.notFound(notFoundHandler);

// Startup
async function startup() {
  logger.info('Starting Data Products API...');

  // Initialize Redshift
  try {
    await initRedshift();
    logger.info('Redshift connection initialized');
  } catch (error) {
    logger.warn('Redshift connection failed (will retry on first request)', {
      metadata: { error: (error as Error).message }
    });
  }

  // Check S3 Storage connection
  try {
    const s3Health = await storageService.healthCheck();
    if (s3Health.connected) {
      logger.info('S3 Storage connected', {
        metadata: { bucket: s3Health.bucket, prefix: s3Health.prefix }
      });
    } else {
      logger.warn('S3 Storage disconnected - check AWS credentials', {
        metadata: { bucket: s3Health.bucket }
      });
    }
  } catch (error) {
    logger.warn('S3 Storage check failed', {
      metadata: { error: (error as Error).message }
    });
  }

  logger.info('Server startup complete');
  console.log('🚀 Data Products API started successfully');
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down...');
  console.log('\n🛑 Shutting down...');
  await closeRedshift();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down...');
  console.log('\n🛑 Shutting down...');
  await closeRedshift();
  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
  console.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', reason as Error);
  console.error('Unhandled rejection:', reason);
});

// Start server immediately, initialize databases in background
const port = parseInt(process.env.PORT || '8080');
console.log(`🌐 Server running on http://localhost:${port}`);
startup();

export default {
  port,
  idleTimeout: 120, // 2 minutes timeout for long-running queries (default is 10s)
  fetch(req: Request) {
    return app.fetch(req);
  },
};
