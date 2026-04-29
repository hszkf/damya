/**
 * API client for SQL Query Studio backend
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

export interface QueryResult {
  status: "success" | "error";
  columns: string[];
  rows: Record<string, unknown>[];
  row_count: number;
  execution_time: number;
  message?: string;
  error?: string;
}

export interface HealthStatus {
  status: "connected" | "disconnected";
  database: string;
  error?: string;
}

export interface SchemaResult {
  status: "success" | "error";
  schemas: Record<string, string[]>;
  detail?: string;
  cached?: boolean;
  cacheInfo?: {
    cachedAt?: string;
    age?: string;
  };
}

export interface ClearCacheResult {
  status: "success" | "error";
  database: string;
  cleared: boolean;
  message: string;
}

/**
 * Execute a SQL query against the specified database
 */
export async function executeQuery(
  database: "redshift",
  sql: string,
  parameters?: unknown[],
  signal?: AbortSignal
): Promise<QueryResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/${database}/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql, parameters }),
      signal,
    });

    if (!response.ok) {
      // Try to get error details from response
      let errorMessage = `Query failed with status ${response.status}`;
      try {
        const errorData = await response.json();
        console.log("Error response from API:", errorData);

        // Extract the most detailed error message available
        if (typeof errorData.detail === 'string') {
          errorMessage = errorData.detail;
        } else if (errorData.detail?.message) {
          errorMessage = errorData.detail.message;
        } else if (errorData.detail?.error) {
          errorMessage = errorData.detail.error;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch {
        // If JSON parsing fails, use status text
        errorMessage = response.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();

    // Debug logging
    console.log("Raw API response:", JSON.stringify(result, null, 2));

    // Ensure rows and columns are always arrays
    result.rows = result.rows || [];
    result.columns = result.columns || [];

    // Normalise the response - Redshift returns rows as arrays, SQL Server as objects
    // Convert array rows to object rows using column names
    if (
      result.rows.length > 0 &&
      result.columns.length > 0 &&
      Array.isArray(result.rows[0])
    ) {
      console.log("Converting array rows to object rows");
      result.rows = result.rows.map((row: unknown[]) => {
        const obj: Record<string, unknown> = {};
        result.columns.forEach((col: string, idx: number) => {
          obj[col] = row[idx];
        });
        return obj;
      });
    }

    console.log("Normalised result:", JSON.stringify(result, null, 2));

    return result;
  } catch (error) {
    // Catch all errors: network errors, timeout errors, parsing errors, etc.
    if (error instanceof Error) {
      // Check for specific error types
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error(`Unable to connect to API server at ${API_BASE_URL}. Please check if the server is running.`);
      }
      if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
        throw new Error(`Network error: Cannot reach the API server. Please check your connection.`);
      }
      // Re-throw the error with original message
      throw error;
    }
    // Unknown error type
    throw new Error(`An unexpected error occurred: ${String(error)}`);
  }
}

/**
 * Check the health status of a database connection
 */
export async function checkHealth(
  database: "redshift"
): Promise<HealthStatus> {
  try {
    const response = await fetch(`${API_BASE_URL}/${database}/health`);
    return response.json();
  } catch {
    return {
      status: "disconnected",
      database,
      error: "Failed to connect to API server",
    };
  }
}

/**
 * Get schemas and tables for a database
 * @param database - The database type
 * @param refresh - If true, bypasses cache and fetches fresh data
 */
export async function getSchemas(
  database: "redshift",
  refresh: boolean = false
): Promise<SchemaResult> {
  try {
    const url = refresh
      ? `${API_BASE_URL}/${database}/schema?refresh=true`
      : `${API_BASE_URL}/${database}/schema`;
    const response = await fetch(url);
    const data = await response.json();

    // Backend always returns { status, schemas } even on error
    // Ensure schemas is always an object
    return {
      status: data.status || (response.ok ? "success" : "error"),
      schemas: data.schemas || {},
      detail: data.detail,
      cached: data.cached,
      cacheInfo: data.cacheInfo,
    };
  } catch (error) {
    // Network or parsing error
    if (error instanceof Error) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        return {
          status: "error",
          schemas: {},
          detail: `Unable to connect to API server. Please check if the server is running.`,
        };
      }
      return {
        status: "error",
        schemas: {},
        detail: error.message,
      };
    }
    return {
      status: "error",
      schemas: {},
      detail: `An unexpected error occurred: ${String(error)}`,
    };
  }
}

/**
 * Clear the schema cache for a database
 */
