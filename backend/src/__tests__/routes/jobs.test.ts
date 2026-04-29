import { describe, expect, test, mock, beforeEach } from 'bun:test';
import { Hono } from 'hono';

// Mock services
const mockJobService = {
  getJobs: mock(() => Promise.resolve({ jobs: [], total: 0 })),
  getJob: mock(() => Promise.resolve(null)),
  createJob: mock(() => Promise.resolve({ id: 1, job_name: 'New Job' })),
  updateJob: mock(() => Promise.resolve(null)),
  deleteJob: mock(() => Promise.resolve(false)),
  toggleJob: mock(() => Promise.resolve(null)),
  updateSchedule: mock(() => Promise.resolve(null)),
  getExecutions: mock(() => Promise.resolve([])),
  getExecution: mock(() => Promise.resolve(null)),
};

const mockJobExecutor = {
  executeJob: mock(() => Promise.resolve({ id: 1, status: 'completed' })),
};

const mockSchedulerService = {
  scheduleJob: mock(() => Promise.resolve()),
  unscheduleJob: mock(() => {}),
  validateCron: mock(() => ({ valid: true, nextRuns: [] })),
};

mock.module('../../services/job-service', () => ({
  jobService: mockJobService,
}));

mock.module('../../services/job-executor', () => ({
  jobExecutor: mockJobExecutor,
}));

mock.module('../../services/scheduler-service', () => ({
  schedulerService: mockSchedulerService,
}));

// Import routes after mocking
import { jobsRoutes } from '../../routes/jobs';

