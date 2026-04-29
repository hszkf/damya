/**
 * Admin Overview Page
 * Shows system statistics and quick actions
 */

import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Users, FileText, Database, Activity } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { listUsers } from '~/lib/users-api';

// @ts-expect-error - Route will be auto-generated when dev server runs
export const Route = createFileRoute('/admin/')({
  component: AdminOverview,
});

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  color = 'primary',
}: {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ElementType;
  color?: string;
}) {
  const colorClasses: Record<string, string> = {
    primary: 'bg-primary/10 text-primary',
    green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-on-surface-variant">
          {title}
        </CardTitle>
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-on-surface-variant mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

function AdminOverview() {
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => listUsers(),
  });

  const activeUsers = users?.filter(u => u.is_active).length || 0;
  const adminCount = users?.filter(u => u.role === 'admin').length || 0;
  const editorCount = users?.filter(u => u.role === 'editor').length || 0;
  const viewerCount = users?.filter(u => u.role === 'viewer').length || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Overview</h1>
        <p className="text-on-surface-variant">
          System statistics and quick actions
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Users"
          value={usersLoading ? '...' : users?.length || 0}
          description={`${activeUsers} active`}
          icon={Users}
          color="primary"
        />
        <StatCard
          title="Admins"
          value={usersLoading ? '...' : adminCount}
          description="Full access"
          icon={Users}
          color="orange"
        />
        <StatCard
          title="Editors"
          value={usersLoading ? '...' : editorCount}
          description="Limited write access"
          icon={Users}
          color="blue"
        />
        <StatCard
          title="Viewers"
          value={usersLoading ? '...' : viewerCount}
          description="Read-only access"
          icon={Users}
          color="green"
        />
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common administrative tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <a
              href="/admin/users"
              className="flex items-center gap-3 p-4 rounded-lg border border-outline-variant hover:bg-surface-container-high transition-colors"
            >
              <Users className="h-5 w-5 text-primary" />
              <div>
                <div className="font-medium">Manage Users</div>
                <div className="text-sm text-on-surface-variant">
                  Create, edit, or disable users
                </div>
              </div>
            </a>
            <a
              href="/admin/logs"
              className="flex items-center gap-3 p-4 rounded-lg border border-outline-variant hover:bg-surface-container-high transition-colors"
            >
              <FileText className="h-5 w-5 text-primary" />
              <div>
                <div className="font-medium">View Query Logs</div>
                <div className="text-sm text-on-surface-variant">
                  Audit query executions
                </div>
              </div>
            </a>
            <a
              href="/storage"
              className="flex items-center gap-3 p-4 rounded-lg border border-outline-variant hover:bg-surface-container-high transition-colors"
            >
              <Database className="h-5 w-5 text-primary" />
              <div>
                <div className="font-medium">S3 Storage</div>
                <div className="text-sm text-on-surface-variant">
                  Manage files and folders
                </div>
              </div>
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Role Permissions Reference */}
      <Card>
        <CardHeader>
          <CardTitle>Role Permissions</CardTitle>
          <CardDescription>What each role can do in the system</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-outline-variant">
                  <th className="text-left py-2 px-3 font-medium">Permission</th>
                  <th className="text-center py-2 px-3 font-medium">Admin</th>
                  <th className="text-center py-2 px-3 font-medium">Editor</th>
                  <th className="text-center py-2 px-3 font-medium">Viewer</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { name: 'Execute SELECT', admin: true, editor: true, viewer: true },
                  { name: 'Execute INSERT', admin: true, editor: true, viewer: false },
                  { name: 'Execute UPDATE/DELETE', admin: true, editor: false, viewer: false },
                  { name: 'Execute DDL (DROP, ALTER)', admin: true, editor: false, viewer: false },
                  { name: 'Create/Edit Jobs', admin: true, editor: true, viewer: false },
                  { name: 'Delete Jobs', admin: true, editor: false, viewer: false },
                  { name: 'Upload Files', admin: true, editor: true, viewer: false },
                  { name: 'Delete Files', admin: true, editor: false, viewer: false },
                  { name: 'Manage Users', admin: true, editor: false, viewer: false },
                  { name: 'View Query Logs', admin: true, editor: false, viewer: false },
                ].map((perm) => (
                  <tr key={perm.name} className="border-b border-outline-variant/50">
                    <td className="py-2 px-3">{perm.name}</td>
                    <td className="text-center py-2 px-3">
                      {perm.admin ? (
                        <span className="text-green-600">Yes</span>
                      ) : (
                        <span className="text-red-600">No</span>
                      )}
                    </td>
                    <td className="text-center py-2 px-3">
                      {perm.editor ? (
                        <span className="text-green-600">Yes</span>
                      ) : (
                        <span className="text-red-600">No</span>
                      )}
                    </td>
                    <td className="text-center py-2 px-3">
                      {perm.viewer ? (
                        <span className="text-green-600">Yes</span>
                      ) : (
                        <span className="text-red-600">No</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
