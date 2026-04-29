import sql from 'mssql';

// Parse domain\username format for NTLM authentication
const userParts = (process.env.SQLSERVER_USER || '').split('\\');
const hasDomain = userParts.length === 2;
const domain = hasDomain ? userParts[0] : undefined;
const userName = hasDomain ? userParts[1] : process.env.SQLSERVER_USER || 'ssis_admin';

// SQL Server connection configuration with NTLM support
const config: sql.config = {
  server: process.env.SQLSERVER_HOST || '10.200.224.42',
  database: process.env.SQLSERVER_DATABASE || 'Staging',
  port: parseInt(process.env.SQLSERVER_PORT || '1433'),
  // Use NTLM authentication if domain is present
  authentication: hasDomain
    ? {
        type: 'ntlm' as const,
        options: {
          domain,
          userName,
          password: process.env.SQLSERVER_PASSWORD || '',
        },
      }
    : undefined,
  // Use standard auth if no domain
  user: hasDomain ? undefined : userName,
  password: hasDomain ? undefined : (process.env.SQLSERVER_PASSWORD || 'P@55word'),
  options: {
    encrypt: process.env.SQLSERVER_ENCRYPT === 'true',
    trustServerCertificate: process.env.SQLSERVER_TRUST_CERT !== 'false',
    enableArithAbort: true,
  },
  pool: {
    max: 30,              // pool_size (10) + max_overflow (20)
    min: 10,              // pool_size
    idleTimeoutMillis: 3600000,    // 1 hour
    acquireTimeoutMillis: 600000,  // 10 minutes
  },
  requestTimeout: 3600000,    // 1 hour (max practical value)
  connectionTimeout: 60000,   // 60 seconds for initial connection
};

// Export the full username for use in job creation
export const dbUser = process.env.SQLSERVER_USER || 'ssis_admin';

let pool: sql.ConnectionPool | null = null;

export async function initSqlServer(): Promise<void> {
  try {
    pool = await sql.connect(config);
    console.log('✅ SQL Server connected');

    // Auto-migrate: add missing columns if needed
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'job_executions' AND COLUMN_NAME = 'step_results'
      )
      BEGIN
        ALTER TABLE job_executions ADD step_results NVARCHAR(MAX);
      END
    `);
  } catch (error) {
    console.error('❌ SQL Server connection failed:', error);
    throw error;
  }
}

export async function closeSqlServer(): Promise<void> {
  if (pool) {
    await pool.close();
    pool = null;
    console.log('SQL Server connection closed');
  }
}

export async function getPool(): Promise<sql.ConnectionPool> {
  if (!pool || !pool.connected) {
    console.log('🔄 Reconnecting to SQL Server...');
    await initSqlServer();
  }
  return pool!;
}

export interface QueryResult {
  columns: string[];
  rows: any[];
  rowCount: number;
  executionTime: number;
}

export async function executeQuery(query: string): Promise<QueryResult> {
  const start = Date.now();
  const poolInstance = await getPool();

  try {
    const result = await poolInstance.request().query(query);
    const executionTime = Date.now() - start;

    // Get column names
    const columns = result.recordset?.columns
      ? Object.keys(result.recordset.columns)
      : result.recordset?.length > 0
        ? Object.keys(result.recordset[0])
        : [];

    return {
      columns,
      rows: result.recordset || [],
      rowCount: result.recordset?.length || result.rowsAffected?.[0] || 0,
      executionTime,
    };
  } catch (error: any) {
    throw new Error(`SQL Server query error: ${error.message}`);
  }
}

export async function getSchema(): Promise<any> {
  const query = `
    SELECT
      s.name AS schema_name,
      t.name AS table_name,
      c.name AS column_name,
      ty.name AS data_type,
      c.max_length,
      c.is_nullable,
      c.is_identity,
      CASE WHEN pk.column_id IS NOT NULL THEN 1 ELSE 0 END AS is_primary_key
    FROM sys.schemas s
    INNER JOIN sys.tables t ON s.schema_id = t.schema_id
    INNER JOIN sys.columns c ON t.object_id = c.object_id
    INNER JOIN sys.types ty ON c.user_type_id = ty.user_type_id
    LEFT JOIN (
      SELECT ic.column_id, ic.object_id
      FROM sys.index_columns ic
      INNER JOIN sys.indexes i ON ic.index_id = i.index_id AND ic.object_id = i.object_id
      WHERE i.is_primary_key = 1
    ) pk ON c.column_id = pk.column_id AND c.object_id = pk.object_id
    ORDER BY s.name, t.name, c.column_id
  `;

  const result = await executeQuery(query);

  // Group by schema and table
  const schemas: Record<string, Record<string, any[]>> = {};
  for (const row of result.rows) {
    const schemaName = row.schema_name;
    const tableName = row.table_name;

    if (!schemas[schemaName]) {
      schemas[schemaName] = {};
    }
    if (!schemas[schemaName][tableName]) {
      schemas[schemaName][tableName] = [];
    }

    schemas[schemaName][tableName].push({
      column_name: row.column_name,
      data_type: row.data_type,
      max_length: row.max_length,
      is_nullable: row.is_nullable,
      is_identity: row.is_identity,
      is_primary_key: row.is_primary_key,
    });
  }

  return schemas;
}

export async function getHealthStatus(): Promise<any> {
  try {
    const poolInstance = await getPool();
    await poolInstance.request().query('SELECT 1 as healthy');

    console.log(`[SQL Server Health] connected=true`);
    return {
      status: 'connected',
      connected: true,
      pool: {
        size: poolInstance.pool?.size || 0,
        available: poolInstance.pool?.available || 0,
        pending: poolInstance.pool?.pending || 0,
      },
    };
  } catch (error: any) {
    console.log(`[SQL Server Health] connected=false, error=${error.message}`);
    return {
      status: 'disconnected',
      connected: false,
      error: error.message,
    };
  }
}
