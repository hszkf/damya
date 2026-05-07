import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { getLogs, clearLogs, subscribe, getLogStats } from '../utils/log-buffer';
import { getHealthStatus as getRedshiftHealth } from '../services/database/redshift';
import { storageService } from '../services/storage-service';
import type { LogLevel } from '../utils/logger';

export const appLogsRoutes = new Hono();

// GET /app-logs — return buffered logs
appLogsRoutes.get('/', (c) => {
  const level = c.req.query('level') as LogLevel | undefined;
  const limit = Math.min(parseInt(c.req.query('limit') || '200'), 1000);
  const logs = getLogs(level, limit);
  const stats = getLogStats();
  return c.json({ success: true, data: logs, count: logs.length, stats });
});

// GET /app-logs/stream — SSE real-time stream
appLogsRoutes.get('/stream', (c) => {
  return streamSSE(c, async (stream) => {
    const unsubscribe = subscribe((entry) => {
      stream.writeSSE({ data: JSON.stringify(entry) });
    });

    const heartbeat = setInterval(() => {
      stream.writeSSE({ data: '__heartbeat__' });
    }, 15000);

    stream.onAbort(() => {
      unsubscribe();
      clearInterval(heartbeat);
    });

    await new Promise(() => {});
  });
});

// DELETE /app-logs — clear buffer
appLogsRoutes.delete('/', (c) => {
  clearLogs();
  return c.json({ success: true, message: 'Logs cleared' });
});

// GET /app-logs/health — aggregated health summary
appLogsRoutes.get('/health', async (c) => {
  const [redshift, storage] = await Promise.allSettled([
    getRedshiftHealth(),
    storageService.healthCheck(),
  ]);

  return c.json({
    redshift: redshift.status === 'fulfilled'
      ? redshift.value
      : { status: 'error', connected: false, error: redshift.reason?.message },
    storage: storage.status === 'fulfilled'
      ? storage.value
      : { status: 'error', connected: false, error: storage.reason?.message },
    stats: getLogStats(),
    uptime: process.uptime(),
  });
});
