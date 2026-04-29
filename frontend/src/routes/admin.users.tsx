/**
 * Admin Users Page
 * Manage users - create, edit, delete, reset passwords
 */

import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  KeyRound,
  UserCheck,
  UserX,
  Loader2,
} from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { formatMYDateTime } from '~/lib/date-utils';
import {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  resetUserPassword,
  toggleUserActive,
} from '~/lib/users-api';
import type { User, UserRole, Team, CreateUserInput, UpdateUserInput } from '~/lib/users-api';

// @ts-expect-error - Route will be auto-generated when dev server runs
export const Route = createFileRoute('/admin/users')({
  component: AdminUsersPage,
});

function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);

  const { data: users, isLoading, error } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => listUsers(),
  });

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setShowCreateModal(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateUserInput }) =>
      updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setEditingUser(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) =>
      resetUserPassword(id, password),
    onSuccess: () => {
      setResetPasswordUser(null);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: toggleUserActive,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'editor':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'viewer':
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-600 py-8">
        Error loading users: {(error as Error).message}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-on-surface-variant">
            Create, edit, and manage user accounts
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-outline-variant bg-surface-container/50">
                  <th className="text-left py-3 px-4 font-medium">User</th>
                  <th className="text-left py-3 px-4 font-medium">Role</th>
                  <th className="text-left py-3 px-4 font-medium">Team</th>
                  <th className="text-left py-3 px-4 font-medium">Status</th>
                  <th className="text-left py-3 px-4 font-medium">Last Login</th>
                  <th className="text-right py-3 px-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users?.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-outline-variant/50 hover:bg-surface-container/30"
                  >
                    <td className="py-3 px-4">
                      <div>
                        <div className="font-medium">
                          {user.display_name || user.username}
                        </div>
                        <div className="text-sm text-on-surface-variant">
                          @{user.username}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {user.team || '-'}
                    </td>
                    <td className="py-3 px-4">
                      {user.is_active ? (
                        <span className="flex items-center gap-1 text-green-600 text-sm">
                          <UserCheck className="h-4 w-4" />
                          Active
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-600 text-sm">
                          <UserX className="h-4 w-4" />
                          Disabled
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-on-surface-variant">
                      {user.last_login
                        ? formatMYDateTime(user.last_login)
                        : 'Never'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="icon"
                          size="icon"
                          onClick={() => setEditingUser(user)}
                          title="Edit user"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="icon"
                          size="icon"
                          onClick={() => setResetPasswordUser(user)}
                          title="Reset password"
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="icon"
                          size="icon"
                          onClick={() => toggleActiveMutation.mutate(user.id)}
                          title={user.is_active ? 'Disable user' : 'Enable user'}
                          disabled={toggleActiveMutation.isPending}
                        >
                          {user.is_active ? (
                            <UserX className="h-4 w-4" />
                          ) : (
                            <UserCheck className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="icon"
                          size="icon"
                          onClick={() => {
                            if (
                              confirm(
                                `Are you sure you want to delete ${user.username}?`
                              )
                            ) {
                              deleteMutation.mutate(user.id);
                            }
                          }}
                          title="Delete user"
                          disabled={deleteMutation.isPending}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Create User Modal */}
      {showCreateModal && (
        <UserFormModal
          title="Create User"
          onClose={() => setShowCreateModal(false)}
          onSubmit={(data) => createMutation.mutate(data as CreateUserInput)}
          isLoading={createMutation.isPending}
          error={createMutation.error?.message}
          isCreate
        />
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <UserFormModal
          title="Edit User"
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSubmit={(data) =>
            updateMutation.mutate({ id: editingUser.id, data })
          }
          isLoading={updateMutation.isPending}
          error={updateMutation.error?.message}
        />
      )}

      {/* Reset Password Modal */}
      {resetPasswordUser && (
        <ResetPasswordModal
          user={resetPasswordUser}
          onClose={() => setResetPasswordUser(null)}
          onSubmit={(password) =>
            resetPasswordMutation.mutate({
              id: resetPasswordUser.id,
              password,
            })
          }
          isLoading={resetPasswordMutation.isPending}
          error={resetPasswordMutation.error?.message}
        />
      )}
    </div>
  );
}

// User Form Modal Component
function UserFormModal({
  title,
  user,
  onClose,
  onSubmit,
  isLoading,
  error,
  isCreate = false,
}: {
  title: string;
  user?: User;
  onClose: () => void;
  onSubmit: (data: CreateUserInput | UpdateUserInput) => void;
  isLoading: boolean;
  error?: string;
  isCreate?: boolean;
}) {
  const [formData, setFormData] = useState({
    username: user?.username || '',
    password: '',
    display_name: user?.display_name || '',
    role: user?.role || 'viewer',
    team: user?.team || '',
    is_active: user?.is_active ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreate) {
      onSubmit({
        username: formData.username,
        password: formData.password,
        role: formData.role as UserRole,
        team: formData.team as Team || undefined,
        display_name: formData.display_name || undefined,
      });
    } else {
      onSubmit({
        role: formData.role as UserRole,
        team: formData.team as Team || null,
        display_name: formData.display_name || undefined,
        is_active: formData.is_active,
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface-container rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="p-6 border-b border-outline-variant">
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {isCreate && (
            <>
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  required
                />
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label htmlFor="display_name">Display Name</Label>
            <Input
              id="display_name"
              value={formData.display_name}
              onChange={(e) =>
                setFormData({ ...formData, display_name: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <select
              id="role"
              value={formData.role}
              onChange={(e) =>
                setFormData({ ...formData, role: e.target.value as UserRole })
              }
              className="w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-high"
            >
              <option value="admin">Admin</option>
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="team">Team</Label>
            <select
              id="team"
              value={formData.team}
              onChange={(e) =>
                setFormData({ ...formData, team: e.target.value })
              }
              className="w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-high"
            >
              <option value="">No Team</option>
              <option value="data-science">Data Science</option>
              <option value="business-intelligence">Business Intelligence</option>
            </select>
          </div>
          {!isCreate && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) =>
                  setFormData({ ...formData, is_active: e.target.checked })
                }
                className="rounded"
              />
              <Label htmlFor="is_active">Active</Label>
            </div>
          )}

          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-md">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isCreate ? 'Create' : 'Save'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Reset Password Modal Component
function ResetPasswordModal({
  user,
  onClose,
  onSubmit,
  isLoading,
  error,
}: {
  user: User;
  onClose: () => void;
  onSubmit: (password: string) => void;
  isLoading: boolean;
  error?: string;
}) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setValidationError('Passwords do not match');
      return;
    }
    if (!password) {
      setValidationError('Password is required');
      return;
    }
    setValidationError('');
    onSubmit(password);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface-container rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="p-6 border-b border-outline-variant">
          <h2 className="text-lg font-semibold">Reset Password</h2>
          <p className="text-sm text-on-surface-variant">
            Reset password for {user.display_name || user.username}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new_password">New Password</Label>
            <Input
              id="new_password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm_password">Confirm Password</Label>
            <Input
              id="confirm_password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          {(error || validationError) && (
            <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-md">
              {error || validationError}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Reset Password
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
