/**
 * Centralized Error Handling Middleware
 * Catches all errors and returns consistent JSON responses
 */

import type { Context, Next } from 'hono';
import { AppError, wrapError, isOperationalError } from '../utils/errors';
import { logger, generateRequestId } from '../utils/logger';

/**
 * Add request ID to context
 */
export async function requestIdMiddleware(c: Context, next: Next) {
  const requestId = generateRequestId();
  c.set('requestId', requestId);
  c.header('X-Request-ID', requestId);
  await next();
}

/**
 * Request logging middleware
 * This should run AFTER the error handler in the middleware chain
 */
export async function requestLoggerMiddleware(c: Context, next: Next) {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;
  const requestId = c.get('requestId');

  try {
    await next();
  } finally {
    const duration = Date.now() - start;
    const status = c.res?.status ?? 500;
    const user = c.get('user');

    logger.request(method, path, status, duration, {
      requestId,
      userId: user?.id,
      username: user?.username,
    });
  }
}

/**
 * Global error handler middleware
 * Must be registered early in the middleware chain
 */
export async function errorHandler(c: Context, next: Next) {
  try {
    await next();
  } catch (err) {
    const requestId = c.get('requestId');
    const user = c.get('user');

    // Check if it's already an AppError
    if (err instanceof AppError) {
      // Log operational errors at info/warn level, not error
      if (err.isOperational) {
        logger.warn(`${err.code}: ${err.message}`, {
          requestId,
          userId: user?.id,
          username: user?.username,
          method: c.req.method,
          path: c.req.path,
          metadata: { statusCode: err.statusCode },
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
          ...err.toJSON(),
          requestId,
        },
        err.statusCode as any
      );
    }

    // Wrap unknown errors
    const error = wrapError(err);

    // Log the error
    logger.error('Request error', err, {
      requestId,
      userId: user?.id,
      username: user?.username,
      method: c.req.method,
      path: c.req.path,
    });

    // For non-operational errors (bugs), don't expose details
    return c.json(
      {
        status: 'error',
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        requestId,
      },
      500
    );
  }
}

/**
 * 404 Not Found handler for unmatched routes
 */
export function notFoundHandler(c: Context) {
  const requestId = c.get('requestId');
  
  return c.json(
    {
      status: 'error',
      code: 'NOT_FOUND',
      message: `Route ${c.req.method} ${c.req.path} not found`,
      requestId,
    },
    404
  );
}

/**
 * Async wrapper for route handlers
 * Automatically catches async errors
 */
export function asyncHandler<T>(
  fn: (c: Context) => Promise<T>
): (c: Context) => Promise<T> {
  return async (c: Context) => {
    try {
      return await fn(c);
    } catch (error) {
      throw error; // Let the error handler middleware catch it
    }
  };
}
