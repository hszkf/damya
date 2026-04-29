// Redshift Serverless connector using AWS SDK Redshift Data API

import {
  RedshiftDataClient,
  ExecuteStatementCommand,
  GetStatementResultCommand,
  DescribeStatementCommand,
  ListTablesCommand,
  StatusString,
} from '@aws-sdk/client-redshift-data';
import { fromIni } from '@aws-sdk/credential-provider-ini';

// Configuration - reads from environment variables
const config = {
  database: process.env.REDSHIFT_DATABASE || 'glue_spectrum',
  workgroupName: process.env.REDSHIFT_WORKGROUP_NAME || 'serverless-workgroup',
  region: process.env.AWS_REGION || 'ap-southeast-1',
  profile: process.env.AWS_PROFILE || 'data-prod',
};

export interface QueryResult {
  columns: string[];
  rows: any[];
  rowCount: number;
  executionTime: number;
}

let client: RedshiftDataClient | null = null;
let connected = false;
let connectionError: string | null = null;

// Export getters for shared access
export function getRedshiftClient(): RedshiftDataClient | null {
  return client;
}

export function isRedshiftConnected(): boolean {
  return connected;
}

export function getRedshiftConfig() {
  return config;
}

export async function initRedshift(): Promise<void> {
  try {
    // Use AWS SSO profile from ~/.aws/config (supports SSO, credentials file, env vars)
    client = new RedshiftDataClient({
      region: config.region,
      credentials: fromIni({ profile: config.profile }),
    });

    // Test connection with a simple query - wait for completion
    const statementId = await executeStatement('SELECT 1');
    if (statementId) {
      // Wait for the statement to actually complete
      await waitForStatement(statementId, 30000);
      connected = true;
      connectionError = null;
      console.log('✅ Redshift Serverless connected');
    }
  } catch (error: any) {
    console.warn('⚠️ Redshift connection failed:', error.message);
    connected = false;
    connectionError = error.message;
    // Don't throw - allow app to start without Redshift
  }
}

export async function closeRedshift(): Promise<void> {
  if (client) {
    client.destroy();
    client = null;
    connected = false;
    console.log('Redshift connection closed');
  }
}

// Execute a statement and wait for completion (exported for unified-sql)
export async function executeStatement(sql: string): Promise<string | null> {
  if (!client) return null;

  const command = new ExecuteStatementCommand({
    Database: config.database,
    WorkgroupName: config.workgroupName,
    Sql: sql,
  });

  const response = await client.send(command);
  return response.Id || null;
}

