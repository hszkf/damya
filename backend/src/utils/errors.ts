/**
 * Custom Error Classes for the application
 * Provides structured error handling with proper HTTP status codes
 */

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);

    // Set the prototype explicitly
    Object.setPrototypeOf(this, AppError.prototype);
  }

  toJSON() {
    return {
      status: 'error',
      code: this.code,
      message: this.message,
      ...(this.details && { details: this.details }),
    };
  }
}

/**
 * 400 Bad Request - Invalid input or validation errors
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 400, 'VALIDATION_ERROR', true, details);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * 401 Unauthorized - Authentication required or failed
 */
export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR', true);
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * 403 Forbidden - User doesn't have permission
 */
export class AuthorizationError extends AppError {
  constructor(message: string = 'You do not have permission to perform this action') {
    super(message, 403, 'AUTHORIZATION_ERROR', true);
    Object.setPrototypeOf(this, AuthorizationError.prototype);
  }
}

/**
 * 404 Not Found - Resource not found
 */
export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND', true);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * 409 Conflict - Resource already exists or conflict state
 */
export class ConflictError extends AppError {
  constructor(message: string = 'Resource already exists') {
    super(message, 409, 'CONFLICT', true);
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

/**
 * 422 Unprocessable Entity - Business logic error
 */
export class BusinessError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 422, 'BUSINESS_ERROR', true, details);
    Object.setPrototypeOf(this, BusinessError.prototype);
  }
}

/**
 * 429 Too Many Requests - Rate limit exceeded
 */
export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests, please try again later') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', true);
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

/**
 * 500 Internal Server Error - Database errors
 */
export class DatabaseError extends AppError {
  constructor(message: string = 'Database operation failed', details?: Record<string, unknown>) {
    super(message, 500, 'DATABASE_ERROR', true, details);
    Object.setPrototypeOf(this, DatabaseError.prototype);
  }
}

/**
 * 502 Bad Gateway - External service errors (S3, Redshift, etc.)
 */
export class ExternalServiceError extends AppError {
  constructor(service: string, message: string = 'External service error') {
    super(`${service}: ${message}`, 502, 'EXTERNAL_SERVICE_ERROR', true, { service });
    Object.setPrototypeOf(this, ExternalServiceError.prototype);
  }
}

/**
 * 503 Service Unavailable - Service temporarily unavailable
 */
export class ServiceUnavailableError extends AppError {
  constructor(message: string = 'Service temporarily unavailable') {
    super(message, 503, 'SERVICE_UNAVAILABLE', true);
    Object.setPrototypeOf(this, ServiceUnavailableError.prototype);
  }
}

/**
 * SQL Query Protection Error
 */
export class QueryBlockedError extends AppError {
  constructor(command: string, role: string) {
    super(
      `Query blocked: ${command} operations are not allowed for ${role} role`,
      403,
      'QUERY_BLOCKED',
      true,
      { command, role }
    );
    Object.setPrototypeOf(this, QueryBlockedError.prototype);
  }
}

/**
 * Check if error is an operational error (expected) vs programming error (bug)
 */
export function isOperationalError(error: Error): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}

/**
 * Wrap unknown errors into AppError
 */
export function wrapError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(error.message, 500, 'INTERNAL_ERROR', false);
  }

  return new AppError('An unexpected error occurred', 500, 'UNKNOWN_ERROR', false);
}
