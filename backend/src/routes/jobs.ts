import { Hono } from 'hono';
import { jobService } from '../services/job-service';
import { jobExecutor } from '../services/job-executor';
import { schedulerService } from '../services/scheduler-service';
import {
  CreateJobRequestSchema,
  UpdateJobRequestSchema,
  ScheduleJobRequestSchema,
  CronValidationRequestSchema,
} from '../models/job';

export const jobsRoutes = new Hono();

// ============================================
// Static routes must come BEFORE parameterized routes
// ============================================

// Get scheduler status
jobsRoutes.get('/scheduler/status', async (c) => {
  try {
    const status = schedulerService.getStatus();
    return c.json({
      success: true,
      data: status,
    });
  } catch (error: any) {
    return c.json(
      {
        success: false,
        error: error.message || 'Failed to get scheduler status',
      },
      500
    );
  }
});

// Preview schedule (get next run times)
jobsRoutes.post('/scheduler/preview', async (c) => {
  try {
    const scheduleType = c.req.query('schedule_type');
    const cronExpression = c.req.query('cron_expression');
    
    if (scheduleType === 'cron' && cronExpression) {
      const result = schedulerService.validateCron(cronExpression);
      if (!result.valid) {
        return c.json({
          success: false,
          error: result.error || 'Invalid cron expression',
        }, 400);
      }
      
      return c.json({
        success: true,
        data: {
          schedule_type: 'cron',
          cron_expression: cronExpression,
          description: result.description || `Cron: ${cronExpression}`,
          next_runs: result.nextRuns || [],
        },
      });
    }
    
    return c.json({
      success: false,
      error: 'Invalid schedule configuration',
    }, 400);
  } catch (error: any) {
    return c.json(
      {
        success: false,
        error: error.message || 'Failed to preview schedule',
      },
      500
    );
  }
});

// Validate cron expression
jobsRoutes.post('/validate/cron', async (c) => {
  try {
    const body = await c.req.json();
    const { expression } = CronValidationRequestSchema.parse(body);

    const result = schedulerService.validateCron(expression);

    return c.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    return c.json(
      {
        success: false,
        error: error.message || 'Failed to validate cron',
      },
      400
    );
  }
});

// List available functions (registry)
jobsRoutes.get('/registry/list', async (c) => {
  // Placeholder for function registry
  const functions = [
    {
      name: 'export_to_s3',
      description: 'Export query results to S3',
      parameters: ['query', 'bucket', 'key'],
    },
    {
      name: 'send_email_report',
      description: 'Send email with query results',
      parameters: ['query', 'recipients', 'subject'],
    },
    {
      name: 'sync_tables',
      description: 'Sync data between databases',
      parameters: ['source_query', 'target_table'],
    },
  ];

  return c.json({
    success: true,
    data: functions,
  });
});

// ============================================
// Parameterized routes
// ============================================

// List all jobs
jobsRoutes.get('/', async (c) => {
  try {
    const author = c.req.query('author');
    const job_type = c.req.query('job_type');
    const is_active = c.req.query('is_active');
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');

    const filters = {
      author,
      job_type,
      is_active: is_active !== undefined ? is_active === 'true' : undefined,
      limit,
      offset,
    };

    const { jobs, total } = await jobService.getJobs(filters);

    return c.json({
      success: true,
      data: {
        jobs,
        total,
        limit,
        offset,
      },
    });
  } catch (error: any) {
    console.error('Error listing jobs:', error);
    return c.json(
      {
        success: false,
        error: error.message || 'Failed to list jobs',
      },
      500
    );
  }
});

// Create a new job
jobsRoutes.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const request = CreateJobRequestSchema.parse(body);

    const job = await jobService.createJob(request);

    // Schedule if has schedule config and is active
    if (job.schedule_config && job.is_active) {
      await schedulerService.scheduleJob(job);
    }

    return c.json(
      {
        success: true,
        data: job,
      },
      201
    );
  } catch (error: any) {
    console.error('Error creating job:', error);
    return c.json(
      {
        success: false,
        error: error.message || 'Failed to create job',
      },
      400
    );
  }
});

// Get a single job
jobsRoutes.get('/:jobId', async (c) => {
  try {
    const jobId = c.req.param('jobId');
    const job = await jobService.getJob(jobId);

    if (!job) {
      return c.json(
        {
          success: false,
          error: 'Job not found',
        },
        404
      );
    }

    return c.json({
      success: true,
      data: { job },
    });
  } catch (error: any) {
    console.error('Error getting job:', error);
    return c.json(
      {
        success: false,
        error: error.message || 'Failed to get job',
      },
      500
    );
  }
});