describe('Jobs Routes', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.route('/jobs', jobsRoutes);

    // Clear all mocks
    Object.values(mockJobService).forEach((m) => m.mockClear());
    Object.values(mockJobExecutor).forEach((m) => m.mockClear());
    Object.values(mockSchedulerService).forEach((m) => m.mockClear());
  });

  describe('GET /jobs', () => {
    test('should list jobs with default pagination', async () => {
      mockJobService.getJobs.mockResolvedValueOnce({
        jobs: [{ id: 1, job_name: 'Test Job' }],
        total: 1,
      });

      const res = await app.request('/jobs');
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.jobs).toHaveLength(1);
      expect(json.data.total).toBe(1);
    });

    test('should filter by author', async () => {
      mockJobService.getJobs.mockResolvedValueOnce({ jobs: [], total: 0 });

      await app.request('/jobs?author=test@example.com');

      expect(mockJobService.getJobs).toHaveBeenCalledWith(
        expect.objectContaining({ author: 'test@example.com' })
      );
    });

    test('should filter by job_type', async () => {
      mockJobService.getJobs.mockResolvedValueOnce({ jobs: [], total: 0 });

      await app.request('/jobs?job_type=workflow');

      expect(mockJobService.getJobs).toHaveBeenCalledWith(
        expect.objectContaining({ job_type: 'workflow' })
      );
    });

    test('should filter by is_active', async () => {
      mockJobService.getJobs.mockResolvedValueOnce({ jobs: [], total: 0 });

      await app.request('/jobs?is_active=true');

      expect(mockJobService.getJobs).toHaveBeenCalledWith(
        expect.objectContaining({ is_active: true })
      );
    });

    test('should apply pagination', async () => {
      mockJobService.getJobs.mockResolvedValueOnce({ jobs: [], total: 100 });

      const res = await app.request('/jobs?limit=10&offset=20');
      const json = await res.json();

      expect(json.data.limit).toBe(10);
      expect(json.data.offset).toBe(20);
    });

    test('should handle errors', async () => {
      mockJobService.getJobs.mockRejectedValueOnce(new Error('Database error'));

      const res = await app.request('/jobs');
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.success).toBe(false);
      expect(json.error).toContain('Database error');
    });
  });

  describe('POST /jobs', () => {
    test('should create a workflow job', async () => {
      const newJob = {
        id: 1,
        job_name: 'Test Workflow',
        job_type: 'workflow',
        is_active: true,
        schedule_config: null,
      };
      mockJobService.createJob.mockResolvedValueOnce(newJob);

      const res = await app.request('/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_name: 'Test Workflow',
          job_type: 'workflow',
          workflow_definition: {
            steps: [
              {
                step_number: 1,
                step_name: 'Query',
                step_type: 'sqlserver_query',
                query: 'SELECT 1',
              },
            ],
          },
        }),
      });
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.success).toBe(true);
      expect(json.data.id).toBe(1);
    });

    test('should schedule job if has schedule config', async () => {
      const newJob = {
        id: 2,
        job_name: 'Scheduled Job',
        job_type: 'workflow',
        is_active: true,
        schedule_config: {
          schedule_type: 'cron',
          cron_expression: '0 9 * * *',
        },
      };
      mockJobService.createJob.mockResolvedValueOnce(newJob);

      await app.request('/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_name: 'Scheduled Job',
          job_type: 'workflow',
          schedule_config: {
            schedule_type: 'cron',
            cron_expression: '0 9 * * *',
          },
        }),
      });

      expect(mockSchedulerService.scheduleJob).toHaveBeenCalled();
    });

    test('should return 400 for invalid request', async () => {
      const res = await app.request('/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Missing required job_name
          job_type: 'workflow',
        }),
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
    });
  });

  describe('GET /jobs/:jobId', () => {
    test('should return job when found', async () => {
      mockJobService.getJob.mockResolvedValueOnce({
        id: 1,
        job_name: 'Test Job',
        job_type: 'workflow',
      });

      const res = await app.request('/jobs/1');
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.job.id).toBe(1);
    });

    test('should return 404 when job not found', async () => {
      mockJobService.getJob.mockResolvedValueOnce(null);

      const res = await app.request('/jobs/999');
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.success).toBe(false);
      expect(json.error).toContain('not found');
    });
  });

  describe('PUT /jobs/:jobId', () => {
    test('should update job', async () => {
      const updatedJob = {
        id: 1,
        job_name: 'Updated Job',
        job_type: 'workflow',
        is_active: true,
        schedule_config: null,
      };
      mockJobService.updateJob.mockResolvedValueOnce(updatedJob);

      const res = await app.request('/jobs/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_name: 'Updated Job' }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.job_name).toBe('Updated Job');
    });

    test('should reschedule job when schedule config changes', async () => {
      const updatedJob = {
        id: 1,
        job_name: 'Job',
        job_type: 'workflow',
        is_active: true,
        schedule_config: {
          schedule_type: 'cron',
          cron_expression: '0 10 * * *',
        },
      };
      mockJobService.updateJob.mockResolvedValueOnce(updatedJob);

      await app.request('/jobs/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schedule_config: {
            schedule_type: 'cron',
            cron_expression: '0 10 * * *',
          },
        }),
      });

      expect(mockSchedulerService.scheduleJob).toHaveBeenCalled();
    });

    test('should unschedule job when deactivated', async () => {
      const updatedJob = {
        id: 1,
        job_name: 'Job',
        job_type: 'workflow',
        is_active: false,
        schedule_config: null,
      };
      mockJobService.updateJob.mockResolvedValueOnce(updatedJob);

      await app.request('/jobs/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: false }),
      });

      expect(mockSchedulerService.unscheduleJob).toHaveBeenCalledWith("1");
    });

    test('should return 404 when job not found', async () => {
      mockJobService.updateJob.mockResolvedValueOnce(null);

      const res = await app.request('/jobs/999', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_name: 'Updated' }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /jobs/:jobId', () => {
    test('should delete job', async () => {
      mockJobService.deleteJob.mockResolvedValueOnce(true);

      const res = await app.request('/jobs/1', { method: 'DELETE' });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(mockSchedulerService.unscheduleJob).toHaveBeenCalledWith("1");
    });

    test('should return 404 when job not found', async () => {
      mockJobService.deleteJob.mockResolvedValueOnce(false);

      const res = await app.request('/jobs/999', { method: 'DELETE' });

      expect(res.status).toBe(404);
    });
  });

  describe('POST /jobs/:jobId/run', () => {
    test('should run job manually', async () => {
      mockJobService.getJob.mockResolvedValueOnce({
        id: 1,
        job_name: 'Test Job',
      });
      mockJobExecutor.executeJob.mockResolvedValueOnce({
        id: 1,
        status: 'completed',
      });

      const res = await app.request('/jobs/1/run', { method: 'POST' });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.execution_id).toBe(1);
      expect(mockJobExecutor.executeJob).toHaveBeenCalledWith("1", 'manual');
    });

    test('should return 404 when job not found', async () => {
      mockJobService.getJob.mockResolvedValueOnce(null);

      const res = await app.request('/jobs/999/run', { method: 'POST' });

      expect(res.status).toBe(404);
    });
  });

  describe('POST /jobs/:jobId/toggle', () => {
    test('should toggle job active status', async () => {
      mockJobService.toggleJob.mockResolvedValueOnce({
        id: 1,
        job_name: 'Job',
        is_active: false,
        schedule_config: null,
      });

      const res = await app.request('/jobs/1/toggle', { method: 'POST' });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.is_active).toBe(false);
    });

    test('should schedule job when activated with schedule', async () => {
      mockJobService.toggleJob.mockResolvedValueOnce({
        id: 1,
        job_name: 'Job',
        is_active: true,
        schedule_config: {
          schedule_type: 'cron',
          cron_expression: '0 9 * * *',
        },
      });

      await app.request('/jobs/1/toggle', { method: 'POST' });

      expect(mockSchedulerService.scheduleJob).toHaveBeenCalled();
    });

    test('should return 404 when job not found', async () => {
      mockJobService.toggleJob.mockResolvedValueOnce(null);

      const res = await app.request('/jobs/999/toggle', { method: 'POST' });

      expect(res.status).toBe(404);
    });
  });

  describe('POST /jobs/:jobId/schedule', () => {
    test('should update job schedule', async () => {
      mockJobService.updateSchedule.mockResolvedValueOnce({
        id: 1,
        job_name: 'Job',
        is_active: true,
        schedule_config: {
          schedule_type: 'interval',
          interval_seconds: 3600,
        },
      });

      const res = await app.request('/jobs/1/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schedule_config: {
            schedule_type: 'interval',
            interval_seconds: 3600,
          },
        }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
    });

    test('should return 404 when job not found', async () => {
      mockJobService.updateSchedule.mockResolvedValueOnce(null);

      const res = await app.request('/jobs/999/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schedule_config: {
            schedule_type: 'cron',
            cron_expression: '0 9 * * *',
          },
        }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe('GET /jobs/:jobId/executions', () => {
    test('should return job executions', async () => {
      mockJobService.getExecutions.mockResolvedValueOnce([
        { id: 1, status: 'completed' },
        { id: 2, status: 'failed' },
      ]);

      const res = await app.request('/jobs/1/executions');
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.executions).toHaveLength(2);
    });

    test('should apply limit parameter', async () => {
      mockJobService.getExecutions.mockResolvedValueOnce([]);

      await app.request('/jobs/1/executions?limit=5');

      expect(mockJobService.getExecutions).toHaveBeenCalledWith("1", 5);
    });
  });

  describe('GET /jobs/:jobId/executions/:executionId', () => {
    test('should return execution when found', async () => {
      mockJobService.getExecution.mockResolvedValueOnce({
        id: 1,
        job_id: 1,
        status: 'completed',
      });

      const res = await app.request('/jobs/1/executions/1');
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.id).toBe(1);
    });

    test('should return 404 when execution not found', async () => {
      mockJobService.getExecution.mockResolvedValueOnce(null);

      const res = await app.request('/jobs/1/executions/999');

      expect(res.status).toBe(404);
    });
  });

  describe('POST /jobs/validate/cron', () => {
    test('should validate cron expression', async () => {
      mockSchedulerService.validateCron.mockReturnValueOnce({
        valid: true,
        nextRuns: ['2025-01-01T09:00:00Z'],
      });

      const res = await app.request('/jobs/validate/cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expression: '0 9 * * *' }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.valid).toBe(true);
    });

    test('should return invalid for bad cron expression', async () => {
      mockSchedulerService.validateCron.mockReturnValueOnce({
        valid: false,
        error: 'Invalid format',
      });

      const res = await app.request('/jobs/validate/cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expression: 'invalid' }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.valid).toBe(false);
    });
  });

  describe('GET /jobs/registry/list', () => {
    test('should return available functions', async () => {
      const res = await app.request('/jobs/registry/list');
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.data.length).toBeGreaterThan(0);
    });
  });
});