// Wait for statement to complete and check status (exported for unified-sql)
export async function waitForStatement(statementId: string, maxWaitMs: number = 60000): Promise<boolean> {
  if (!client) return false;

  const startTime = Date.now();
  const pollInterval = 1000; // Poll every 1 second (10s total with retries)

  while (Date.now() - startTime < maxWaitMs) {
    const describeCommand = new DescribeStatementCommand({ Id: statementId });
    const response = await client.send(describeCommand);

    const status = response.Status;

    if (status === StatusString.FINISHED) {
      return true;
    } else if (status === StatusString.FAILED) {
      throw new Error(`Query failed: ${response.Error}`);
    } else if (status === StatusString.ABORTED) {
      throw new Error('Query was aborted');
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  throw new Error('Query timeout');
}

// Get results from completed statement (exported for unified-sql)
export async function getStatementResult(statementId: string): Promise<QueryResult> {
  if (!client) {
    throw new Error('Redshift client not initialized');
  }

  const command = new GetStatementResultCommand({ Id: statementId });
  const response = await client.send(command);

  // Extract column names
  const columns = response.ColumnMetadata?.map(col => col.name || '') || [];

  // Extract rows - convert from AWS format to plain objects
  const rows = response.Records?.map(record => {
    const row: Record<string, any> = {};
    record.forEach((field, index) => {
      const columnName = columns[index] || `column_${index}`;
      // Extract value from AWS Field object
      row[columnName] = field.stringValue
        ?? field.longValue
        ?? field.doubleValue
        ?? field.booleanValue
        ?? field.blobValue
        ?? null;
    });
    return row;
  }) || [];

  return {
    columns,
    rows,
    rowCount: response.TotalNumRows || rows.length,
    executionTime: 0, // Will be calculated by caller
  };
}

export async function executeQuery(query: string): Promise<QueryResult> {
  const start = Date.now();

  if (!client || !connected) {
    throw new Error('Redshift not connected');
  }

  try {
    // Execute the statement
    const statementId = await executeStatement(query);
    if (!statementId) {
      throw new Error('Failed to execute statement');
    }

    // Wait for completion
    await waitForStatement(statementId);

    // Get results
    const result = await getStatementResult(statementId);
    result.executionTime = Date.now() - start;

    return result;
  } catch (error: any) {
    console.error('Redshift query error:', error.message);
    throw new Error(`Redshift query error: ${error.message}`);
  }
}

export async function getSchema(): Promise<any> {
  // Return empty schema if not connected instead of throwing
  if (!client) {
    return {};
  }

  try {
    // Use single ListTablesCommand call without schema filter to get ALL tables
    // This matches the Python approach and is more efficient
    const allTables: Array<{ schema?: string; name?: string; type?: string }> = [];
    let nextToken: string | undefined;

    do {
      const listTablesCommand = new ListTablesCommand({
        Database: config.database,
        WorkgroupName: config.workgroupName,
        NextToken: nextToken,
      });

      const response = await client.send(listTablesCommand);

      if (response.Tables) {
        allTables.push(...response.Tables);
      }
      nextToken = response.NextToken;
    } while (nextToken);

    // Organize tables by schema (same logic as Python's organize_schema_and_tables)
    const schemasResult: Record<string, string[]> = {};

    for (const table of allTables) {
      const schemaName = table.schema;
      const tableName = table.name;

      // Skip system schemas and system tables
      if (!schemaName || !tableName) continue;
      if (['pg_catalog', 'information_schema', 'pg_internal'].includes(schemaName)) continue;
      if (table.type === 'SYSTEM TABLE') continue;

      // Initialize schema array if not exists
      if (!schemasResult[schemaName]) {
        schemasResult[schemaName] = [];
      }

      // Add table if not already present
      if (!schemasResult[schemaName].includes(tableName)) {
        schemasResult[schemaName].push(tableName);
      }
    }

    // Sort tables within each schema
    for (const schema of Object.keys(schemasResult)) {
      schemasResult[schema].sort();
    }

    return schemasResult;
  } catch (error: any) {
    // Fallback: try SQL query method
    return await getSchemaViaSql();
  }
}

// Fallback method using SQL query
async function getSchemaViaSql(): Promise<any> {
  if (!client || !connected) {
    return {};
  }

  try {
    // Try information_schema which is more reliable than pg_table_def
    const query = `
      SELECT
        table_schema AS schema_name,
        table_name
      FROM information_schema.tables
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_internal')
        AND table_type = 'BASE TABLE'
      ORDER BY table_schema, table_name
    `;

    const result = await executeQuery(query);

    // Group by schema
    const schemas: Record<string, string[]> = {};
    for (const row of result.rows) {
      const schemaName = row.schema_name;
      const tableName = row.table_name;

      if (!schemas[schemaName]) {
        schemas[schemaName] = [];
      }
      schemas[schemaName].push(tableName);
    }

    return schemas;
  } catch (error: any) {
    return {};
  }
}

export async function getHealthStatus(): Promise<any> {
  // Actually test the connection with a simple query and WAIT for it to complete
  // AWS validates credentials during waitForStatement, not during executeStatement
  if (client) {
    try {
      const statementId = await executeStatement('SELECT 1');
      if (statementId) {
        // Wait for the query to complete - this validates credentials
        await waitForStatement(statementId, 10000); // 10 second timeout for health check
        connected = true;
        connectionError = null;
        return {
          status: 'connected',
          connected: true,
          workgroup: config.workgroupName,
          database: config.database,
          region: config.region,
        };
      }
    } catch (error: any) {
      connected = false;
      connectionError = error.message;
    }
  }

  return {
    status: 'disconnected',
    connected: false,
    error: connectionError || 'Redshift not initialized',
    workgroup: config.workgroupName,
    database: config.database,
  };
}