export async function clearSchemaCache(
  database: "redshift"
): Promise<ClearCacheResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/${database}/schema/cache`, {
      method: "DELETE",
    });

    if (!response.ok) {
      let errorMessage = `Failed to clear cache with status ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.message || errorMessage;
      } catch {
        errorMessage = response.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    return response.json();
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error(`Unable to connect to API server. Please check if the server is running.`);
      }
      throw error;
    }
    throw new Error(`An unexpected error occurred while clearing cache: ${String(error)}`);
  }
}

// =============================================================================
// Saved Queries API
// =============================================================================

export interface SavedQuery {
  id: number;
  query_name: string;
  query_text: string;
  query_type: "redshift";
  author: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface SaveQueryRequest {
  query_name: string;
  query_text: string;
  query_type: "redshift";
  author: string;
  description?: string;
}

export interface SaveQueryResponse {
  status: "success" | "error";
  message: string;
  id?: number;
}

export interface GetQueriesResponse {
  status: "success" | "error";
  queries: SavedQuery[];
}

/**
 * Get the hostname of the current machine
 * In browser environment, we use a combination of methods to identify the user
 */
export function getHostname(): string {
  if (typeof window !== "undefined") {
    // Try to get hostname from various sources
    const hostname = window.location.hostname;

    // If localhost, try to get a more meaningful identifier
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      // Use a stored identifier or generate one
      let storedHostname = localStorage.getItem("sql_studio_hostname");
      if (!storedHostname) {
        // Generate a hostname based on browser info
        const userAgent = navigator.userAgent;
        const platform = navigator.platform || "unknown";
        // Create a simple hash-like identifier
        storedHostname = `${platform}-${userAgent.slice(0, 20).replace(/[^a-zA-Z0-9]/g, "")}`;
        localStorage.setItem("sql_studio_hostname", storedHostname);
      }
      return storedHostname;
    }

    return hostname;
  }
  return "unknown-host";
}

/**
 * Save a query to the database
 */
export async function saveQuery(request: SaveQueryRequest): Promise<SaveQueryResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/queries/save`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      let errorMessage = `Failed to save query with status ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.message || errorMessage;
      } catch {
        errorMessage = response.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    return response.json();
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error(`Unable to connect to API server. Please check if the server is running.`);
      }
      throw error;
    }
    throw new Error(`An unexpected error occurred while saving query: ${String(error)}`);
  }
}

/**
 * Get all saved queries, optionally filtered by type or author
 */
export async function getSavedQueries(
  queryType?: "redshift",
  author?: string
): Promise<GetQueriesResponse> {
  try {
    const params = new URLSearchParams();
    if (queryType) params.append("query_type", queryType);
    if (author) params.append("author", author);

    const url = `${API_BASE_URL}/queries${params.toString() ? `?${params.toString()}` : ""}`;
    const response = await fetch(url);

    if (!response.ok) {
      let errorMessage = `Failed to fetch queries with status ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.message || errorMessage;
      } catch {
        errorMessage = response.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    return response.json();
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error(`Unable to connect to API server. Please check if the server is running.`);
      }
      throw error;
    }
    throw new Error(`An unexpected error occurred while fetching queries: ${String(error)}`);
  }
}

/**
 * Get a specific saved query by ID
 */
export async function getQueryById(queryId: number): Promise<{ status: string; query: SavedQuery }> {
  try {
    const response = await fetch(`${API_BASE_URL}/queries/${queryId}`);

    if (!response.ok) {
      let errorMessage = `Failed to fetch query with status ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.message || errorMessage;
      } catch {
        errorMessage = response.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    return response.json();
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error(`Unable to connect to API server. Please check if the server is running.`);
      }
      throw error;
    }
    throw new Error(`An unexpected error occurred while fetching query: ${String(error)}`);
  }
}

/**
 * Update a saved query
 */
export async function updateQuery(
  queryId: number,
  updates: { query_name?: string; query_text?: string; description?: string }
): Promise<{ status: string; message: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/queries/${queryId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      let errorMessage = `Failed to update query with status ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.message || errorMessage;
      } catch {
        errorMessage = response.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    return response.json();
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error(`Unable to connect to API server. Please check if the server is running.`);
      }
      throw error;
    }
    throw new Error(`An unexpected error occurred while updating query: ${String(error)}`);
  }
}

/**
 * Delete a saved query
 */
export async function deleteQuery(queryId: number): Promise<{ status: string; message: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/queries/${queryId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      let errorMessage = `Failed to delete query with status ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.message || errorMessage;
      } catch {
        errorMessage = response.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    return response.json();
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error(`Unable to connect to API server. Please check if the server is running.`);
      }
      throw error;
    }
    throw new Error(`An unexpected error occurred while deleting query: ${String(error)}`);
  }
}

