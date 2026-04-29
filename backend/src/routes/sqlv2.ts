/**
 * Unified SQL Routes (v2)
 * Single endpoint for cross-source queries with schema prefix convention
 */

import { Hono } from 'hono';
import { z } from 'zod';
import {
  executeUnifiedQuery,
  getUnifiedSchema,
  getUnifiedHealthStatus,
} from '../services/database/unified-sql';
import { logger } from '../utils/logger';

export const sqlv2Routes = new Hono();

// Execute query schema
const ExecuteQuerySchema = z.object({
  query: z.string().min(1).optional(),
  sql: z.string().min(1).optional(),
}).refine(data => data.query || data.sql, {
  message: "Either 'query' or 'sql' must be provided",
});

/**
 * Execute unified SQL query
 * POST /sqlv2/execute
 *
 * Query prefix convention:
 * - rs.schema.table for Redshift tables
 * - ss.schema.table for SQL Server tables
 *
 * Examples:
 * - SELECT * FROM rs.public.customers LIMIT 10
 * - SELECT * FROM ss.dbo.orders
 */
sqlv2Routes.post('/execute', async (c) => {
  const startTime = Date.now();

  try {
    const body = await c.req.json();
    const validated = ExecuteQuerySchema.parse(body);
    const query = validated.query || validated.sql!;

    const result = await executeUnifiedQuery(query);

    return c.json({
      status: 'success',
      columns: result.columns,
      rows: result.rows,
      row_count: result.rowCount,
      execution_time: result.executionTime,
      source: result.source,
      message: `Query executed successfully (${result.rowCount} rows from ${result.source})`,
    });
  } catch (error: any) {
    logger.error('Unified query execution error', error);
    return c.json(
      {
        status: 'error',
        columns: [],
        rows: [],
        row_count: 0,
        execution_time: 0,
        error: error.message || 'Query execution failed',
      },
      400
    );
  }
});

/**
 * Get unified schema from both sources
 * GET /sqlv2/schema
 */
sqlv2Routes.get('/schema', async (c) => {
  try {
    const schema = await getUnifiedSchema();

    // Count totals
    const redshiftSchemaCount = Object.keys(schema.redshift).length;
    const redshiftTableCount = Object.values(schema.redshift).flat().length;
    const sqlserverSchemaCount = Object.keys(schema.sqlserver).length;
    const sqlserverTableCount = Object.values(schema.sqlserver).flat().length;

    logger.info('Unified schema fetched', {
      metadata: {
        redshift: { schemas: redshiftSchemaCount, tables: redshiftTableCount },
        sqlserver: { schemas: sqlserverSchemaCount, tables: sqlserverTableCount },
      },
    });

    return c.json({
      status: 'success',
      schemas: schema,
      summary: {
        redshift: { schemas: redshiftSchemaCount, tables: redshiftTableCount },
        sqlserver: { schemas: sqlserverSchemaCount, tables: sqlserverTableCount },
      },
    });
  } catch (error: any) {
    logger.error('Unified schema fetch error', error);
    return c.json({
      status: 'error',
      schemas: { redshift: {}, sqlserver: {} },
      error: error.message || 'Failed to fetch schema',
    });
  }
});

/**
 * Health check for both sources
 * GET /sqlv2/health
 */
sqlv2Routes.get('/health', async (c) => {
  try {
    const health = await getUnifiedHealthStatus();

    const allConnected = health.redshift.connected && health.sqlserver.connected;
    const anyConnected = health.redshift.connected || health.sqlserver.connected;

    return c.json({
      status: allConnected ? 'connected' : anyConnected ? 'partial' : 'disconnected',
      redshift: health.redshift,
      sqlserver: health.sqlserver,
    });
  } catch (error: any) {
    return c.json({
      status: 'disconnected',
      redshift: { connected: false, error: 'Unknown error' },
      sqlserver: { connected: false, error: 'Unknown error' },
      error: error.message,
    });
  }
});

/**
 * Get query prefix help
 * GET /sqlv2/help
 */
sqlv2Routes.get('/help', (c) => {
  return c.json({
    status: 'success',
    prefixes: {
      redshift: {
        prefix: 'rs.',
        format: 'rs.schema.table',
        example: 'SELECT * FROM rs.public.customers LIMIT 10',
      },
      sqlserver: {
        prefix: 'ss.',
        format: 'ss.schema.table',
        example: 'SELECT TOP 10 * FROM ss.dbo.orders',
      },
    },
    notes: [
      'Use rs. prefix for Redshift tables',
      'Use ss. prefix for SQL Server tables',
      'Queries without prefix default to SQL Server',
      'Cross-source JOINs are executed client-side',
    ],
  });
});
