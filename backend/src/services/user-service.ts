/**
 * User Service
 * User management CRUD operations (without authentication)
 */

import type { UserRole, Team } from '../models/user';
import { isValidRole, isValidTeam } from '../models/user';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors';

// In-memory user storage (replace with database in production)
interface User {
  id: number;
  username: string;
  password_hash: string;
  role: UserRole;
  team?: Team;
  display_name?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

// Default users
const defaultUsers: User[] = [
  {
    id: 1,
    username: 'hasif',
    password_hash: '$2b$10$hashedpassword1', // Placeholder
    role: 'admin',
    team: 'DIM',
    display_name: 'Hasif',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: 2,
    username: 'nazierul',
    password_hash: '$2b$10$hashedpassword2',
    role: 'editor',
    team: 'DIM',
    display_name: 'Nazierul',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: 3,
    username: 'ernie',
    password_hash: '$2b$10$hashedpassword3',
    role: 'viewer',
    team: 'CFO',
    display_name: 'Ernie',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: 4,
    username: 'siti',
    password_hash: '$2b$10$hashedpassword4',
    role: 'editor',
    team: 'CFO',
    display_name: 'Siti',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: 5,
    username: 'ahmad',
    password_hash: '$2b$10$hashedpassword5',
    role: 'viewer',
    team: 'DIM',
    display_name: 'Ahmad',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  },
];

let users: User[] = [...defaultUsers];
let nextId = 6;

// Public user type (without password hash)
export type PublicUser = Omit<User, 'password_hash'>;

function toPublicUser(user: User): PublicUser {
  const { password_hash, ...publicUser } = user;
  return publicUser;
}

class UserService {
  /**
   * List all users with optional filters
   */
  async listUsers(filters?: {
    role?: UserRole;
    team?: Team;
    isActive?: boolean;
  }): Promise<PublicUser[]> {
    let filtered = users;

    if (filters?.role) {
      filtered = filtered.filter(u => u.role === filters.role);
    }
    if (filters?.team) {
      filtered = filtered.filter(u => u.team === filters.team);
    }
    if (filters?.isActive !== undefined) {
      filtered = filtered.filter(u => u.is_active === filters.isActive);
    }

    return filtered.map(toPublicUser);
  }

  /**
   * Get user by ID
   */
  async getUserById(id: number): Promise<PublicUser | null> {
    const user = users.find(u => u.id === id);
    return user ? toPublicUser(user) : null;
  }

  /**
   * Get user by username
   */
  async getUserByUsername(username: string): Promise<PublicUser | null> {
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    return user ? toPublicUser(user) : null;
  }

  /**
   * Create new user
   */
  async createUser(data: {
    username: string;
    password: string;
    role: UserRole;
    team?: Team;
    display_name?: string;
  }): Promise<PublicUser> {
    // Check if username already exists
    const existing = users.find(
      u => u.username.toLowerCase() === data.username.toLowerCase()
    );
    if (existing) {
      throw new ConflictError('Username already exists');
    }

    // Validate role and team
    if (!isValidRole(data.role)) {
      throw new ValidationError('Invalid role');
    }
    if (data.team && !isValidTeam(data.team)) {
      throw new ValidationError('Invalid team');
    }

    const newUser: User = {
      id: nextId++,
      username: data.username.toLowerCase(),
      password_hash: `$2b$10$placeholder_${Date.now()}`, // Placeholder hash
      role: data.role,
      team: data.team,
      display_name: data.display_name,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    };

    users.push(newUser);
    return toPublicUser(newUser);
  }

  /**
   * Update user
   */
  async updateUser(
    id: number,
    data: {
      role?: UserRole;
      team?: Team | null;
      display_name?: string;
      is_active?: boolean;
    }
  ): Promise<PublicUser> {
    const userIndex = users.findIndex(u => u.id === id);
    if (userIndex === -1) {
      throw new NotFoundError('User');
    }

    const user = users[userIndex];

    if (data.role !== undefined) {
      if (!isValidRole(data.role)) {
        throw new ValidationError('Invalid role');
      }
      user.role = data.role;
    }

    if (data.team !== undefined) {
      if (data.team !== null && !isValidTeam(data.team)) {
        throw new ValidationError('Invalid team');
      }
      user.team = data.team || undefined;
    }

    if (data.display_name !== undefined) {
      user.display_name = data.display_name;
    }

    if (data.is_active !== undefined) {
      user.is_active = data.is_active;
    }

    user.updated_at = new Date();
    return toPublicUser(user);
  }

  /**
   * Delete user
   */
  async deleteUser(id: number): Promise<void> {
    const userIndex = users.findIndex(u => u.id === id);
    if (userIndex === -1) {
      throw new NotFoundError('User');
    }

    users.splice(userIndex, 1);
  }

  /**
   * Reset password (placeholder)
   */
  async resetPassword(id: number, newPassword: string): Promise<void> {
    const user = users.find(u => u.id === id);
    if (!user) {
      throw new NotFoundError('User');
    }

    user.password_hash = `$2b$10$placeholder_${Date.now()}`;
    user.updated_at = new Date();
  }
}

export const userService = new UserService();
