import { Hono } from 'hono';
import { z } from 'zod';
import * as sqlserver from '../services/database/sqlserver';
import * as sqlserverBiBackup from '../services/database/sqlserver-bi-backup';
import * as sqlserverDatamart from '../services/database/sqlserver-datamart';
import * as redshift from '../services/database/redshift';
import { schemaCache } from '../services/schema-cache';
import { logger } from '../utils/logger';

export const sqlRoutes = new Hono();

// Execute query schema - accept both 'query' and 'sql' for frontend compatibility
const ExecuteQuerySchema = z.object({
  query: z.string().min(1).optional(),
  sql: z.string().min(1).optional(),
  params: z.record(z.string(), z.unknown()).optional(),
  parameters: z.array(z.unknown()).optional(),
}).refine(data => data.query || data.sql, {
  message: "Either 'query' or 'sql' must be provided",
});

// Determine which database to use based on path
function getDatabase(path: string) {
  if (path.includes('/redshift')) {
    return redshift;
  }
  if (path.includes('/sqlserver-datamart')) {
    return sqlserverDatamart;
  }
  if (path.includes('/sqlserver-bi-backup')) {
    return sqlserverBiBackup;
  }
  return sqlserver;
}

// Get database type name from path
function getDatabaseType(path: string): string {
  if (path.includes('/redshift')) return 'redshift';
  if (path.includes('/sqlserver-datamart')) return 'sqlserver-datamart';
  if (path.includes('/sqlserver-bi-backup')) return 'sqlserver-bi-backup';
  return 'sqlserver';
}

// Execute SQL query
sqlRoutes.post('/execute', async (c) => {
  const startTime = Date.now();
  const database = getDatabaseType(c.req.path);

  try {
    const body = await c.req.json();
    const validated = ExecuteQuerySchema.parse(body);

    // Support both 'query' and 'sql' field names
    const query = validated.query || validated.sql!;

    console.log('=== SQL EXECUTE ===');
    console.log('Database:', database);
    console.log('SQL:', JSON.stringify(query));
    console.log('===================');

    const db = getDatabase(c.req.path);
    const result = await db.executeQuery(query);

    // Return flat structure expected by frontend
    return c.json({
      status: 'success',
      columns: result.columns,
      rows: result.rows,
      row_count: result.rowCount,
      execution_time: result.executionTime,
      message: `Query executed successfully (${result.rowCount} rows)`,
    });
  } catch (error: any) {
    console.error('Query execution error:', error);
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

// Get database schema (with caching)
sqlRoutes.get('/schema', async (c) => {
  const dbType = getDatabaseType(c.req.path);
  const forceRefresh = c.req.query('refresh') === 'true';

  try {
    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cachedSchema = schemaCache.get(dbType);
      if (cachedSchema) {
        const cacheInfo = schemaCache.getInfo(dbType);
        const schemaCount = Object.keys(cachedSchema).length;
        const tableCount = Object.values(cachedSchema).flat().length;
        logger.info(`Schema loaded from cache`, {
          metadata: { database: dbType, schemas: schemaCount, tables: tableCount, age: cacheInfo.age }
        });
        return c.json({
          status: 'success',
          schemas: cachedSchema,
          cached: true,
          cacheInfo: {
            cachedAt: cacheInfo.cachedAt,
            age: cacheInfo.age,
          },
        });
      }
    }

    // Fetch fresh data from database
    logger.info(`Fetching schema from database`, { metadata: { database: dbType, forceRefresh } });
    const db = getDatabase(c.req.path);
    const rawSchema = await db.getSchema();

    // Normalize schema to format frontend expects: { schema_name: ["table1", "table2", ...] }
    const schemas: Record<string, string[]> = {};
    for (const [schemaName, tables] of Object.entries(rawSchema)) {
      if (Array.isArray(tables)) {
        schemas[schemaName] = tables;
      } else if (typeof tables === 'object' && tables !== null) {
        schemas[schemaName] = Object.keys(tables);
      }
    }

    // Cache the result
    schemaCache.set(dbType, schemas);

    const schemaCount = Object.keys(schemas).length;
    const tableCount = Object.values(schemas).flat().length;
    logger.info(`Schema fetched from database`, {
      metadata: { database: dbType, schemas: schemaCount, tables: tableCount }
    });

    return c.json({
      status: 'success',
      schemas,
      cached: false,
    });
  } catch (error: any) {
    logger.error(`Schema fetch error`, error, { metadata: { database: dbType } });
    return c.json({
      status: 'error',
      schemas: {},
      detail: error.message || 'Failed to fetch schema',
    });
  }
});

// Get cache info
sqlRoutes.get('/schema/cache', async (c) => {
  const dbType = getDatabaseType(c.req.path);
  const cacheInfo = schemaCache.getInfo(dbType);

  return c.json({
    status: 'success',
    database: dbType,
    cache: cacheInfo,
  });
});

// Clear schema cache
sqlRoutes.delete('/schema/cache', async (c) => {
  const dbType = getDatabaseType(c.req.path);
  const cleared = schemaCache.clear(dbType);

  return c.json({
    status: 'success',
    database: dbType,
    cleared,
    message: cleared ? 'Cache cleared successfully' : 'No cache to clear',
  });
});

// Health check
sqlRoutes.get('/health', async (c) => {
  const dbType = getDatabaseType(c.req.path);
  try {
    const db = getDatabase(c.req.path);
    const healthStatus = await db.getHealthStatus();

    // Return format expected by frontend: { status: 'connected' | 'disconnected', ... }
    // Spread healthStatus first, then override status with frontend-expected value
    return c.json({
      ...healthStatus,
      status: healthStatus.connected ? 'connected' : 'disconnected',
      database: dbType,
    });
  } catch (error: any) {
    return c.json({
      status: 'disconnected',
      database: dbType,
      error: error.message,
    });
  }
});

// Get tables list (simplified)
sqlRoutes.get('/tables', async (c) => {
  try {
    const db = getDatabase(c.req.path);

    if (db === sqlserver) {
      const result = await sqlserver.executeQuery(`
        SELECT
          s.name AS schema_name,
          t.name AS table_name,
          p.rows AS row_count
        FROM sys.tables t
        INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
        INNER JOIN sys.partitions p ON t.object_id = p.object_id AND p.index_id IN (0, 1)
        ORDER BY s.name, t.name
      `);

      return c.json({
        success: true,
        data: result.rows,
      });
    }

    // Redshift placeholder
    return c.json({
      success: true,
      data: [],
    });
  } catch (error: any) {
    return c.json(
      {
        success: false,
        error: error.message,
      },
      500
    );
  }
});

// Get column metadata for a specific table
sqlRoutes.get('/columns', async (c) => {
  const schemaName = c.req.query('schema');
  const tableName = c.req.query('table');

  if (!schemaName || !tableName) {
    return c.json({
      status: 'error',
      columns: [],
      error: 'Both schema and table query parameters are required',
    }, 400);
  }

  try {
    const columns = await redshift.getTableColumns(schemaName, tableName);
    return c.json({ status: 'success', columns });
  } catch (error: any) {
    return c.json({
      status: 'error',
      columns: [],
      error: error.message || 'Failed to fetch column metadata',
    }, 500);
  }
});
