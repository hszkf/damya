/**
 * LocalStorage-based saved queries management.
 * Stores queries in browser localStorage for persistence across sessions.
 */

const STORAGE_KEY = "sql-saved-queries";

export interface LocalSavedQuery {
  id: string;
  query_name: string;
  query_text: string;
  query_type: "redshift";
  author?: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface SaveQueryRequest {
  query_name: string;
  query_text: string;
  query_type: "redshift";
  author?: string;
  description?: string;
}

/**
 * Get all saved queries from localStorage.
 */
export function getLocalSavedQueries(): LocalSavedQuery[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const queries = JSON.parse(stored);
    return Array.isArray(queries) ? queries : [];
  } catch {
    return [];
  }
}

/**
 * Get saved queries filtered by type and/or author.
 */
export function getFilteredQueries(
  queryType?: "redshift",
  author?: string
): LocalSavedQuery[] {
  let queries = getLocalSavedQueries();

  if (queryType) {
    queries = queries.filter((q) => q.query_type === queryType);
  }

  if (author && author !== "All") {
    queries = queries.filter((q) => q.author === author);
  }

  // Sort by updated_at descending (most recent first)
  return queries.sort((a, b) =>
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
}

/**
 * Save all queries to localStorage.
 */
function saveAllQueries(queries: LocalSavedQuery[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queries));
}

/**
 * Generate a unique ID for a new query.
 */
function generateId(): string {
  return `query-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Save a new query to localStorage.
 */
export function saveLocalQuery(request: SaveQueryRequest): LocalSavedQuery {
  const queries = getLocalSavedQueries();
  const now = new Date().toISOString();

  const newQuery: LocalSavedQuery = {
    id: generateId(),
    query_name: request.query_name,
    query_text: request.query_text,
    query_type: request.query_type,
    author: request.author,
    description: request.description,
    created_at: now,
    updated_at: now,
  };

  queries.push(newQuery);
  saveAllQueries(queries);

  return newQuery;
}

/**
 * Update an existing query.
 */
export function updateLocalQuery(
  id: string,
  updates: Partial<Omit<LocalSavedQuery, "id" | "created_at">>
): LocalSavedQuery | null {
  const queries = getLocalSavedQueries();
  const index = queries.findIndex((q) => q.id === id);

  if (index === -1) return null;

  queries[index] = {
    ...queries[index],
    ...updates,
    updated_at: new Date().toISOString(),
  };

  saveAllQueries(queries);
  return queries[index];
}

/**
 * Delete a query by ID.
 */
export function deleteLocalQuery(id: string): boolean {
  const queries = getLocalSavedQueries();
  const filtered = queries.filter((q) => q.id !== id);

  if (filtered.length === queries.length) return false;

  saveAllQueries(filtered);
  return true;
}

/**
 * Get a single query by ID.
 */
export function getLocalQueryById(id: string): LocalSavedQuery | null {
  const queries = getLocalSavedQueries();
  return queries.find((q) => q.id === id) || null;
}

/**
 * Check if a query name already exists for a given type.
 */
export function queryNameExists(
  queryName: string,
  queryType: "redshift",
  excludeId?: string
): boolean {
  const queries = getLocalSavedQueries();
  return queries.some(
    (q) =>
      q.query_name.toLowerCase() === queryName.toLowerCase() &&
      q.query_type === queryType &&
      q.id !== excludeId
  );
}

/**
 * Export queries to JSON file for backup.
 */
export function exportQueriesToJson(): string {
  const queries = getLocalSavedQueries();
  return JSON.stringify(queries, null, 2);
}

/**
 * Import queries from JSON.
 */
export function importQueriesFromJson(json: string, merge = true): number {
  try {
    const imported = JSON.parse(json);
    if (!Array.isArray(imported)) {
      throw new Error("Invalid format: expected an array");
    }

    if (merge) {
      const existing = getLocalSavedQueries();
      const existingIds = new Set(existing.map((q) => q.id));

      // Add only queries with new IDs
      const newQueries = imported.filter((q: LocalSavedQuery) => !existingIds.has(q.id));
      saveAllQueries([...existing, ...newQueries]);
      return newQueries.length;
    } else {
      saveAllQueries(imported);
      return imported.length;
    }
  } catch {
    throw new Error("Failed to import queries: invalid JSON format");
  }
}
