import { describe, expect, test, beforeEach, afterEach, mock } from 'bun:test';
import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';

// Test cache directory
const TEST_CACHE_DIR = join(process.cwd(), '.cache', 'schemas-test');

// Mock the cache directory path
mock.module('../../services/schema-cache', () => {
  const originalModule = require('../../services/schema-cache');

  // Override getCacheFilePath to use test directory
  const getCacheFilePath = (dbType: 'redshift' | 'sqlserver'): string => {
    return join(TEST_CACHE_DIR, `${dbType}-schema.json`);
  };

  // Return mocked module with test paths
  return {
    ...originalModule,
  };
});

// Import after mocking
import { schemaCache } from '../../services/schema-cache';

// Helper to create test cache entry
function createCacheEntry(data: Record<string, string[]>, timestampMs?: number, ttlMs?: number) {
  const timestamp = timestampMs || Date.now();
  const expiresAt = timestamp + (ttlMs || 30 * 24 * 60 * 60 * 1000);

  return {
    data,
    timestamp,
    expiresAt,
  };
}

// Mock logger to avoid console output during tests
mock.module('../../utils/logger', () => ({
  logger: {
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
    debug: mock(() => {}),
  },
}));

describe('SchemaCache Service', () => {
  const CACHE_DIR = join(process.cwd(), '.cache', 'schemas');

  // Clean up before and after tests
  beforeEach(() => {
    // Ensure cache directory exists
    if (!existsSync(CACHE_DIR)) {
      mkdirSync(CACHE_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test cache files
    try {
      const redshiftFile = join(CACHE_DIR, 'redshift-schema.json');
      const sqlserverFile = join(CACHE_DIR, 'sqlserver-schema.json');

      if (existsSync(redshiftFile)) {
        rmSync(redshiftFile);
      }
      if (existsSync(sqlserverFile)) {
        rmSync(sqlserverFile);
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('set()', () => {
    test('should cache schema data for sqlserver', () => {
      const testData = {
        dbo: ['Customers', 'Orders', 'Products'],
        staging: ['temp_data'],
      };

      schemaCache.set('sqlserver', testData);

      // Verify file was created
      const cacheFile = join(CACHE_DIR, 'sqlserver-schema.json');
      expect(existsSync(cacheFile)).toBe(true);

      // Verify content
      const content = JSON.parse(readFileSync(cacheFile, 'utf-8'));
      expect(content.data).toEqual(testData);
      expect(content.timestamp).toBeDefined();
      expect(content.expiresAt).toBeDefined();
    });

    test('should cache schema data for redshift', () => {
      const testData = {
        public: ['users', 'sessions'],
        analytics: ['daily_metrics'],
      };

      schemaCache.set('redshift', testData);

      // Verify file was created
      const cacheFile = join(CACHE_DIR, 'redshift-schema.json');
      expect(existsSync(cacheFile)).toBe(true);

      // Verify content
      const content = JSON.parse(readFileSync(cacheFile, 'utf-8'));
      expect(content.data).toEqual(testData);
    });

    test('should set expiration time 30 days in the future', () => {
      const testData = { dbo: ['Test'] };
      const beforeSet = Date.now();

      schemaCache.set('sqlserver', testData);

      const afterSet = Date.now();
      const cacheFile = join(CACHE_DIR, 'sqlserver-schema.json');
      const content = JSON.parse(readFileSync(cacheFile, 'utf-8'));

      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      expect(content.expiresAt).toBeGreaterThanOrEqual(beforeSet + thirtyDaysMs);
      expect(content.expiresAt).toBeLessThanOrEqual(afterSet + thirtyDaysMs);
    });

    test('should overwrite existing cache', () => {
      const initialData = { dbo: ['Old'] };
      const updatedData = { dbo: ['New', 'Tables'] };

      schemaCache.set('sqlserver', initialData);
      schemaCache.set('sqlserver', updatedData);

      const cacheFile = join(CACHE_DIR, 'sqlserver-schema.json');
      const content = JSON.parse(readFileSync(cacheFile, 'utf-8'));
      expect(content.data).toEqual(updatedData);
    });

    test('should create cache directory if not exists', () => {
      // Remove cache dir if it exists
      if (existsSync(CACHE_DIR)) {
        rmSync(CACHE_DIR, { recursive: true, force: true });
      }

      const testData = { dbo: ['Test'] };
      schemaCache.set('sqlserver', testData);

      expect(existsSync(CACHE_DIR)).toBe(true);
    });
  });

  describe('get()', () => {
    test('should return null when cache file does not exist', () => {
      const result = schemaCache.get('sqlserver');
      expect(result).toBeNull();
    });

    test('should return cached data when cache is valid', () => {
      const testData = {
        dbo: ['Customers', 'Orders'],
        staging: ['temp'],
      };

      schemaCache.set('sqlserver', testData);
      const result = schemaCache.get('sqlserver');

      expect(result).toEqual(testData);
    });

    test('should return null when cache is expired', () => {
      const cacheFile = join(CACHE_DIR, 'sqlserver-schema.json');

      // Create expired cache entry (expired 1 day ago)
      const expiredEntry = {
        data: { dbo: ['OldData'] },
        timestamp: Date.now() - 31 * 24 * 60 * 60 * 1000, // 31 days ago
        expiresAt: Date.now() - 24 * 60 * 60 * 1000, // 1 day ago
      };

      writeFileSync(cacheFile, JSON.stringify(expiredEntry), 'utf-8');

      const result = schemaCache.get('sqlserver');
      expect(result).toBeNull();
    });

    test('should return cached data just before expiration', () => {
      const cacheFile = join(CACHE_DIR, 'sqlserver-schema.json');

      // Create cache entry that expires in 1 minute
      const validEntry = {
        data: { dbo: ['ValidData'] },
        timestamp: Date.now(),
        expiresAt: Date.now() + 60 * 1000, // 1 minute from now
      };

      writeFileSync(cacheFile, JSON.stringify(validEntry), 'utf-8');

      const result = schemaCache.get('sqlserver');
      expect(result).toEqual({ dbo: ['ValidData'] });
    });

    test('should return null for corrupted cache file', () => {
      const cacheFile = join(CACHE_DIR, 'sqlserver-schema.json');
      writeFileSync(cacheFile, 'not valid json', 'utf-8');

      const result = schemaCache.get('sqlserver');
      expect(result).toBeNull();
    });

    test('should handle separate caches for redshift and sqlserver', () => {
      const sqlserverData = { dbo: ['SQLServerTable'] };
      const redshiftData = { public: ['RedshiftTable'] };

      schemaCache.set('sqlserver', sqlserverData);
      schemaCache.set('redshift', redshiftData);

      expect(schemaCache.get('sqlserver')).toEqual(sqlserverData);
      expect(schemaCache.get('redshift')).toEqual(redshiftData);
    });
  });

  describe('clear()', () => {
    test('should clear cache for sqlserver', () => {
      schemaCache.set('sqlserver', { dbo: ['Test'] });

      const result = schemaCache.clear('sqlserver');

      expect(result).toBe(true);
      expect(schemaCache.get('sqlserver')).toBeNull();
    });

    test('should clear cache for redshift', () => {
      schemaCache.set('redshift', { public: ['Test'] });

      const result = schemaCache.clear('redshift');

      expect(result).toBe(true);
      expect(schemaCache.get('redshift')).toBeNull();
    });

    test('should return false when no cache to clear', () => {
      const result = schemaCache.clear('sqlserver');
      expect(result).toBe(false);
    });

    test('should not affect other database caches', () => {
      schemaCache.set('sqlserver', { dbo: ['SQLServer'] });
      schemaCache.set('redshift', { public: ['Redshift'] });

      schemaCache.clear('sqlserver');

      expect(schemaCache.get('sqlserver')).toBeNull();
      expect(schemaCache.get('redshift')).toEqual({ public: ['Redshift'] });
    });
  });

  describe('clearAll()', () => {
    test('should clear both sqlserver and redshift caches', () => {
      schemaCache.set('sqlserver', { dbo: ['SQL'] });
      schemaCache.set('redshift', { public: ['RS'] });

      const result = schemaCache.clearAll();

      expect(result.sqlserver).toBe(true);
      expect(result.redshift).toBe(true);
      expect(schemaCache.get('sqlserver')).toBeNull();
      expect(schemaCache.get('redshift')).toBeNull();
    });

    test('should handle partial clear when only one cache exists', () => {
      schemaCache.set('sqlserver', { dbo: ['SQL'] });

      const result = schemaCache.clearAll();

      expect(result.sqlserver).toBe(true);
      expect(result.redshift).toBe(false);
    });

    test('should return false for both when no caches exist', () => {
      const result = schemaCache.clearAll();

      expect(result.sqlserver).toBe(false);
      expect(result.redshift).toBe(false);
    });
  });

  describe('getInfo()', () => {
    test('should return exists: false when cache does not exist', () => {
      const info = schemaCache.getInfo('sqlserver');

      expect(info.exists).toBe(false);
      expect(info.cachedAt).toBeUndefined();
      expect(info.expiresAt).toBeUndefined();
      expect(info.age).toBeUndefined();
      expect(info.tableCount).toBeUndefined();
    });

    test('should return cache info when cache exists', () => {
      const testData = {
        dbo: ['Table1', 'Table2'],
        staging: ['Table3'],
      };

      schemaCache.set('sqlserver', testData);
      const info = schemaCache.getInfo('sqlserver');

      expect(info.exists).toBe(true);
      expect(info.cachedAt).toBeDefined();
      expect(info.expiresAt).toBeDefined();
      expect(info.age).toBeDefined();
      expect(info.tableCount).toBe(3); // 2 + 1 tables
    });

    test('should return correct table count', () => {
      const testData = {
        schema1: ['a', 'b', 'c'],
        schema2: ['d', 'e'],
        schema3: ['f'],
      };

      schemaCache.set('redshift', testData);
      const info = schemaCache.getInfo('redshift');

      expect(info.tableCount).toBe(6);
    });

    test('should format age correctly', () => {
      const testData = { dbo: ['Test'] };

      schemaCache.set('sqlserver', testData);
      const info = schemaCache.getInfo('sqlserver');

      // Age should be in human-readable format
      expect(info.age).toMatch(/ago$/);
    });

    test('should return exists: false for corrupted cache', () => {
      const cacheFile = join(CACHE_DIR, 'sqlserver-schema.json');
      writeFileSync(cacheFile, 'invalid json', 'utf-8');

      const info = schemaCache.getInfo('sqlserver');
      expect(info.exists).toBe(false);
    });
  });

  describe('Cache TTL', () => {
    test('should use 30 day TTL', () => {
      const testData = { dbo: ['Test'] };
      const beforeSet = Date.now();

      schemaCache.set('sqlserver', testData);

      const cacheFile = join(CACHE_DIR, 'sqlserver-schema.json');
      const content = JSON.parse(readFileSync(cacheFile, 'utf-8'));

      const expectedTTL = 30 * 24 * 60 * 60 * 1000; // 30 days
      const actualTTL = content.expiresAt - content.timestamp;

      // Allow 100ms tolerance for execution time
      expect(actualTTL).toBeGreaterThanOrEqual(expectedTTL - 100);
      expect(actualTTL).toBeLessThanOrEqual(expectedTTL + 100);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty schema data', () => {
      const emptyData = {};

      schemaCache.set('sqlserver', emptyData);
      const result = schemaCache.get('sqlserver');

      expect(result).toEqual({});
    });

    test('should handle schema with empty arrays', () => {
      const dataWithEmpty = {
        dbo: [],
        public: ['table1'],
      };

      schemaCache.set('sqlserver', dataWithEmpty);
      const result = schemaCache.get('sqlserver');

      expect(result).toEqual(dataWithEmpty);
    });

    test('should handle special characters in table names', () => {
      const dataWithSpecialChars = {
        dbo: ['table-name', 'table_name', 'Table Name With Spaces'],
      };

      schemaCache.set('sqlserver', dataWithSpecialChars);
      const result = schemaCache.get('sqlserver');

      expect(result).toEqual(dataWithSpecialChars);
    });

    test('should handle unicode in table names', () => {
      const dataWithUnicode = {
        dbo: ['表格', 'テーブル', 'таблица'],
      };

      schemaCache.set('sqlserver', dataWithUnicode);
      const result = schemaCache.get('sqlserver');

      expect(result).toEqual(dataWithUnicode);
    });
  });

  describe('Concurrent Access', () => {
    test('should handle multiple rapid get/set operations', async () => {
      const testData = { dbo: ['Test'] };

      // Rapid writes
      for (let i = 0; i < 10; i++) {
        schemaCache.set('sqlserver', { dbo: [`Table${i}`] });
      }

      // Should have last written value
      const result = schemaCache.get('sqlserver');
      expect(result).toEqual({ dbo: ['Table9'] });
    });
  });
});
