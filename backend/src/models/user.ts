/**
 * User Model
 * Defines user types, roles, and permissions
 */

export type UserRole = 'admin' | 'editor' | 'viewer';

export type Team = 'data-science' | 'business-intelligence';

export interface User {
  id: number;
  username: string;
  password_hash: string;
  role: UserRole;
  team: Team | null;
  display_name: string | null;
  created_at: Date;
  updated_at: Date;
  last_login: Date | null;
  is_active: boolean;
}

export interface UserPublic {
  id: number;
  username: string;
  role: UserRole;
  team: Team | null;
  display_name: string | null;
  created_at: Date;
  last_login: Date | null;
  is_active: boolean;
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
  team?: Team;
  display_name?: string;
  is_active?: boolean;
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface AuthTokenPayload {
  userId: number;
  username: string;
  role: UserRole;
  team: Team | null;
}

export interface AuthToken {
  token: string;
  expiresAt: Date;
  user: UserPublic;
}

/**
 * Permission definitions by role
 */
export const ROLE_PERMISSIONS = {
  admin: {
    // SQL
    canExecuteSelect: true,
    canExecuteInsert: true,
    canExecuteUpdate: true,
    canExecuteDelete: true,
    canExecuteDDL: true, // DROP, ALTER, TRUNCATE, CREATE
    // Jobs
    canViewJobs: true,
    canCreateJobs: true,
    canEditJobs: true,
    canDeleteJobs: true,
    canRunJobs: true,
    // Storage
    canViewFiles: true,
    canUploadFiles: true,
    canDeleteFiles: true,
    canMoveFiles: true,
    canCreateFolders: true,
    // Admin
    canManageUsers: true,
    canViewLogs: true,
  },
  editor: {
    // SQL
    canExecuteSelect: true,
    canExecuteInsert: true,
    canExecuteUpdate: false,
    canExecuteDelete: false,
    canExecuteDDL: false,
    // Jobs
    canViewJobs: true,
    canCreateJobs: true,
    canEditJobs: true,
    canDeleteJobs: false,
    canRunJobs: true,
    // Storage
    canViewFiles: true,
    canUploadFiles: true,
    canDeleteFiles: false,
    canMoveFiles: true,
    canCreateFolders: true,
    // Admin
    canManageUsers: false,
    canViewLogs: false,
  },
  viewer: {
    // SQL
    canExecuteSelect: true,
    canExecuteInsert: false,
    canExecuteUpdate: false,
    canExecuteDelete: false,
    canExecuteDDL: false,
    // Jobs
    canViewJobs: true,
    canCreateJobs: false,
    canEditJobs: false,
    canDeleteJobs: false,
    canRunJobs: false,
    // Storage
    canViewFiles: true,
    canUploadFiles: false,
    canDeleteFiles: false,
    canMoveFiles: false,
    canCreateFolders: false,
    // Admin
    canManageUsers: false,
    canViewLogs: false,
  },
} as const;

export type Permission = keyof typeof ROLE_PERMISSIONS.admin;

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role][permission];
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: UserRole): Record<Permission, boolean> {
  return ROLE_PERMISSIONS[role];
}

/**
 * Convert User to UserPublic (remove sensitive fields)
 */
export function toPublicUser(user: User): UserPublic {
  const { password_hash, updated_at, ...publicFields } = user;
  return publicFields;
}

/**
 * Valid roles for validation
 */
export const VALID_ROLES: UserRole[] = ['admin', 'editor', 'viewer'];

/**
 * Valid teams for validation
 */
export const VALID_TEAMS: Team[] = ['data-science', 'business-intelligence'];

/**
 * Check if string is valid role
 */
export function isValidRole(role: string): role is UserRole {
  return VALID_ROLES.includes(role as UserRole);
}

/**
 * Check if string is valid team
 */
export function isValidTeam(team: string): team is Team {
  return VALID_TEAMS.includes(team as Team);
}
