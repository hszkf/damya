/**
 * Users API Client
 * API functions for user management
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

// Types
export type UserRole = 'admin' | 'editor' | 'viewer';
export type Team = 'DIM' | 'CFO' | string;

export interface User {
  id: number;
  username: string;
  role: UserRole;
  team?: Team;
  display_name?: string;
  is_active: boolean;
  last_login?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateUserInput {
  username: string;
  password: string;
  role: UserRole;
  team?: Team;
  display_name?: string;
}

export interface UpdateUserInput {
  role?: UserRole;
  team?: Team | null;
  display_name?: string;
  is_active?: boolean;
}

export interface UserListFilters {
  role?: UserRole;
  team?: Team;
  is_active?: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

/**
 * List all users with optional filters
 */
export async function listUsers(filters?: UserListFilters): Promise<User[]> {
  const params = new URLSearchParams();

  if (filters?.role) params.set('role', filters.role);
  if (filters?.team) params.set('team', filters.team);
  if (filters?.is_active !== undefined) params.set('is_active', String(filters.is_active));

  const url = `${API_BASE_URL}/users${params.toString() ? `?${params.toString()}` : ''}`;
  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch users' }));
    throw new Error(error.message || 'Failed to fetch users');
  }

  const data: ApiResponse<User[]> = await response.json();

  if (!data.success || !data.data) {
    throw new Error('Invalid response from server');
  }

  return data.data;
}

/**
 * Get user by ID
 */
export async function getUserById(id: number): Promise<User> {
  const response = await fetch(`${API_BASE_URL}/users/${id}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch user' }));
    throw new Error(error.message || 'Failed to fetch user');
  }

  const data: ApiResponse<User> = await response.json();

  if (!data.success || !data.data) {
    throw new Error('Invalid response from server');
  }

  return data.data;
}

/**
 * Create a new user
 */
export async function createUser(input: CreateUserInput): Promise<User> {
  const response = await fetch(`${API_BASE_URL}/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to create user' }));
    throw new Error(error.message || 'Failed to create user');
  }

  const data: ApiResponse<User> = await response.json();

  if (!data.success || !data.data) {
    throw new Error('Invalid response from server');
  }

  return data.data;
}

/**
 * Update a user
 */
export async function updateUser(id: number, input: UpdateUserInput): Promise<User> {
  const response = await fetch(`${API_BASE_URL}/users/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to update user' }));
    throw new Error(error.message || 'Failed to update user');
  }

  const data: ApiResponse<User> = await response.json();

  if (!data.success || !data.data) {
    throw new Error('Invalid response from server');
  }

  return data.data;
}

/**
 * Delete a user
 */
export async function deleteUser(id: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/users/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to delete user' }));
    throw new Error(error.message || 'Failed to delete user');
  }
}

/**
 * Reset a user's password
 */
export async function resetUserPassword(id: number, newPassword: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/users/${id}/reset-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ newPassword }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to reset password' }));
    throw new Error(error.message || 'Failed to reset password');
  }
}

/**
 * Toggle user active status
 */
export async function toggleUserActive(id: number): Promise<User> {
  const response = await fetch(`${API_BASE_URL}/users/${id}/toggle-active`, {
    method: 'POST',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to toggle user status' }));
    throw new Error(error.message || 'Failed to toggle user status');
  }

  const data: ApiResponse<User> = await response.json();

  if (!data.success || !data.data) {
    throw new Error('Invalid response from server');
  }

  return data.data;
}
