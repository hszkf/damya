/**
 * SQL Syntax Highlighting Utility
 * Tokenizes SQL queries and returns highlighted HTML
 */

export interface Token {
  type: 'keyword' | 'function' | 'string' | 'number' | 'comment' | 'operator' | 'identifier' | 'whitespace';
  value: string;
}

const SQL_KEYWORDS = new Set([
  // DML
  'SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'INTO', 'VALUES',
  'SET', 'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET', 'TOP',
  // Joins
  'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'OUTER', 'CROSS', 'ON', 'USING',
  // DDL
  'CREATE', 'ALTER', 'DROP', 'TABLE', 'VIEW', 'INDEX', 'DATABASE', 'SCHEMA',
  'ADD', 'COLUMN', 'CONSTRAINT', 'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES',
  // Data types
  'INT', 'INTEGER', 'BIGINT', 'SMALLINT', 'DECIMAL', 'NUMERIC', 'FLOAT', 'REAL',
  'VARCHAR', 'CHAR', 'TEXT', 'DATE', 'TIME', 'TIMESTAMP', 'DATETIME', 'BOOLEAN',
  'BOOL', 'BLOB', 'CLOB',
  // Logical
  'AND', 'OR', 'NOT', 'IN', 'LIKE', 'BETWEEN', 'IS', 'NULL', 'EXISTS',
  'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
  // Other
  'AS', 'DISTINCT', 'ALL', 'UNION', 'INTERSECT', 'EXCEPT', 'WITH',
  'PARTITION', 'OVER', 'ROW_NUMBER', 'RANK', 'DENSE_RANK',
]);

const SQL_FUNCTIONS = new Set([
  'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'ROUND', 'FLOOR', 'CEIL', 'ABS',
  'UPPER', 'LOWER', 'TRIM', 'SUBSTRING', 'CONCAT', 'LENGTH', 'COALESCE',
  'CAST', 'CONVERT', 'NOW', 'CURRENT_TIMESTAMP', 'DATE_SUB', 'DATE_ADD',
  'YEAR', 'MONTH', 'DAY', 'HOUR', 'MINUTE', 'SECOND',
]);

export function tokenizeSql(sql: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < sql.length) {
    const char = sql[i];

    // Whitespace
    if (/\s/.test(char)) {
      let whitespace = '';
      while (i < sql.length && /\s/.test(sql[i])) {
        whitespace += sql[i];
        i++;
      }
      tokens.push({ type: 'whitespace', value: whitespace });
      continue;
    }

    // Line comments
    if (sql.slice(i, i + 2) === '--') {
      let comment = '';
      while (i < sql.length && sql[i] !== '\n') {
        comment += sql[i];
        i++;
      }
      tokens.push({ type: 'comment', value: comment });
      continue;
    }

    // Block comments
    if (sql.slice(i, i + 2) === '/*') {
      let comment = '';
      while (i < sql.length) {
        comment += sql[i];
        if (sql.slice(i, i + 2) === '*/') {
          comment += sql[i + 1];
          i += 2;
          break;
        }
        i++;
      }
      tokens.push({ type: 'comment', value: comment });
      continue;
    }

    // String literals (single quotes)
    if (char === "'") {
      let string = "'";
      i++;
      while (i < sql.length) {
        string += sql[i];
        if (sql[i] === "'" && sql[i - 1] !== '\\') {
          i++;
          break;
        }
        i++;
      }
      tokens.push({ type: 'string', value: string });
      continue;
    }

    // Numbers
    if (/\d/.test(char)) {
      let number = '';
      while (i < sql.length && /[\d.]/.test(sql[i])) {
        number += sql[i];
        i++;
      }
      tokens.push({ type: 'number', value: number });
      continue;
    }

    // Operators
    if (/[=<>!+\-*/%,;()[\].]/.test(char)) {
      let operator = char;
      i++;
      // Check for multi-character operators
      if (i < sql.length && /[=<>]/.test(char) && /[=<>]/.test(sql[i])) {
        operator += sql[i];
        i++;
      }
      tokens.push({ type: 'operator', value: operator });
      continue;
    }

    // Identifiers and keywords
    if (/[a-zA-Z_]/.test(char)) {
      let identifier = '';
      while (i < sql.length && /[a-zA-Z0-9_]/.test(sql[i])) {
        identifier += sql[i];
        i++;
      }

      const upperIdentifier = identifier.toUpperCase();
      if (SQL_KEYWORDS.has(upperIdentifier)) {
        tokens.push({ type: 'keyword', value: identifier });
      } else if (SQL_FUNCTIONS.has(upperIdentifier)) {
        tokens.push({ type: 'function', value: identifier });
      } else {
        tokens.push({ type: 'identifier', value: identifier });
      }
      continue;
    }

    // Unknown character - treat as identifier
    tokens.push({ type: 'identifier', value: char });
    i++;
  }

  return tokens;
}

export function highlightSql(sql: string): string {
  const tokens = tokenizeSql(sql);
  return tokens
    .map((token) => {
      switch (token.type) {
        case 'keyword':
          return `<span class="sql-keyword">${escapeHtml(token.value)}</span>`;
        case 'function':
          return `<span class="sql-function">${escapeHtml(token.value)}</span>`;
        case 'string':
          return `<span class="sql-string">${escapeHtml(token.value)}</span>`;
        case 'number':
          return `<span class="sql-number">${escapeHtml(token.value)}</span>`;
        case 'comment':
          return `<span class="sql-comment">${escapeHtml(token.value)}</span>`;
        case 'operator':
          return `<span class="sql-operator">${escapeHtml(token.value)}</span>`;
        case 'identifier':
          // Check if it looks like a table name (in brackets or has dots)
          if (token.value.includes('.') || (token.value.startsWith('[') && token.value.endsWith(']'))) {
            return `<span class="sql-table">${escapeHtml(token.value)}</span>`;
          }
          return escapeHtml(token.value);
        default:
          return escapeHtml(token.value);
      }
    })
    .join('');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
