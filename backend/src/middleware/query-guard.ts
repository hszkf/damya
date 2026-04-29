/**
 * Query Guard Middleware
 * Blocks dangerous SQL commands based on user role
 */

import type { Context, Next } from 'hono';
import type { UserRole } from '../models/user';
import { hasPermission } from '../models/user';
import { QueryBlockedError } from '../utils/errors';
import { logger } from '../utils/logger';
import { queryLogger } from '../services/query-logger';

/**
 * SQL command patterns and their required permissions
 */
const SQL_PATTERNS = {
  // DDL commands (require canExecuteDDL)
  ddl: [
    /\bDROP\s+(TABLE|DATABASE|INDEX|VIEW|SCHEMA|PROCEDURE|FUNCTION|TRIGGER)/i,
    /\bTRUNCATE\s+TABLE/i,
    /\bALTER\s+(TABLE|DATABASE|INDEX|VIEW|SCHEMA|PROCEDURE|FUNCTION)/i,
    /\bCREATE\s+(TABLE|DATABASE|INDEX|VIEW|SCHEMA|PROCEDURE|FUNCTION|TRIGGER)/i,
  ],
  // DELETE commands (require canExecuteDelete)
  delete: [
    /\bDELETE\s+FROM/i,
    /\bDELETE\s+\w+\s+FROM/i, // DELETE alias FROM
  ],
  // UPDATE commands (require canExecuteUpdate)
  update: [
    /\bUPDATE\s+\w+\s+SET/i,
  ],
  // INSERT commands (require canExecuteInsert)
  insert: [
    /\bINSERT\s+INTO/i,
    /\bINSERT\s+\w+\s*\(/i, // INSERT table (columns)
  ],
};

/**
 * Blocked commands per role
 * Based on the permissions matrix
 */
const BLOCKED_COMMANDS = {
  viewer: ['DDL', 'DELETE', 'UPDATE', 'INSERT'],
  editor: ['DDL', 'DELETE', 'UPDATE'],
  admin: [], // Admin has full access
} as const;

/**
 * Check if a query contains blocked commands for a role
 */
export function checkQuery(query: string, role: UserRole): { allowed: boolean; blockedCommand?: string } {
  const blockedTypes = BLOCKED_COMMANDS[role];

  for (const blockedType of blockedTypes) {
    let patterns: RegExp[];

    switch (blockedType) {
      case 'DDL':
        patterns = SQL_PATTERNS.ddl;
        break;
      case 'DELETE':
        patterns = SQL_PATTERNS.delete;
        break;
      case 'UPDATE':
        patterns = SQL_PATTERNS.update;
        break;
      case 'INSERT':
        patterns = SQL_PATTERNS.insert;
        break;
      default:
        continue;
    }

    for (const pattern of patterns) {
      if (pattern.test(query)) {
        // Extract the matched command for error message
        const match = query.match(pattern);
        const command = match && match[0] ? match[0].split(/\s+/)[0]?.toUpperCase() || blockedType : blockedType;
        return { allowed: false, blockedCommand: command };
      }
    }
  }

  return { allowed: true };
}

/**
 * Get list of blocked commands for a role
 */
export function getBlockedCommandsForRole(role: UserRole): string[] {
  const blocked: string[] = [];

  if (!hasPermission(role, 'canExecuteDDL')) {
    blocked.push('DROP', 'TRUNCATE', 'ALTER', 'CREATE');
  }
  if (!hasPermission(role, 'canExecuteDelete')) {
    blocked.push('DELETE');
  }
  if (!hasPermission(role, 'canExecuteUpdate')) {
    blocked.push('UPDATE');
  }
  if (!hasPermission(role, 'canExecuteInsert')) {
    blocked.push('INSERT');
  }

  return blocked;
}
