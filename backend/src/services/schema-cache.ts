// File-based schema cache service
// Caches database schema data with 30-day TTL

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { logger } from '../utils/logger';

const CACHE_DIR = join(process.cwd(), '.cache', 'schemas');
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

interface CacheEntry {
  data: Record<string, string[]>;
  timestamp: number;
  expiresAt: number;
}

interface CacheInfo {
  exists: boolean;
  cachedAt?: string;
  expiresAt?: string;
  age?: string;
  tableCount?: number;
}

function ensureCacheDir(): void {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function getCacheFilePath(dbType: 'redshift' | 'sqlserver'): string {
  return join(CACHE_DIR, `${dbType}-schema.json`);
}

function formatAge(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h ago`;
  if (hours > 0) return `${hours}h ${minutes % 60}m ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
}

export const schemaCache = {
  /**
   * Get cached schema data if valid, otherwise return null
   */
  get(dbType: 'redshift' | 'sqlserver'): Record<string, string[]> | null {
    try {
      const cacheFile = getCacheFilePath(dbType);

      if (!existsSync(cacheFile)) {
        return null;
      }

      const content = readFileSync(cacheFile, 'utf-8');
      const entry: CacheEntry = JSON.parse(content);

      // Check if cache has expired
      if (Date.now() > entry.expiresAt) {
        logger.info(`Schema cache expired for ${dbType}`, {
          metadata: { cachedAt: new Date(entry.timestamp).toISOString() }
        });
        return null;
      }

      const tableCount = Object.values(entry.data).flat().length;
      logger.info(`Schema cache hit for ${dbType}`, {
        metadata: {
          tableCount,
          age: formatAge(Date.now() - entry.timestamp)
        }
      });

      return entry.data;
    } catch (error) {
      logger.warn(`Failed to read schema cache for ${dbType}`, {
        metadata: { error: (error as Error).message }
      });
      return null;
    }
  },

  /**
   * Save schema data to cache
   */
  set(dbType: 'redshift' | 'sqlserver', data: Record<string, string[]>): void {
    try {
      ensureCacheDir();

      const entry: CacheEntry = {
        data,
        timestamp: Date.now(),
        expiresAt: Date.now() + CACHE_TTL_MS,
      };

      const cacheFile = getCacheFilePath(dbType);
      writeFileSync(cacheFile, JSON.stringify(entry, null, 2), 'utf-8');

      const tableCount = Object.values(data).flat().length;
      logger.info(`Schema cached for ${dbType}`, {
        metadata: {
          tableCount,
          expiresAt: new Date(entry.expiresAt).toISOString()
        }
      });
    } catch (error) {
      logger.warn(`Failed to write schema cache for ${dbType}`, {
        metadata: { error: (error as Error).message }
      });
    }
  },

  /**
   * Clear cache for a specific database type
   */
  clear(dbType: 'redshift' | 'sqlserver'): boolean {
    try {
      const cacheFile = getCacheFilePath(dbType);

      if (existsSync(cacheFile)) {
        unlinkSync(cacheFile);
        logger.info(`Schema cache cleared for ${dbType}`);
        return true;
      }

      return false;
    } catch (error) {
      logger.warn(`Failed to clear schema cache for ${dbType}`, {
        metadata: { error: (error as Error).message }
      });
      return false;
    }
  },

  /**
   * Clear all schema caches
   */
  clearAll(): { redshift: boolean; sqlserver: boolean } {
    return {
      redshift: this.clear('redshift'),
      sqlserver: this.clear('sqlserver'),
    };
  },

  /**
   * Get cache info for a specific database type
   */
  getInfo(dbType: 'redshift' | 'sqlserver'): CacheInfo {
    try {
      const cacheFile = getCacheFilePath(dbType);

      if (!existsSync(cacheFile)) {
        return { exists: false };
      }

      const content = readFileSync(cacheFile, 'utf-8');
      const entry: CacheEntry = JSON.parse(content);
      const tableCount = Object.values(entry.data).flat().length;

      return {
        exists: true,
        cachedAt: new Date(entry.timestamp).toISOString(),
        expiresAt: new Date(entry.expiresAt).toISOString(),
        age: formatAge(Date.now() - entry.timestamp),
        tableCount,
      };
    } catch (error) {
      return { exists: false };
    }
  },
};
