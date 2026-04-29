/**
 * Frontend Error Utilities
 * Parse and handle API errors consistently
 */

export interface ApiError {
  status: 'error';
  code: string;
  message: string;
  details?: Record<string, unknown>;
  requestId?: string;
}

export interface ApiErrorResponse {
  statusCode: number;
  error: ApiError;
}

/**
 * Check if response is an API error
 */
export function isApiError(data: unknown): data is ApiError {
  return (
    typeof data === 'object' &&
    data !== null &&
    'status' in data &&
    (data as any).status === 'error' &&
    'message' in data
  );
}

/**
 * Parse error response from API
 */
export async function parseApiError(response: Response): Promise<ApiErrorResponse> {
  let error: ApiError;

  try {
    const data = await response.json();
    
    if (isApiError(data)) {
      error = data;
    } else {
      error = {
        status: 'error',
        code: 'UNKNOWN_ERROR',
        message: data.message || data.error || 'An error occurred',
      };
    }
  } catch {
    error = {
      status: 'error',
      code: 'PARSE_ERROR',
      message: response.statusText || 'Failed to parse error response',
    };
  }

  return {
    statusCode: response.status,
    error,
  };
}

/**
 * Get user-friendly error message
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (isApiError(error)) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'An unexpected error occurred';
}

/**
 * Error codes that should trigger logout
 */
const LOGOUT_ERROR_CODES = ['AUTHENTICATION_ERROR', 'TOKEN_EXPIRED', 'INVALID_TOKEN'];

/**
 * Check if error should trigger logout
 */
export function shouldLogout(error: ApiError): boolean {
  return LOGOUT_ERROR_CODES.includes(error.code);
}

/**
 * Error codes that can be retried
 */
const RETRYABLE_ERROR_CODES = ['SERVICE_UNAVAILABLE', 'EXTERNAL_SERVICE_ERROR', 'DATABASE_ERROR'];

/**
 * Check if error can be retried
 */
export function isRetryableError(error: ApiError): boolean {
  return RETRYABLE_ERROR_CODES.includes(error.code);
}

/**
 * Custom error class for API errors
 */
export class ApiRequestError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: Record<string, unknown>;
  public readonly requestId?: string;

  constructor(error: ApiError, statusCode: number) {
    super(error.message);
    this.name = 'ApiRequestError';
    this.statusCode = statusCode;
    this.code = error.code;
    this.details = error.details;
    this.requestId = error.requestId;
  }

  isAuthError(): boolean {
    return this.statusCode === 401 || LOGOUT_ERROR_CODES.includes(this.code);
  }

  isForbidden(): boolean {
    return this.statusCode === 403;
  }

  isNotFound(): boolean {
    return this.statusCode === 404;
  }

  isValidationError(): boolean {
    return this.statusCode === 400 || this.code === 'VALIDATION_ERROR';
  }

  isServerError(): boolean {
    return this.statusCode >= 500;
  }

  isRetryable(): boolean {
    return this.isServerError() || isRetryableError({
      status: 'error',
      code: this.code,
      message: this.message,
    });
  }
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
};

/**
 * Calculate delay with exponential backoff
 */
export function calculateBackoff(attempt: number, config: RetryConfig = DEFAULT_RETRY_CONFIG): number {
  const delay = config.baseDelay * Math.pow(2, attempt);
  return Math.min(delay, config.maxDelay);
}

/**
 * Wait for specified milliseconds
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry non-retryable errors
      if (error instanceof ApiRequestError && !error.isRetryable()) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === config.maxRetries - 1) {
        throw error;
      }

      // Wait before retrying
      const delay = calculateBackoff(attempt, config);
      await wait(delay);
    }
  }

  throw lastError;
}
