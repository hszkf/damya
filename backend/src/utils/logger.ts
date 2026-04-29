/**
 * Structured Logger for the application
 * Outputs JSON logs for production use
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  requestId?: string;
  userId?: number;
  username?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  duration?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  metadata?: Record<string, unknown>;
}

class Logger {
  private minLevel: LogLevel;
  private levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor() {
    this.minLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levelPriority[level] >= this.levelPriority[this.minLevel];
  }

  private formatEntry(level: LogLevel, message: string, meta?: Partial<LogEntry>): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...meta,
    };
  }

  private output(entry: LogEntry): void {
    const json = JSON.stringify(entry);
    
    if (entry.level === 'error') {
      console.error(json);
    } else if (entry.level === 'warn') {
      console.warn(json);
    } else {
      console.log(json);
    }
  }

  debug(message: string, meta?: Partial<LogEntry>): void {
    if (this.shouldLog('debug')) {
      this.output(this.formatEntry('debug', message, meta));
    }
  }

  info(message: string, meta?: Partial<LogEntry>): void {
    if (this.shouldLog('info')) {
      this.output(this.formatEntry('info', message, meta));
    }
  }

  warn(message: string, meta?: Partial<LogEntry>): void {
    if (this.shouldLog('warn')) {
      this.output(this.formatEntry('warn', message, meta));
    }
  }

  error(message: string, error?: Error | unknown, meta?: Partial<LogEntry>): void {
    if (this.shouldLog('error')) {
      const errorDetails = error instanceof Error ? {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
          code: (error as any).code,
        },
      } : {};

      this.output(this.formatEntry('error', message, { ...meta, ...errorDetails }));
    }
  }

  /**
   * Log HTTP request
   */
  request(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    meta?: Partial<LogEntry>
  ): void {
    const level: LogLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    
    this.output(this.formatEntry(level, `${method} ${path} ${statusCode}`, {
      method,
      path,
      statusCode,
      duration,
      ...meta,
    }));
  }

  /**
   * Log SQL query execution
   */
  query(
    query: string,
    database: string,
    duration: number,
    rowCount: number,
    userId?: number,
    username?: string,
    success: boolean = true
  ): void {
    const truncatedQuery = query.length > 500 ? query.substring(0, 500) + '...' : query;
    
    this.output(this.formatEntry(success ? 'info' : 'error', 'SQL Query Executed', {
      userId,
      username,
      duration,
      metadata: {
        database,
        query: truncatedQuery,
        rowCount,
        success,
      },
    }));
  }

  /**
   * Log authentication event
   */
  auth(event: 'login' | 'logout' | 'login_failed', username: string, meta?: Partial<LogEntry>): void {
    const level: LogLevel = event === 'login_failed' ? 'warn' : 'info';
    
    this.output(this.formatEntry(level, `Auth: ${event}`, {
      username,
      ...meta,
    }));
  }

  /**
   * Log security event
   */
  security(message: string, meta?: Partial<LogEntry>): void {
    this.output(this.formatEntry('warn', `Security: ${message}`, meta));
  }

  /**
   * Create a child logger with preset metadata
   */
  child(defaultMeta: Partial<LogEntry>): ChildLogger {
    return new ChildLogger(this, defaultMeta);
  }
}

class ChildLogger {
  constructor(
    private parent: Logger,
    private defaultMeta: Partial<LogEntry>
  ) {}

  debug(message: string, meta?: Partial<LogEntry>): void {
    this.parent.debug(message, { ...this.defaultMeta, ...meta });
  }

  info(message: string, meta?: Partial<LogEntry>): void {
    this.parent.info(message, { ...this.defaultMeta, ...meta });
  }

  warn(message: string, meta?: Partial<LogEntry>): void {
    this.parent.warn(message, { ...this.defaultMeta, ...meta });
  }

  error(message: string, error?: Error | unknown, meta?: Partial<LogEntry>): void {
    this.parent.error(message, error, { ...this.defaultMeta, ...meta });
  }
}

// Singleton instance
export const logger = new Logger();

// Generate unique request ID
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