// Update a job
jobsRoutes.put('/:jobId', async (c) => {
  try {
    const jobId = c.req.param('jobId');
    const body = await c.req.json();
    const request = UpdateJobRequestSchema.parse(body);

    const job = await jobService.updateJob(jobId, request);

    if (!job) {
      return c.json(
        {
          success: false,
          error: 'Job not found',
        },
        404
      );
    }

    // Reschedule if needed
    if (job.schedule_config && job.is_active) {
      await schedulerService.scheduleJob(job);
    } else {
      schedulerService.unscheduleJob(jobId);
    }

    return c.json({
      success: true,
      data: job,
    });
  } catch (error: any) {
    console.error('Error updating job:', error);
    return c.json(
      {
        success: false,
        error: error.message || 'Failed to update job',
      },
      400
    );
  }
});

// Delete a job
jobsRoutes.delete('/:jobId', async (c) => {
  try {
    const jobId = c.req.param('jobId');

    // Unschedule first
    schedulerService.unscheduleJob(jobId);

    const deleted = await jobService.deleteJob(jobId);

    if (!deleted) {
      return c.json(
        {
          success: false,
          error: 'Job not found',
        },
        404
      );
    }

    return c.json({
      success: true,
      message: 'Job deleted',
    });
  } catch (error: any) {
    console.error('Error deleting job:', error);
    return c.json(
      {
        success: false,
        error: error.message || 'Failed to delete job',
      },
      500
    );
  }
});

// Run job immediately (manual trigger)
jobsRoutes.post('/:jobId/run', async (c) => {
  try {
    const jobId = c.req.param('jobId');

    const job = await jobService.getJob(jobId);
    if (!job) {
      return c.json(
        {
          success: false,
          error: 'Job not found',
        },
        404
      );
    }

    // Execute asynchronously
    const execution = await jobExecutor.executeJob(jobId, 'manual');

    return c.json({
      success: true,
      data: {
        execution_id: execution.id,
        status: execution.status,
        message: 'Job execution started',
      },
    });
  } catch (error: any) {
    console.error('Error running job:', error);
    return c.json(
      {
        success: false,
        error: error.message || 'Failed to run job',
      },
      500
    );
  }
});

// Toggle job active status
jobsRoutes.post('/:jobId/toggle', async (c) => {
  try {
    const jobId = c.req.param('jobId');

    const job = await jobService.toggleJob(jobId);

    if (!job) {
      return c.json(
        {
          success: false,
          error: 'Job not found',
        },
        404
      );
    }

    // Update scheduler
    if (job.is_active && job.schedule_config) {
      await schedulerService.scheduleJob(job);
    } else {
      schedulerService.unscheduleJob(jobId);
    }

    return c.json({
      success: true,
      data: job,
    });
  } catch (error: any) {
    console.error('Error toggling job:', error);
    return c.json(
      {
        success: false,
        error: error.message || 'Failed to toggle job',
      },
      500
    );
  }
});

// Update job schedule
jobsRoutes.post('/:jobId/schedule', async (c) => {
  try {
    const jobId = c.req.param('jobId');
    const body = await c.req.json();
    const { schedule_config } = ScheduleJobRequestSchema.parse(body);

    const job = await jobService.updateSchedule(jobId, schedule_config);

    if (!job) {
      return c.json(
        {
          success: false,
          error: 'Job not found',
        },
        404
      );
    }

    // Update scheduler
    if (job.is_active) {
      await schedulerService.scheduleJob(job);
    }

    return c.json({
      success: true,
      data: job,
    });
  } catch (error: any) {
    console.error('Error updating schedule:', error);
    return c.json(
      {
        success: false,
        error: error.message || 'Failed to update schedule',
      },
      400
    );
  }
});

// Get job executions
jobsRoutes.get('/:jobId/executions', async (c) => {
  try {
    const jobId = c.req.param('jobId');
    const limitParam = c.req.query('limit');
    // If no limit specified, fetch all executions (pagination handled on frontend)
    const limit = limitParam ? parseInt(limitParam) : undefined;

    const executions = await jobService.getExecutions(jobId, limit);

    return c.json({
      success: true,
      data: {
        executions,
        total: executions.length,
      },
    });
  } catch (error: any) {
    console.error('Error getting executions:', error);
    return c.json(
      {
        success: false,
        error: error.message || 'Failed to get executions',
      },
      500
    );
  }
});

// Get single execution
jobsRoutes.get('/:jobId/executions/:executionId', async (c) => {
  try {
    const executionId = c.req.param('executionId');

    const execution = await jobService.getExecution(executionId);

    if (!execution) {
      return c.json(
        {
          success: false,
          error: 'Execution not found',
        },
        404
      );
    }

    return c.json({
      success: true,
      data: execution,
    });
  } catch (error: any) {
    console.error('Error getting execution:', error);
    return c.json(
      {
        success: false,
        error: error.message || 'Failed to get execution',
      },
      500
    );
  }
});


