/**
 * SQL Server Agent Job Routes - /job endpoints
 *
 * Provides REST API for SQL Server Agent job management:
 * - GET /job - List all SQL Server Agent jobs with pagination
 * - GET /job/:name - Get a specific job with steps and schedules
 * - POST /job - Create (submit) a new job
 * - PUT /job/:name - Update (edit) a job
 * - POST /job/:name/start - Start a job
 * - POST /job/:name/stop - Stop a job
 * - GET /job/:name/history - Get job execution history
 * - DELETE /job/:name - Delete a job and its execution history
 */

import { Hono } from 'hono';
import { z } from 'zod';
import {
  listAgentJobs,
  getAgentJob,
  createAgentJob,
  updateAgentJob,
  startAgentJob,
  stopAgentJob,
  getAgentJobHistory,
  getAllAgentJobHistory,
  getJobOwners,
  deleteAgentJob,
  sendTestEmail,
  checkDatabaseMailConfig,
} from '../services/sqlserver-agent-service';

export const jobRoutes = new Hono();

// Validation schemas
const emailNotificationSchema = z.object({
  enabled: z.boolean(),
  from_email: z.string().optional(),  // Default: BI-Alert@alrajhibank.com.my
  to_email: z.string(),               // Multiple recipients separated by semicolon
  cc_email: z.string().optional(),    // CC recipients separated by semicolon
  bcc_email: z.string().optional(),   // BCC recipients separated by semicolon
  subject: z.string().optional(),
  body: z.string().optional(),
  attach_results: z.boolean().optional().default(true),
  attachment_filename: z.string().optional(),
});

const createJobSchema = z.object({
  job_name: z.string().min(1, 'Job name is required'),
  description: z.string().optional().default(''),
  step_command: z.string().optional().default(''),
  step_name: z.string().optional(),
  database_name: z.string().optional(),
  enabled: z.boolean().optional().default(true),
  category: z.string().optional().default('[Uncategorized (Local)]'),
  schedule_cron: z.string().optional(), // Cron expression for scheduling
  email_notification: emailNotificationSchema.optional(),
});

const updateJobSchema = z.object({
  new_name: z.string().optional(),
  description: z.string().optional(),
  enabled: z.boolean().optional(),
  step_command: z.string().optional(),
  step_name: z.string().optional(),
  database_name: z.string().optional(),
});

const testEmailSchema = z.object({
  from_email: z.string().email('Invalid from email'),
  to_email: z.string().min(1, 'To email is required'),
  cc_email: z.string().optional(),
  bcc_email: z.string().optional(),
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body is required'),
  query: z.string().optional(),
  attach_results: z.boolean().optional().default(false),
  attachment_filename: z.string().optional().default('QueryResults.csv'),
  profile_name: z.string().optional(),  // Optional: specify Database Mail profile explicitly
});

/**
 * GET /job/owners - Get unique job owners
 */
jobRoutes.get('/owners', async (c) => {
  try {
    const owners = await getJobOwners();
    return c.json({
      success: true,
      owners,
    });
  } catch (error: any) {
    console.error('Error getting job owners:', error);
    return c.json(
      {
        success: false,
        error: error.message || 'Failed to get job owners',
      },
      500
    );
  }
});

/**
 * GET /job/history - Get all job execution history
 * Query params:
 *   - page: Page number (default 1)
 *   - limit: Records per page (default 50)
 *   - job_name: Filter by job name (partial match)
 *   - status: Filter by status (Succeeded, Failed, etc.)
 *   - date_from: Filter by start date (YYYY-MM-DD)
 *   - date_to: Filter by end date (YYYY-MM-DD)
 *   - owner: Filter by owner (partial match)
 *   - sort_by: Sort by field (run_date, duration)
 *   - sort_dir: Sort direction (asc, desc)
 */
jobRoutes.get('/history', async (c) => {
  try {
    const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '50', 10)));

    const sortBy = c.req.query('sort_by');
    const sortDir = c.req.query('sort_dir');

    const filters = {
      job_name: c.req.query('job_name') || undefined,
      status: c.req.query('status') || undefined,
      date_from: c.req.query('date_from') || undefined,
      date_to: c.req.query('date_to') || undefined,
      owner: c.req.query('owner') || undefined,
      sort_by: (sortBy === 'run_date' || sortBy === 'duration') ? sortBy : undefined,
      sort_dir: (sortDir === 'asc' || sortDir === 'desc') ? sortDir : undefined,
    };

    const result = await getAllAgentJobHistory(page, limit, filters);

    return c.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error('Error getting all job history:', error);
    return c.json(
      {
        success: false,
        error: error.message || 'Failed to get job execution history',
      },
      500
    );
  }
});

/**
 * GET /job - List all SQL Server Agent jobs
 * Query params:
 *   - page: Page number (default 1)
 *   - limit: Jobs per page (default: all jobs, no limit)
 */
jobRoutes.get('/', async (c) => {
  try {
    const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
    const limitParam = c.req.query('limit');
    const limit = limitParam ? Math.max(1, parseInt(limitParam, 10)) : 10000; // Default to all jobs

    const result = await listAgentJobs(page, limit);

    return c.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error('Error listing agent jobs:', error);
    return c.json(
      {
        success: false,
        error: error.message || 'Failed to list SQL Server Agent jobs',
      },
      500
    );
  }
});

/**
 * GET /job/:name - Get a specific job by name
 */
