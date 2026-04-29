/**
 * Query Logger Service
 * Logs SQL query executions to S3 for audit and analytics
 */

import { storageService } from './storage-service';
import { logger } from '../utils/logger';

const LOGS_PREFIX = 'query-logs/';
const BATCH_SIZE = 100;
const FLUSH_INTERVAL_MS = 30000; // 30 seconds

export interface QueryLogEntry {
  id: string;
  timestamp: string;
  userId: number;
  username: string;
  role: string;
  database: 'sqlserver' | 'redshift';
  query: string;
  executionTimeMs: number;
  rowCount: number;
  status: 'success' | 'error' | 'blocked';
  errorMessage?: string;
  blockedReason?: string;
  clientIp?: string;
}

interface QueryLogInput {
  userId: number;
  username: string;
  role: string;
  database: 'sqlserver' | 'redshift';
  query: string;
  executionTimeMs: number;
  rowCount: number;
  status: 'success' | 'error' | 'blocked';
  errorMessage?: string;
  blockedReason?: string;
  clientIp?: string;
}

/**
 * Query Logger Service
 * Batches logs and writes them to S3 periodically
 */
class QueryLoggerService {
  private buffer: QueryLogEntry[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private isShuttingDown = false;

  constructor() {
    // Start periodic flush
    this.startPeriodicFlush();
  }

  /**
   * Log a query execution
   */
  async log(input: QueryLogInput): Promise<void> {
    const entry: QueryLogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...input,
    };

    this.buffer.push(entry);

    // Flush if buffer is full
    if (this.buffer.length >= BATCH_SIZE) {
      await this.flush();
    }
  }

  /**
   * Flush buffered logs to S3
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const logs = [...this.buffer];
    this.buffer = [];

    try {
      // Create log file key with date-based partitioning
      const now = new Date();
      const dateKey = now.toISOString().slice(0, 10); // YYYY-MM-DD
      const timeKey = now.toISOString().slice(11, 19).replace(/:/g, '-'); // HH-MM-SS
      const fileKey = `${LOGS_PREFIX}${dateKey}/${timeKey}-${crypto.randomUUID().slice(0, 8)}.json`;

      // Write logs to S3
      const content = JSON.stringify(logs, null, 2);
      const buffer = Buffer.from(content, 'utf-8');

      await storageService.uploadFile(buffer, fileKey, 'application/json');

      logger.debug('Query logs flushed to S3', {
        metadata: { count: logs.length, fileKey },
      });
    } catch (error) {
      // Put logs back in buffer if flush failed
      this.buffer.unshift(...logs);
      logger.error('Failed to flush query logs to S3', error as Error);
    }
  }

  /**
   * Start periodic flush timer
   */
  private startPeriodicFlush(): void {
    if (this.flushTimer) return;

    this.flushTimer = setInterval(async () => {
      if (!this.isShuttingDown) {
        await this.flush();
      }
    }, FLUSH_INTERVAL_MS);
  }

  /**
   * Stop periodic flush and flush remaining logs
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Flush any remaining logs
    await this.flush();
  }

  /**
   * Get recent logs from memory buffer (for debugging)
   */
  getBufferedLogs(): QueryLogEntry[] {
    return [...this.buffer];
  }

  /**
   * Get buffer size (for monitoring)
   */
  getBufferSize(): number {
    return this.buffer.length;
  }
}

export const queryLogger = new QueryLoggerService();

// Graceful shutdown handling
process.on('SIGINT', async () => {
  await queryLogger.shutdown();
});

process.on('SIGTERM', async () => {
  await queryLogger.shutdown();
});
