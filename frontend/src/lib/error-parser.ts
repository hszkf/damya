/**
 * Parse SQL error messages to extract line and column information
 */

export interface ErrorLocation {
  line: number;
  column?: number;
  message: string;
}

/**
 * Extract line number from various SQL error formats
 */
export function parseErrorLocation(errorMessage: string): ErrorLocation | null {
  if (!errorMessage) return null;

  // PostgreSQL/Redshift format: "LINE 5: SELECT * FORM users"
  const pgLineMatch = errorMessage.match(/LINE (\d+):/i);
  if (pgLineMatch) {
    return {
      line: parseInt(pgLineMatch[1], 10),
      message: errorMessage,
    };
  }

  // Generic line format: "line 5"
  const lineMatch = errorMessage.match(/(?:on line|line)\s+(\d+)/i);
  if (lineMatch) {
    return {
      line: parseInt(lineMatch[1], 10),
      message: errorMessage,
    };
  }

  // Generic format: "Error at line 10"
  const genericLineMatch = errorMessage.match(/(?:error|syntax).*?line\s+(\d+)/i);
  if (genericLineMatch) {
    return {
      line: parseInt(genericLineMatch[1], 10),
      message: errorMessage,
    };
  }

  // Position format: "position 45" - calculate line from query
  const positionMatch = errorMessage.match(/position\s+(\d+)/i);
  if (positionMatch) {
    return null;
  }

  return null;
}

/**
 * Convert character position to line number given a query string
 */
export function positionToLine(query: string, position: number): number {
  const textBeforePosition = query.substring(0, position);
  return textBeforePosition.split('\n').length;
}

/**
 * Extract error context from message (the specific part that's wrong)
 */
export function extractErrorContext(errorMessage: string): string | null {
  // Extract text in quotes
  const quotedMatch = errorMessage.match(/['"]([^'"]+)['"]/);
  if (quotedMatch) {
    return quotedMatch[1];
  }

  // Extract text after "near"
  const nearMatch = errorMessage.match(/near\s+(.+?)(?:\.|$)/i);
  if (nearMatch) {
    return nearMatch[1].trim();
  }

  return null;
}