jobRoutes.get('/:name', async (c) => {
  try {
    const jobName = decodeURIComponent(c.req.param('name'));
    const job = await getAgentJob(jobName);

    if (!job) {
      return c.json(
        {
          success: false,
          error: `Job '${jobName}' not found`,
        },
        404
      );
    }

    return c.json({
      success: true,
      job,
    });
  } catch (error: any) {
    console.error('Error getting agent job:', error);
    return c.json(
      {
        success: false,
        error: error.message || 'Failed to get job',
      },
      500
    );
  }
});

/**
 * POST /job - Create (submit) a new job
 * Body: { job_name, description?, step_command?, step_name?, database_name?, enabled?, category? }
 */
jobRoutes.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = createJobSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        {
          success: false,
          error: 'Validation failed',
          details: parsed.error.issues,
        },
        400
      );
    }

    const job = await createAgentJob(parsed.data);

    return c.json(
      {
        success: true,
        message: `Job '${parsed.data.job_name}' created successfully`,
        job,
      },
      201
    );
  } catch (error: any) {
    console.error('Error creating agent job:', error);
    const statusCode = error.message?.includes('already exists') ? 409 : 500;
    return c.json(
      {
        success: false,
        error: error.message || 'Failed to create job',
      },
      statusCode
    );
  }
});

/**
 * PUT /job/:name - Update (edit) an existing job
 * Body: { new_name?, description?, enabled?, step_command?, step_name?, database_name? }
 */
jobRoutes.put('/:name', async (c) => {
  try {
    const jobName = decodeURIComponent(c.req.param('name'));
    const body = await c.req.json();
    const parsed = updateJobSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        {
          success: false,
          error: 'Validation failed',
          details: parsed.error.issues,
        },
        400
      );
    }

    // Check if any fields to update
    if (Object.keys(parsed.data).length === 0) {
      return c.json(
        {
          success: false,
          error: 'No fields to update',
        },
        400
      );
    }

    const job = await updateAgentJob(jobName, parsed.data);

    return c.json({
      success: true,
      message: `Job '${jobName}' updated successfully`,
      job,
    });
  } catch (error: any) {
    console.error('Error updating agent job:', error);
    const statusCode = error.message?.includes('not found') ? 404 : 500;
    return c.json(
      {
        success: false,
        error: error.message || 'Failed to update job',
      },
      statusCode
    );
  }
});

/**
 * POST /job/:name/start - Start a job
 */
jobRoutes.post('/:name/start', async (c) => {
  try {
    const jobName = decodeURIComponent(c.req.param('name'));
    const result = await startAgentJob(jobName);

    return c.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error('Error starting agent job:', error);
    const statusCode = error.message?.includes('not found') ? 404 : 500;
    return c.json(
      {
        success: false,
        error: error.message || 'Failed to start job',
      },
      statusCode
    );
  }
});

/**
 * POST /job/:name/stop - Stop a running job
 */
jobRoutes.post('/:name/stop', async (c) => {
  try {
    const jobName = decodeURIComponent(c.req.param('name'));
    const result = await stopAgentJob(jobName);

    return c.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error('Error stopping agent job:', error);
    const statusCode = error.message?.includes('not found') ? 404 : 500;
    return c.json(
      {
        success: false,
        error: error.message || 'Failed to stop job',
      },
      statusCode
    );
  }
});

/**
 * GET /job/:name/history - Get job execution history
 * Query params: limit (default 10)
 */
jobRoutes.get('/:name/history', async (c) => {
  try {
    const jobName = decodeURIComponent(c.req.param('name'));
    const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '10', 10)));

    // First check if job exists
    const job = await getAgentJob(jobName);
    if (!job) {
      return c.json(
        {
          success: false,
          error: `Job '${jobName}' not found`,
        },
        404
      );
    }

    const history = await getAgentJobHistory(jobName, limit);

    return c.json({
      success: true,
      job_name: jobName,
      count: history.length,
      history,
    });
  } catch (error: any) {
    console.error('Error getting agent job history:', error);
    return c.json(
      {
        success: false,
        error: error.message || 'Failed to get job history',
      },
      500
    );
  }
});

/**
 * DELETE /job/:name - Delete a job and its execution history
 */
jobRoutes.delete('/:name', async (c) => {
  try {
    const jobName = decodeURIComponent(c.req.param('name'));
    const result = await deleteAgentJob(jobName);

    return c.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error('Error deleting agent job:', error);
    const statusCode = error.message?.includes('not found') ? 404 : 500;
    return c.json(
      {
        success: false,
        error: error.message || 'Failed to delete job',
      },
      statusCode
    );
  }
});

/**
 * GET /job/mail-config - Check Database Mail configuration
 * Returns available profiles and accounts
 */
jobRoutes.get('/mail-config', async (c) => {
  try {
    const config = await checkDatabaseMailConfig();

    return c.json({
      success: true,
      ...config,
    });
  } catch (error: any) {
    console.error('Error checking Database Mail config:', error);
    return c.json(
      {
        success: false,
        error: error.message || 'Failed to check Database Mail configuration',
      },
      500
    );
  }
});

/**
 * POST /job/send-test-email - Send a test email using SQL Server Database Mail
 */
jobRoutes.post('/send-test-email', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = testEmailSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        {
          success: false,
          error: 'Validation failed',
          details: parsed.error.issues,
        },
        400
      );
    }

    const result = await sendTestEmail(parsed.data);

    return c.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error('Error sending test email:', error);
    return c.json(
      {
        success: false,
        error: error.message || 'Failed to send test email',
      },
      500
    );
  }
});
