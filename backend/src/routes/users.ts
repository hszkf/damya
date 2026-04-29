/**
 * Users Routes
 * User management CRUD operations
 */

import { Hono } from 'hono';
import { userService } from '../services/user-service';
import { ValidationError, NotFoundError } from '../utils/errors';
import type { UserRole, Team } from '../models/user';
import { isValidRole, isValidTeam } from '../models/user';
import { logger } from '../utils/logger';

export const usersRoutes = new Hono();

/**
 * GET /users
 * List all users with optional filters
 */
usersRoutes.get('/', async (c) => {
  const role = c.req.query('role') as UserRole | undefined;
  const team = c.req.query('team') as Team | undefined;
  const isActiveStr = c.req.query('is_active');

  // Validate filters
  if (role && !isValidRole(role)) {
    throw new ValidationError('Invalid role filter');
  }

  if (team && !isValidTeam(team)) {
    throw new ValidationError('Invalid team filter');
  }

  const isActive = isActiveStr === undefined ? undefined : isActiveStr === 'true';

  const users = await userService.listUsers({ role, team, isActive });

  return c.json({
    success: true,
    data: users,
    count: users.length,
  });
});

/**
 * GET /users/:id
 * Get user by ID
 */
usersRoutes.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));

  if (isNaN(id)) {
    throw new ValidationError('Invalid user ID');
  }

  const user = await userService.getUserById(id);

  if (!user) {
    throw new NotFoundError('User');
  }

  return c.json({
    success: true,
    data: user,
  });
});

/**
 * POST /users
 * Create new user
 */
usersRoutes.post('/', async (c) => {
  const body = await c.req.json();
  const { username, password, role, team, display_name } = body;

  // Validate required fields
  if (!username || typeof username !== 'string') {
    throw new ValidationError('Username is required');
  }

  if (!password || typeof password !== 'string') {
    throw new ValidationError('Password is required');
  }

  if (!role || !isValidRole(role)) {
    throw new ValidationError('Valid role is required (admin, editor, or viewer)');
  }

  if (team && !isValidTeam(team)) {
    throw new ValidationError('Invalid team');
  }

  const user = await userService.createUser({
    username: username.trim(),
    password,
    role,
    team,
    display_name: display_name?.trim(),
  });

  logger.info('User created', {
    metadata: { createdUserId: user.id, createdUsername: user.username },
  });

  return c.json({
    success: true,
    data: user,
  }, 201);
});

/**
 * PUT /users/:id
 * Update user
 */
usersRoutes.put('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));

  if (isNaN(id)) {
    throw new ValidationError('Invalid user ID');
  }

  const body = await c.req.json();
  const { role, team, display_name, is_active } = body;

  // Validate optional fields
  if (role !== undefined && !isValidRole(role)) {
    throw new ValidationError('Invalid role');
  }

  if (team !== undefined && team !== null && !isValidTeam(team)) {
    throw new ValidationError('Invalid team');
  }

  const user = await userService.updateUser(id, {
    role,
    team,
    display_name: display_name?.trim(),
    is_active,
  });

  logger.info('User updated', {
    metadata: { updatedUserId: id, changes: body },
  });

  return c.json({
    success: true,
    data: user,
  });
});

/**
 * DELETE /users/:id
 * Delete user
 */
usersRoutes.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));

  if (isNaN(id)) {
    throw new ValidationError('Invalid user ID');
  }

  await userService.deleteUser(id);

  logger.info('User deleted', {
    metadata: { deletedUserId: id },
  });

  return c.json({
    success: true,
    message: 'User deleted successfully',
  });
});

/**
 * POST /users/:id/reset-password
 * Reset user password
 */
usersRoutes.post('/:id/reset-password', async (c) => {
  const id = parseInt(c.req.param('id'));

  if (isNaN(id)) {
    throw new ValidationError('Invalid user ID');
  }

  const body = await c.req.json();
  const { newPassword } = body;

  if (!newPassword || typeof newPassword !== 'string') {
    throw new ValidationError('New password is required');
  }

  await userService.resetPassword(id, newPassword);

  logger.info('Password reset', {
    metadata: { resetUserId: id },
  });

  return c.json({
    success: true,
    message: 'Password reset successfully',
  });
});

/**
 * POST /users/:id/toggle-active
 * Toggle user active status
 */
usersRoutes.post('/:id/toggle-active', async (c) => {
  const id = parseInt(c.req.param('id'));

  if (isNaN(id)) {
    throw new ValidationError('Invalid user ID');
  }

  // Get current status
  const user = await userService.getUserById(id);
  if (!user) {
    throw new NotFoundError('User');
  }

  // Toggle status
  const updatedUser = await userService.updateUser(id, {
    is_active: !user.is_active,
  });

  logger.info('User status toggled', {
    metadata: { toggledUserId: id, newStatus: updatedUser.is_active },
  });

  return c.json({
    success: true,
    data: updatedUser,
  });
});
