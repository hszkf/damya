/**
 * Query Logs Routes
 * View and search query execution logs
 */

import { Hono } from 'hono';
import { storageService } from '../services/storage-service';
import { ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';

export const logsRoutes = new Hono();

// Logs are stored in S3 under this prefix
const LOGS_PREFIX = 'query-logs/';

interface QueryLog {
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

/**
 * GET /logs
 * List query logs with pagination and filters
 */
logsRoutes.get('/', async (c) => {
  const page = parseInt(c.req.query('page') || '1');
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
  const username = c.req.query('username');
  const database = c.req.query('database') as 'sqlserver' | 'redshift' | undefined;
  const status = c.req.query('status') as 'success' | 'error' | 'blocked' | undefined;
  const dateFrom = c.req.query('date_from');
  const dateTo = c.req.query('date_to');

  try {
    // List log files from S3
    const files = await storageService.listFiles(LOGS_PREFIX);

    // Filter by date range if specified
    let logFiles = files.filter(f => f.key.endsWith('.json'));

    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      logFiles = logFiles.filter(f => new Date(f.lastModified) >= fromDate);
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      logFiles = logFiles.filter(f => new Date(f.lastModified) <= toDate);
    }

    // Sort by date descending (newest first)
    logFiles.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());

    // Load and parse log entries
    const allLogs: QueryLog[] = [];

    for (const file of logFiles.slice(0, 100)) { // Limit to 100 most recent files
      try {
        const content = await storageService.downloadFile(file.key);
        if (content && content.data) {
          const text = content.data.toString('utf-8');
          const logs = JSON.parse(text);
          if (Array.isArray(logs)) {
            allLogs.push(...logs);
          } else {
            allLogs.push(logs);
          }
        }
      } catch (e) {
        // Skip corrupted log files
        logger.warn('Failed to parse log file', { metadata: { file: file.key } });
      }
    }

    // Apply filters
    let filteredLogs = allLogs;

    if (username) {
      filteredLogs = filteredLogs.filter(l =>
        l.username.toLowerCase().includes(username.toLowerCase())
      );
    }

    if (database) {
      filteredLogs = filteredLogs.filter(l => l.database === database);
    }

    if (status) {
      filteredLogs = filteredLogs.filter(l => l.status === status);
    }

    // Sort by timestamp descending
    filteredLogs.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Paginate
    const totalCount = filteredLogs.length;
    const totalPages = Math.ceil(totalCount / limit);
    const offset = (page - 1) * limit;
    const paginatedLogs = filteredLogs.slice(offset, offset + limit);

    return c.json({
      success: true,
      data: paginatedLogs,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (error) {
    logger.error('Failed to fetch query logs', error as Error);
    return c.json({
      success: true,
      data: [],
      pagination: {
        page: 1,
        limit,
        totalCount: 0,
        totalPages: 0,
        hasMore: false,
      },
      message: 'No query logs found',
    });
  }
});

/**
 * GET /logs/stats
 * Get query log statistics
 */
logsRoutes.get('/stats', async (c) => {
  const dateFrom = c.req.query('date_from');
  const dateTo = c.req.query('date_to');

  try {
    // List log files from S3
    const files = await storageService.listFiles(LOGS_PREFIX);
    let logFiles = files.filter(f => f.key.endsWith('.json'));

    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      logFiles = logFiles.filter(f => new Date(f.lastModified) >= fromDate);
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      logFiles = logFiles.filter(f => new Date(f.lastModified) <= toDate);
    }

    // Load and aggregate stats
    const stats = {
      totalQueries: 0,
      successCount: 0,
      errorCount: 0,
      blockedCount: 0,
      avgExecutionTimeMs: 0,
      totalRowsReturned: 0,
      byDatabase: { sqlserver: 0, redshift: 0 },
      byUser: {} as Record<string, number>,
      byHour: {} as Record<string, number>,
    };

    let totalExecutionTime = 0;

    for (const file of logFiles.slice(0, 100)) {
      try {
        const content = await storageService.downloadFile(file.key);
        if (content && content.data) {
          const text = content.data.toString('utf-8');
          const logs = JSON.parse(text);
          const logsArray = Array.isArray(logs) ? logs : [logs];

          for (const log of logsArray as QueryLog[]) {
            stats.totalQueries++;

            if (log.status === 'success') stats.successCount++;
            else if (log.status === 'error') stats.errorCount++;
            else if (log.status === 'blocked') stats.blockedCount++;

            totalExecutionTime += log.executionTimeMs || 0;
            stats.totalRowsReturned += log.rowCount || 0;

            if (log.database) {
              stats.byDatabase[log.database] = (stats.byDatabase[log.database] || 0) + 1;
            }

            if (log.username) {
              stats.byUser[log.username] = (stats.byUser[log.username] || 0) + 1;
            }

            if (log.timestamp) {
              const hour = new Date(log.timestamp).toISOString().slice(0, 13);
              stats.byHour[hour] = (stats.byHour[hour] || 0) + 1;
            }
          }
        }
      } catch (e) {
        // Skip corrupted log files
      }
    }

    stats.avgExecutionTimeMs = stats.totalQueries > 0
      ? Math.round(totalExecutionTime / stats.totalQueries)
      : 0;

    return c.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Failed to fetch query log stats', error as Error);
    return c.json({
      success: true,
      data: {
        totalQueries: 0,
        successCount: 0,
        errorCount: 0,
        blockedCount: 0,
        avgExecutionTimeMs: 0,
        totalRowsReturned: 0,
        byDatabase: { sqlserver: 0, redshift: 0 },
        byUser: {},
        byHour: {},
      },
    });
  }
});

/**
 * GET /logs/export
 * Export query logs as CSV
 */
logsRoutes.get('/export', async (c) => {
  const format = c.req.query('format') || 'csv';
  const dateFrom = c.req.query('date_from');
  const dateTo = c.req.query('date_to');

  if (format !== 'csv' && format !== 'json') {
    throw new ValidationError('Format must be csv or json');
  }

  try {
    // List log files from S3
    const files = await storageService.listFiles(LOGS_PREFIX);
    let logFiles = files.filter(f => f.key.endsWith('.json'));

    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      logFiles = logFiles.filter(f => new Date(f.lastModified) >= fromDate);
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      logFiles = logFiles.filter(f => new Date(f.lastModified) <= toDate);
    }

    // Load all logs
    const allLogs: QueryLog[] = [];

    for (const file of logFiles) {
      try {
        const content = await storageService.downloadFile(file.key);
        if (content && content.data) {
          const text = content.data.toString('utf-8');
          const logs = JSON.parse(text);
          if (Array.isArray(logs)) {
            allLogs.push(...logs);
          } else {
            allLogs.push(logs);
          }
        }
      } catch (e) {
        // Skip corrupted log files
      }
    }

    // Sort by timestamp descending
    allLogs.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    logger.info('Query logs exported', {
      metadata: { format, count: allLogs.length },
    });

    if (format === 'json') {
      return c.json(allLogs);
    }

    // CSV export
    const headers = [
      'timestamp',
      'username',
      'role',
      'database',
      'query',
      'execution_time_ms',
      'row_count',
      'status',
      'error_message',
      'blocked_reason',
    ];

    const csvRows = [headers.join(',')];

    for (const log of allLogs) {
      const row = [
        log.timestamp,
        log.username,
        log.role,
        log.database,
        `"${(log.query || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
        log.executionTimeMs?.toString() || '',
        log.rowCount?.toString() || '',
        log.status,
        `"${(log.errorMessage || '').replace(/"/g, '""')}"`,
        `"${(log.blockedReason || '').replace(/"/g, '""')}"`,
      ];
      csvRows.push(row.join(','));
    }

    const csv = csvRows.join('\n');

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="query-logs-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error) {
    logger.error('Failed to export query logs', error as Error);
    throw new ValidationError('Failed to export query logs');
  }
});

/**
 * DELETE /logs
 * Delete old query logs (retention cleanup)
 */
logsRoutes.delete('/', async (c) => {
  const daysOld = parseInt(c.req.query('days_old') || '30');

  if (daysOld < 1) {
    throw new ValidationError('days_old must be at least 1');
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  try {
    // List log files from S3
    const files = await storageService.listFiles(LOGS_PREFIX);
    const logFiles = files.filter(f => f.key.endsWith('.json'));

    // Find old files
    const oldFiles = logFiles.filter(f => new Date(f.lastModified) < cutoffDate);

    // Delete old files
    let deletedCount = 0;
    for (const file of oldFiles) {
      try {
        await storageService.deleteFile(file.key);
        deletedCount++;
      } catch (e) {
        logger.warn('Failed to delete log file', { metadata: { file: file.key } });
      }
    }

    logger.info('Old query logs deleted', {
      metadata: { daysOld, deletedCount },
    });

    return c.json({
      success: true,
      message: `Deleted ${deletedCount} log files older than ${daysOld} days`,
      deletedCount,
    });
  } catch (error) {
    logger.error('Failed to delete old query logs', error as Error);
    throw new ValidationError('Failed to delete old query logs');
  }
});
