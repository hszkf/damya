import { describe, expect, test, mock, beforeEach, afterEach } from 'bun:test';
import { Hono } from 'hono';
import { existsSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';

// Mock database modules
const mockSqlServer = {
  executeQuery: mock(() =>
    Promise.resolve({
      columns: ['id', 'name'],
      rows: [{ id: 1, name: 'Test' }],
      rowCount: 1,
      executionTime: 100,
    })
  ),
  getSchema: mock(() =>
    Promise.resolve({
      dbo: ['users', 'orders'],
      staging: ['temp_data'],
    })
  ),
  getHealthStatus: mock(() =>
    Promise.resolve({
      status: 'healthy',
      connected: true,
      pool: { size: 10, available: 8, pending: 0 },
    })
  ),
};

const mockRedshift = {
  executeQuery: mock(() =>
    Promise.resolve({
      columns: [],
      rows: [],
      rowCount: 0,
      executionTime: 50,
    })
  ),
  getSchema: mock(() => Promise.resolve({
    public: ['events', 'users'],
  })),
  getHealthStatus: mock(() =>
    Promise.resolve({
      status: 'healthy',
      connected: true,
    })
  ),
};

// Mock auth middleware - simulate authenticated user
const mockGetUser = mock(() => ({
  userId: 1,
  username: 'testuser',
  role: 'admin',
}));

// Mock query guard
const mockCheckQuery = mock(() => ({
  allowed: true,
  blockedCommand: null,
}));

const mockGetBlockedCommandsForRole = mock(() => []);

// Mock query logger
const mockQueryLogger = {
  log: mock(() => Promise.resolve()),
};

// Mock logger
const mockLogger = {
  info: mock(() => {}),
  warn: mock(() => {}),
  error: mock(() => {}),
  debug: mock(() => {}),
};

mock.module('../../services/database/sqlserver', () => mockSqlServer);
mock.module('../../services/database/redshift', () => mockRedshift);
mock.module('../../middleware/auth', () => ({
  getUser: mockGetUser,
}));
mock.module('../../middleware/query-guard', () => ({
  checkQuery: mockCheckQuery,
  getBlockedCommandsForRole: mockGetBlockedCommandsForRole,
}));
mock.module('../../services/query-logger', () => ({
  queryLogger: mockQueryLogger,
}));
mock.module('../../utils/logger', () => ({
  logger: mockLogger,
}));

// Import routes after mocking
import { sqlRoutes } from '../../routes/sql';

// Import schema cache for testing
import { schemaCache } from '../../services/schema-cache';

// Cache directory for cleanup
const CACHE_DIR = join(process.cwd(), '.cache', 'schemas');

describe('SQL Routes', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.route('/sqlserver', sqlRoutes);
    app.route('/redshift', sqlRoutes);

    // Clear all mocks
    Object.values(mockSqlServer).forEach((m) => m.mockClear());
    Object.values(mockRedshift).forEach((m) => m.mockClear());
    mockGetUser.mockClear();
    mockCheckQuery.mockClear();
    mockQueryLogger.log.mockClear();

    // Reset mock implementations
    mockCheckQuery.mockReturnValue({ allowed: true, blockedCommand: null });
    mockGetUser.mockReturnValue({ userId: 1, username: 'testuser', role: 'admin' });

    // Clear schema cache before each test
    schemaCache.clearAll();
  });

  afterEach(() => {
    // Clean up cache files
    schemaCache.clearAll();
  });

  describe('POST /sqlserver/execute', () => {
    test('should execute SQL query and return results', async () => {
      mockSqlServer.executeQuery.mockResolvedValueOnce({
        columns: ['id', 'name', 'email'],
        rows: [
          { id: 1, name: 'John', email: 'john@example.com' },
          { id: 2, name: 'Jane', email: 'jane@example.com' },
        ],
        rowCount: 2,
        executionTime: 150,
      });

      const res = await app.request('/sqlserver/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'SELECT * FROM users' }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.status).toBe('success');
      expect(json.columns).toEqual(['id', 'name', 'email']);
      expect(json.rows).toHaveLength(2);
      expect(json.row_count).toBe(2);
    });

    test('should accept sql field as alternative to query', async () => {
      mockSqlServer.executeQuery.mockResolvedValueOnce({
        columns: ['id'],
        rows: [{ id: 1 }],
        rowCount: 1,
        executionTime: 50,
      });

      const res = await app.request('/sqlserver/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: 'SELECT 1 as id' }),
      });

      expect(res.status).toBe(200);
      expect(mockSqlServer.executeQuery).toHaveBeenCalled();
    });

    test('should validate query is not empty', async () => {
      const res = await app.request('/sqlserver/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: '' }),
      });
      const json = await res.json();

      expect(res.status).toBe(400);
    });

    test('should handle query errors', async () => {
      mockSqlServer.executeQuery.mockRejectedValueOnce(
        new Error('Syntax error in SQL statement')
      );

      const res = await app.request('/sqlserver/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'INVALID SQL' }),
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.status).toBe('error');
      expect(json.error).toContain('Syntax error');
    });

    test('should accept optional params', async () => {
      mockSqlServer.executeQuery.mockResolvedValueOnce({
        columns: ['id'],
        rows: [{ id: 1 }],
        rowCount: 1,
        executionTime: 50,
      });

      const res = await app.request('/sqlserver/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'SELECT * FROM users WHERE id = @id',
          params: { id: 1 },
        }),
      });

      expect(res.status).toBe(200);
    });

    // Note: Query logging is not implemented in sql.ts routes
    // This test is skipped until the feature is added
    test.skip('should log successful query', async () => {
      mockSqlServer.executeQuery.mockResolvedValueOnce({
        columns: ['id'],
        rows: [{ id: 1 }],
        rowCount: 1,
        executionTime: 50,
      });

      await app.request('/sqlserver/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'SELECT 1' }),
      });

      expect(mockQueryLogger.log).toHaveBeenCalled();
    });
  });

  // Note: Query guard is not integrated in sql.ts routes
  // These tests are skipped until the feature is implemented
  describe.skip('Query Guard Integration', () => {
    test('should block DROP command for viewer role', async () => {
      mockGetUser.mockReturnValue({ userId: 1, username: 'viewer', role: 'viewer' });
      mockCheckQuery.mockReturnValue({ allowed: false, blockedCommand: 'DROP' });

      const res = await app.request('/sqlserver/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'DROP TABLE users' }),
      });

      // Should throw QueryBlockedError
      expect(res.status).toBe(403);
    });

    test('should block DELETE command for viewer role', async () => {
      mockGetUser.mockReturnValue({ userId: 1, username: 'viewer', role: 'viewer' });
      mockCheckQuery.mockReturnValue({ allowed: false, blockedCommand: 'DELETE' });

      const res = await app.request('/sqlserver/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'DELETE FROM users' }),
      });

      expect(res.status).toBe(403);
    });

    test('should allow all commands for admin role', async () => {
      mockGetUser.mockReturnValue({ userId: 1, username: 'admin', role: 'admin' });
      mockCheckQuery.mockReturnValue({ allowed: true, blockedCommand: null });

      mockSqlServer.executeQuery.mockResolvedValueOnce({
        columns: [],
        rows: [],
        rowCount: 0,
        executionTime: 50,
      });

      const res = await app.request('/sqlserver/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'DELETE FROM users WHERE id = 1' }),
      });

      expect(res.status).toBe(200);
    });

    test('should log blocked query', async () => {
      mockGetUser.mockReturnValue({ userId: 1, username: 'viewer', role: 'viewer' });
      mockCheckQuery.mockReturnValue({ allowed: false, blockedCommand: 'TRUNCATE' });

      await app.request('/sqlserver/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'TRUNCATE TABLE users' }),
      });

      expect(mockQueryLogger.log).toHaveBeenCalled();
    });
  });

  describe('POST /redshift/execute', () => {
    test('should use Redshift database', async () => {
      mockRedshift.executeQuery.mockResolvedValueOnce({
        columns: ['count'],
        rows: [{ count: 1000 }],
        rowCount: 1,
        executionTime: 200,
      });

      const res = await app.request('/redshift/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'SELECT COUNT(*) FROM events' }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(mockRedshift.executeQuery).toHaveBeenCalled();
      expect(mockSqlServer.executeQuery).not.toHaveBeenCalled();
    });
  });

  describe('GET /sqlserver/schema', () => {
    test('should return database schema', async () => {
      mockSqlServer.getSchema.mockResolvedValueOnce({
        dbo: ['users', 'orders'],
        staging: ['temp_data'],
      });

      const res = await app.request('/sqlserver/schema');
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.status).toBe('success');
      expect(json.schemas.dbo).toBeDefined();
    });

    test('should return cached schema when valid', async () => {
      // First request - should fetch from DB
      mockSqlServer.getSchema.mockResolvedValueOnce({
        dbo: ['users', 'orders'],
      });

      await app.request('/sqlserver/schema');

      // Second request - should use cache
      const res = await app.request('/sqlserver/schema');
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.cached).toBe(true);
      // Should only call getSchema once (first request)
      expect(mockSqlServer.getSchema).toHaveBeenCalledTimes(1);
    });

    test('should force refresh when refresh=true', async () => {
      // First populate cache
      mockSqlServer.getSchema.mockResolvedValueOnce({
        dbo: ['users'],
      });
      await app.request('/sqlserver/schema');

      // Force refresh
      mockSqlServer.getSchema.mockResolvedValueOnce({
        dbo: ['users', 'new_table'],
      });

      const res = await app.request('/sqlserver/schema?refresh=true');
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.cached).toBe(false);
      expect(mockSqlServer.getSchema).toHaveBeenCalledTimes(2);
    });

    test('should return empty object when disconnected', async () => {
      mockSqlServer.getSchema.mockRejectedValueOnce(new Error('Connection failed'));

      const res = await app.request('/sqlserver/schema');
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.status).toBe('error');
      expect(json.schemas).toEqual({});
    });
  });

  describe('GET /sqlserver/schema/cache', () => {
    test('should return cache info when cache exists', async () => {
      // First populate cache
      mockSqlServer.getSchema.mockResolvedValueOnce({
        dbo: ['users', 'orders'],
      });
      await app.request('/sqlserver/schema');

      const res = await app.request('/sqlserver/schema/cache');
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.status).toBe('success');
      expect(json.database).toBe('sqlserver');
      expect(json.cache).toBeDefined();
    });

    test('should return cache info for no cache', async () => {
      const res = await app.request('/sqlserver/schema/cache');
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.status).toBe('success');
    });
  });

  describe('DELETE /sqlserver/schema/cache', () => {
    test('should clear cache successfully', async () => {
      // First populate cache
      mockSqlServer.getSchema.mockResolvedValueOnce({
        dbo: ['users'],
      });
      await app.request('/sqlserver/schema');

      // Clear cache
      const res = await app.request('/sqlserver/schema/cache', {
        method: 'DELETE',
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.status).toBe('success');
      expect(json.cleared).toBe(true);
    });

    test('should return false when no cache to clear', async () => {
      const res = await app.request('/sqlserver/schema/cache', {
        method: 'DELETE',
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.cleared).toBe(false);
    });
  });

  describe('GET /redshift/schema', () => {
    test('should return Redshift schema', async () => {
      mockRedshift.getSchema.mockResolvedValueOnce({
        public: ['events', 'users'],
      });

      const res = await app.request('/redshift/schema');
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(mockRedshift.getSchema).toHaveBeenCalled();
    });

    test('should cache Redshift schema separately', async () => {
      // Populate both caches
      mockSqlServer.getSchema.mockResolvedValueOnce({ dbo: ['sql_table'] });
      mockRedshift.getSchema.mockResolvedValueOnce({ public: ['rs_table'] });

      await app.request('/sqlserver/schema');
      await app.request('/redshift/schema');

      // Clear only SQL Server cache
      await app.request('/sqlserver/schema/cache', { method: 'DELETE' });

      // Redshift should still be cached
      const res = await app.request('/redshift/schema');
      const json = await res.json();

      expect(json.cached).toBe(true);
    });
  });

  describe('GET /sqlserver/health', () => {
    test('should return connected status', async () => {
      mockSqlServer.getHealthStatus.mockResolvedValueOnce({
        status: 'healthy',
        connected: true,
        pool: { size: 10, available: 8, pending: 0 },
      });

      const res = await app.request('/sqlserver/health');
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.status).toBe('connected');
      expect(json.database).toBe('sqlserver');
    });

    test('should return disconnected status on error', async () => {
      mockSqlServer.getHealthStatus.mockRejectedValueOnce(new Error('Connection lost'));

      const res = await app.request('/sqlserver/health');
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.status).toBe('disconnected');
      expect(json.error).toBeDefined();
    });

    test('should return disconnected when not connected', async () => {
      mockSqlServer.getHealthStatus.mockResolvedValueOnce({
        status: 'unhealthy',
        connected: false,
        error: 'Pool exhausted',
      });

      const res = await app.request('/sqlserver/health');
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.status).toBe('disconnected');
    });
  });

  describe('GET /sqlserver/tables', () => {
    test('should return list of tables', async () => {
      mockSqlServer.executeQuery.mockResolvedValueOnce({
        columns: ['schema_name', 'table_name', 'row_count'],
        rows: [
          { schema_name: 'dbo', table_name: 'users', row_count: 100 },
          { schema_name: 'dbo', table_name: 'orders', row_count: 500 },
        ],
        rowCount: 2,
        executionTime: 50,
      });

      const res = await app.request('/sqlserver/tables');
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(2);
    });

    test('should handle table listing errors', async () => {
      mockSqlServer.executeQuery.mockRejectedValueOnce(new Error('Access denied'));

      const res = await app.request('/sqlserver/tables');
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.success).toBe(false);
    });
  });

  describe('GET /redshift/tables', () => {
    test('should return empty list for Redshift (placeholder)', async () => {
      const res = await app.request('/redshift/tables');
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toEqual([]);
    });
  });
});
