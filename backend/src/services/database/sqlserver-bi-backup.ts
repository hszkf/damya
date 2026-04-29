import sql from 'mssql';

// SQL Server BI_Backup connection configuration
// Use explicit ConnectionPool instead of global sql.connect() to avoid sharing with Staging
const config: sql.config = {
  user: process.env.SQLSERVER_BI_USER || process.env.SQLSERVER_USER || 'ssis_admin',
  password: process.env.SQLSERVER_BI_PASSWORD || process.env.SQLSERVER_PASSWORD || 'P@55word',
  server: process.env.SQLSERVER_BI_HOST || process.env.SQLSERVER_HOST || '10.200.224.42',
  database: process.env.SQLSERVER_BI_DATABASE || 'BI_Backup',
  port: parseInt(process.env.SQLSERVER_BI_PORT || process.env.SQLSERVER_PORT || '1433'),
  options: {
    encrypt: process.env.SQLSERVER_ENCRYPT === 'true',
    trustServerCertificate: process.env.SQLSERVER_TRUST_CERT !== 'false',
    enableArithAbort: true,
  },
  pool: {
    max: 30,
    min: 10,
    idleTimeoutMillis: 3600000,
    acquireTimeoutMillis: 600000,
  },
  requestTimeout: 3600000,
  connectionTimeout: 60000,
};

// Use explicit ConnectionPool to have separate pool from Staging
let pool: sql.ConnectionPool | null = null;

export async function initSqlServerBiBackup(): Promise<void> {
  try {
    // Create explicit pool instead of using global sql.connect()
    pool = new sql.ConnectionPool(config);
    await pool.connect();
    console.log(`✅ SQL Server BI_Backup connected (database: ${config.database})`);
  } catch (error) {
    console.error('❌ SQL Server BI_Backup connection failed:', error);
    throw error;
  }
}

export async function closeSqlServerBiBackup(): Promise<void> {
  if (pool) {
    await pool.close();
    pool = null;
    console.log('SQL Server BI_Backup connection closed');
  }
}

export async function getPool(): Promise<sql.ConnectionPool> {
  if (!pool || !pool.connected) {
    console.log(`🔄 Reconnecting to SQL Server BI_Backup (database: ${config.database})...`);
    await initSqlServerBiBackup();
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
    throw new Error(`SQL Server BI_Backup query error: ${error.message}`);
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

    console.log(`[SQL Server BI_Backup Health] connected=true`);
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
    console.log(`[SQL Server BI_Backup Health] connected=false, error=${error.message}`);
    return {
      status: 'disconnected',
      connected: false,
      error: error.message,
    };
  }
}
