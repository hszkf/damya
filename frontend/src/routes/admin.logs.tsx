/**
 * Admin Query Logs Page
 * View and search query execution logs
 */

import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FileText,
  Search,
  Download,
  Filter,
  Loader2,
  CheckCircle,
  XCircle,
  Ban,
} from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { formatMYDateTime } from '~/lib/date-utils';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

// @ts-expect-error - Route will be auto-generated when dev server runs
export const Route = createFileRoute('/admin/logs')({
  component: AdminLogsPage,
});

interface QueryLog {
  id: string;
  timestamp: string;
  userId: number;
  username: string;
  role: string;
  database: 'sqlserver' | 'redshift';
  query: string;
  executionTimeMs: number;
  rowCount: number;
  status: 'success' | 'error' | 'blocked';
  errorMessage?: string;
  blockedReason?: string;
}

interface LogsResponse {
  success: boolean;
  data: QueryLog[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasMore: boolean;
  };
}

async function fetchLogs(params: {
  page?: number;
  limit?: number;
  username?: string;
  database?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
}): Promise<LogsResponse> {
  const searchParams = new URLSearchParams();
  
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.username) searchParams.set('username', params.username);
  if (params.database) searchParams.set('database', params.database);
  if (params.status) searchParams.set('status', params.status);
  if (params.date_from) searchParams.set('date_from', params.date_from);
  if (params.date_to) searchParams.set('date_to', params.date_to);

  const response = await fetch(
    `${API_BASE_URL}/logs${searchParams.toString() ? `?${searchParams.toString()}` : ''}`
  );

  if (!response.ok) {
    throw new Error('Failed to fetch logs');
  }

  return response.json();
}

function AdminLogsPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    username: '',
    database: '',
    status: '',
    date_from: '',
    date_to: '',
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'logs', page, filters],
    queryFn: () =>
      fetchLogs({
        page,
        limit: 50,
        ...filters,
      }),
  });

  const handleExport = async (format: 'csv' | 'json') => {
    const searchParams = new URLSearchParams();
    searchParams.set('format', format);
    if (filters.date_from) searchParams.set('date_from', filters.date_from);
    if (filters.date_to) searchParams.set('date_to', filters.date_to);

    const response = await fetch(
      `${API_BASE_URL}/logs/export?${searchParams.toString()}`
    );

    if (!response.ok) {
      alert('Failed to export logs');
      return;
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `query-logs.${format}`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'blocked':
        return <Ban className="h-4 w-4 text-orange-600" />;
      default:
        return null;
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'error':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'blocked':
        return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Query Logs</h1>
          <p className="text-on-surface-variant">
            Audit trail of all SQL query executions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => handleExport('csv')}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={() => handleExport('json')}>
            <Download className="h-4 w-4 mr-2" />
            Export JSON
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <Input
                placeholder="Search username..."
                value={filters.username}
                onChange={(e) =>
                  setFilters({ ...filters, username: e.target.value })
                }
              />
            </div>
            <div>
              <select
                value={filters.database}
                onChange={(e) =>
                  setFilters({ ...filters, database: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-high text-sm"
              >
                <option value="">All Databases</option>
                <option value="sqlserver">SQL Server</option>
                <option value="redshift">Redshift</option>
              </select>
            </div>
            <div>
              <select
                value={filters.status}
                onChange={(e) =>
                  setFilters({ ...filters, status: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-high text-sm"
              >
                <option value="">All Status</option>
                <option value="success">Success</option>
                <option value="error">Error</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>
            <div>
              <Input
                type="date"
                placeholder="From date"
                value={filters.date_from}
                onChange={(e) =>
                  setFilters({ ...filters, date_from: e.target.value })
                }
              />
            </div>
            <div>
              <Input
                type="date"
                placeholder="To date"
                value={filters.date_to}
                onChange={(e) =>
                  setFilters({ ...filters, date_to: e.target.value })
                }
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() =>
                setFilters({
                  username: '',
                  database: '',
                  status: '',
                  date_from: '',
                  date_to: '',
                })
              }
            >
              Clear
            </Button>
            <Button onClick={() => refetch()}>
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="text-center text-red-600 py-8">
              Error loading logs: {(error as Error).message}
            </div>
          ) : data?.data.length === 0 ? (
            <div className="text-center text-on-surface-variant py-8">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No query logs found</p>
              <p className="text-sm">
                Logs will appear here once users execute queries
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-outline-variant bg-surface-container/50">
                    <th className="text-left py-3 px-4 font-medium">Time</th>
                    <th className="text-left py-3 px-4 font-medium">User</th>
                    <th className="text-left py-3 px-4 font-medium">Database</th>
                    <th className="text-left py-3 px-4 font-medium">Query</th>
                    <th className="text-left py-3 px-4 font-medium">Duration</th>
                    <th className="text-left py-3 px-4 font-medium">Rows</th>
                    <th className="text-left py-3 px-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.data.map((log) => (
                    <tr
                      key={log.id}
                      className="border-b border-outline-variant/50 hover:bg-surface-container/30"
                    >
                      <td className="py-3 px-4 whitespace-nowrap">
                        {formatMYDateTime(log.timestamp)}
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <div className="font-medium">{log.username}</div>
                          <div className="text-xs text-on-surface-variant">
                            {log.role}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            log.database === 'redshift'
                              ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          }`}
                        >
                          {log.database}
                        </span>
                      </td>
                      <td className="py-3 px-4 max-w-md">
                        <div
                          className="font-mono text-xs truncate"
                          title={log.query}
                        >
                          {log.query.slice(0, 100)}
                          {log.query.length > 100 && '...'}
                        </div>
                        {log.errorMessage && (
                          <div className="text-xs text-red-600 mt-1">
                            {log.errorMessage}
                          </div>
                        )}
                        {log.blockedReason && (
                          <div className="text-xs text-orange-600 mt-1">
                            {log.blockedReason}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {log.executionTimeMs}ms
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {log.rowCount}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${getStatusBadgeColor(log.status)}`}
                        >
                          {getStatusIcon(log.status)}
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {data?.pagination && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-on-surface-variant">
            Showing {(page - 1) * 50 + 1} to{' '}
            {Math.min(page * 50, data.pagination.totalCount)} of{' '}
            {data.pagination.totalCount} results
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <span className="text-sm">
              Page {page} of {data.pagination.totalPages}
            </span>
            <Button
              variant="outline"
              onClick={() => setPage((p) => p + 1)}
              disabled={!data.pagination.hasMore}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
