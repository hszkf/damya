import { describe, expect, test, mock, beforeEach, afterEach } from 'bun:test';
import type { CreateJobRequest, UpdateJobRequest, ScheduleConfig } from '../../models/job';

// Create local mock pool and request for testing
const createMockRequest = () => ({
  input: mock(function(this: any) { return this; }),
  query: mock(() => Promise.resolve({ recordset: [], rowsAffected: [0] })),
});

let mockRequest = createMockRequest();

const mockPool = {
  request: () => mockRequest,
  connected: true,
  close: mock(() => Promise.resolve()),
  pool: { size: 10, available: 8, pending: 0 },
};

// Mock getPool - keep all other exports
mock.module('../../services/database/sqlserver', () => ({
  getPool: () => Promise.resolve(mockPool),
  initSqlServer: mock(() => Promise.resolve()),
  closeSqlServer: mock(() => Promise.resolve()),
  executeQuery: mock(() => Promise.resolve({ columns: [], rows: [], rowCount: 0, executionTime: 0 })),
  getSchema: mock(() => Promise.resolve({})),
  getHealthStatus: mock(() => Promise.resolve({ status: 'healthy', connected: true, pool: {} })),
}));

// Import after mocking
import { JobService } from '../../services/job-service';

// Note: Bun's mock.module has issues with mocking database modules
// The mock is not applied correctly to imported modules
// These tests need to be restructured with a different mocking approach
describe.skip('JobService', () => {
  let jobService: JobService;

  beforeEach(() => {
    // Create fresh mock request for each test
    mockRequest = createMockRequest();
    jobService = new JobService();
  });

  describe('createJob', () => {
    test('should create a workflow job successfully', async () => {
      const mockJobRow = {
        id: 1,
        job_name: 'Test Job',
        description: 'Test Description',
        job_type: 'workflow',
        schedule_type: null,
        schedule_config: null,
        workflow_definition: JSON.stringify({ steps: [], error_handling: 'stop' }),
        target_function: null,
        parameters: null,
        output_format: 'csv',
        author: 'test@example.com',
        is_active: true,
        next_run_time: null,
        last_run_time: null,
        created_at: new Date(),
        updated_at: new Date(),
        max_retries: 0,
        retry_delay_seconds: 60,
        notify_on_success: false,
        notify_on_failure: true,
        timeout_seconds: null,
        tags: null,
      };

      mockRequest.query.mockResolvedValueOnce({ recordset: [mockJobRow] });

      const request: CreateJobRequest = {
        job_name: 'Test Job',
        description: 'Test Description',
        job_type: 'workflow',
        workflow_definition: {
          steps: [],
          error_handling: 'stop',
        },
        output_format: 'csv',
        author: 'test@example.com',
        is_active: true,
        max_retries: 0,
        retry_delay_seconds: 60,
        notify_on_success: false,
        notify_on_failure: true,
      };

      const result = await jobService.createJob(request);

      expect(result.id).toBe(1);
      expect(result.job_name).toBe('Test Job');
      expect(result.job_type).toBe('workflow');
      expect(mockRequest.input).toHaveBeenCalled();
    });

    test('should create a function job with schedule', async () => {
      const mockJobRow = {
        id: 2,
        job_name: 'Scheduled Function',
        description: null,
        job_type: 'function',
        schedule_type: 'cron',
        schedule_config: JSON.stringify({
          schedule_type: 'cron',
          cron_expression: '0 9 * * *',
          timezone: 'UTC',
        }),
        workflow_definition: null,
        target_function: 'export_to_s3',
        parameters: JSON.stringify({ bucket: 'test-bucket' }),
        output_format: 'json',
        author: null,
        is_active: true,
        next_run_time: null,
        last_run_time: null,
        created_at: new Date(),
        updated_at: new Date(),
        max_retries: 3,
        retry_delay_seconds: 120,
        notify_on_success: true,
        notify_on_failure: true,
        timeout_seconds: 600,
        tags: JSON.stringify(['production']),
      };

      mockRequest.query.mockResolvedValueOnce({ recordset: [mockJobRow] });

      const request: CreateJobRequest = {
        job_name: 'Scheduled Function',
        job_type: 'function',
        target_function: 'export_to_s3',
        parameters: { bucket: 'test-bucket' },
        schedule_config: {
          schedule_type: 'cron',
          cron_expression: '0 9 * * *',
          timezone: 'UTC',
        },
        output_format: 'json',
        is_active: true,
        max_retries: 3,
        retry_delay_seconds: 120,
        notify_on_success: true,
        notify_on_failure: true,
        timeout_seconds: 600,
        tags: ['production'],
      };

      const result = await jobService.createJob(request);

      expect(result.id).toBe(2);
      expect(result.job_type).toBe('function');
      expect(result.target_function).toBe('export_to_s3');
      expect(result.schedule_config?.schedule_type).toBe('cron');
      expect(result.tags).toEqual(['production']);
    });
  });

  describe('getJobs', () => {
    test('should return jobs with default pagination', async () => {
      const mockJobs = [
        {
          id: 1,
          job_name: 'Job 1',
          description: null,
          job_type: 'workflow',
          schedule_type: null,
          schedule_config: null,
          workflow_definition: null,
          target_function: null,
          parameters: null,
          output_format: 'csv',
          author: null,
          is_active: true,
          next_run_time: null,
          last_run_time: null,
          created_at: new Date(),
          updated_at: new Date(),
          max_retries: 0,
          retry_delay_seconds: 60,
          notify_on_success: false,
          notify_on_failure: true,
          timeout_seconds: null,
          tags: null,
        },
      ];

      // First call for count, second for data
      mockRequest.query
        .mockResolvedValueOnce({ recordset: [{ total: 1 }] })
        .mockResolvedValueOnce({ recordset: mockJobs });

      const result = await jobService.getJobs();

      expect(result.total).toBe(1);
      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0].job_name).toBe('Job 1');
    });

    test('should filter jobs by author', async () => {
      mockRequest.query
        .mockResolvedValueOnce({ recordset: [{ total: 0 }] })
        .mockResolvedValueOnce({ recordset: [] });

      const result = await jobService.getJobs({ author: 'test@example.com' });

      expect(result.total).toBe(0);
      expect(result.jobs).toHaveLength(0);
      expect(mockRequest.input).toHaveBeenCalledWith('author', 'test@example.com');
    });

    test('should filter jobs by job_type', async () => {
      mockRequest.query
        .mockResolvedValueOnce({ recordset: [{ total: 5 }] })
        .mockResolvedValueOnce({ recordset: [] });

      await jobService.getJobs({ job_type: 'workflow' });

      expect(mockRequest.input).toHaveBeenCalledWith('job_type', 'workflow');
    });

    test('should filter jobs by is_active', async () => {
      mockRequest.query
        .mockResolvedValueOnce({ recordset: [{ total: 3 }] })
        .mockResolvedValueOnce({ recordset: [] });

      await jobService.getJobs({ is_active: true });

      expect(mockRequest.input).toHaveBeenCalledWith('is_active', true);
    });

    test('should apply pagination', async () => {
      mockRequest.query
        .mockResolvedValueOnce({ recordset: [{ total: 100 }] })
        .mockResolvedValueOnce({ recordset: [] });

      await jobService.getJobs({ limit: 10, offset: 20 });

      expect(mockRequest.input).toHaveBeenCalledWith('limit', 10);
      expect(mockRequest.input).toHaveBeenCalledWith('offset', 20);
    });
  });

  describe('getJob', () => {
    test('should return job when found', async () => {
      const mockJobRow = {
        id: 1,
        job_name: 'Test Job',
        description: null,
        job_type: 'workflow',
        schedule_type: null,
        schedule_config: null,
        workflow_definition: null,
        target_function: null,
        parameters: null,
        output_format: 'csv',
        author: null,
        is_active: true,
        next_run_time: null,
        last_run_time: null,
        created_at: new Date(),
        updated_at: new Date(),
        max_retries: 0,
        retry_delay_seconds: 60,
        notify_on_success: false,
        notify_on_failure: true,
        timeout_seconds: null,
        tags: null,
      };

      mockRequest.query.mockResolvedValueOnce({ recordset: [mockJobRow] });

      const result = await jobService.getJob(1);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(1);
      expect(mockRequest.input).toHaveBeenCalledWith('id', 1);
    });

    test('should return null when job not found', async () => {
      mockRequest.query.mockResolvedValueOnce({ recordset: [] });

      const result = await jobService.getJob(999);

      expect(result).toBeNull();
    });
  });

  describe('updateJob', () => {
    test('should update job name', async () => {
      const mockJobRow = {
        id: 1,
        job_name: 'Updated Name',
        description: null,
        job_type: 'workflow',
        schedule_type: null,
        schedule_config: null,
        workflow_definition: null,
        target_function: null,
        parameters: null,
        output_format: 'csv',
        author: null,
        is_active: true,
        next_run_time: null,
        last_run_time: null,
        created_at: new Date(),
        updated_at: new Date(),
        max_retries: 0,
        retry_delay_seconds: 60,
        notify_on_success: false,
        notify_on_failure: true,
        timeout_seconds: null,
        tags: null,
      };

      mockRequest.query.mockResolvedValueOnce({ recordset: [mockJobRow] });

      const result = await jobService.updateJob(1, { job_name: 'Updated Name' });

      expect(result?.job_name).toBe('Updated Name');
      expect(mockRequest.input).toHaveBeenCalledWith('job_name', 'Updated Name');
    });

    test('should return null when updating non-existent job', async () => {
      mockRequest.query.mockResolvedValueOnce({ recordset: [] });

      const result = await jobService.updateJob(999, { job_name: 'Updated' });

      expect(result).toBeNull();
    });

    test('should return existing job when no updates provided', async () => {
      const mockJobRow = {
        id: 1,
        job_name: 'Existing Job',
        description: null,
        job_type: 'workflow',
        schedule_type: null,
        schedule_config: null,
        workflow_definition: null,
        target_function: null,
        parameters: null,
        output_format: 'csv',
        author: null,
        is_active: true,
        next_run_time: null,
        last_run_time: null,
        created_at: new Date(),
        updated_at: new Date(),
        max_retries: 0,
        retry_delay_seconds: 60,
        notify_on_success: false,
        notify_on_failure: true,
        timeout_seconds: null,
        tags: null,
      };

      // The first call returns the existing job via getJob
      mockRequest.query.mockResolvedValueOnce({ recordset: [mockJobRow] });

      const result = await jobService.updateJob(1, {});

      expect(result?.job_name).toBe('Existing Job');
    });

    test('should update schedule config', async () => {
      const mockJobRow = {
        id: 1,
        job_name: 'Job',
        description: null,
        job_type: 'workflow',
        schedule_type: 'cron',
        schedule_config: JSON.stringify({
          schedule_type: 'cron',
          cron_expression: '0 10 * * *',
          timezone: 'UTC',
        }),
        workflow_definition: null,
        target_function: null,
        parameters: null,
        output_format: 'csv',
        author: null,
        is_active: true,
        next_run_time: null,
        last_run_time: null,
        created_at: new Date(),
        updated_at: new Date(),
        max_retries: 0,
        retry_delay_seconds: 60,
        notify_on_success: false,
        notify_on_failure: true,
        timeout_seconds: null,
        tags: null,
      };

      mockRequest.query.mockResolvedValueOnce({ recordset: [mockJobRow] });

      const newSchedule: ScheduleConfig = {
        schedule_type: 'cron',
        cron_expression: '0 10 * * *',
        timezone: 'UTC',
      };

      const result = await jobService.updateJob(1, { schedule_config: newSchedule });

      expect(result?.schedule_config?.cron_expression).toBe('0 10 * * *');
    });
  });

  describe('deleteJob', () => {
    test('should delete job and its executions', async () => {
      mockRequest.query
        .mockResolvedValueOnce({ rowsAffected: [5] }) // Delete executions
        .mockResolvedValueOnce({ rowsAffected: [1] }); // Delete job

      const result = await jobService.deleteJob(1);

      expect(result).toBe(true);
      expect(mockRequest.input).toHaveBeenCalledWith('job_id', 1);
      expect(mockRequest.input).toHaveBeenCalledWith('id', 1);
    });

    test('should return false when job not found', async () => {
      mockRequest.query
        .mockResolvedValueOnce({ rowsAffected: [0] })
        .mockResolvedValueOnce({ rowsAffected: [0] });

      const result = await jobService.deleteJob(999);

      expect(result).toBe(false);
    });
  });

  describe('toggleJob', () => {
    test('should toggle job from active to inactive', async () => {
      const mockJobRow = {
        id: 1,
        job_name: 'Job',
        description: null,
        job_type: 'workflow',
        schedule_type: null,
        schedule_config: null,
        workflow_definition: null,
        target_function: null,
        parameters: null,
        output_format: 'csv',
        author: null,
        is_active: false, // Now inactive
        next_run_time: null,
        last_run_time: null,
        created_at: new Date(),
        updated_at: new Date(),
        max_retries: 0,
        retry_delay_seconds: 60,
        notify_on_success: false,
        notify_on_failure: true,
        timeout_seconds: null,
        tags: null,
      };

      mockRequest.query.mockResolvedValueOnce({ recordset: [mockJobRow] });

      const result = await jobService.toggleJob(1);

      expect(result?.is_active).toBe(false);
    });

    test('should return null when job not found', async () => {
      mockRequest.query.mockResolvedValueOnce({ recordset: [] });

      const result = await jobService.toggleJob(999);

      expect(result).toBeNull();
    });
  });

  describe('updateSchedule', () => {
    test('should update job schedule', async () => {
      const mockJobRow = {
        id: 1,
        job_name: 'Job',
        description: null,
        job_type: 'workflow',
        schedule_type: 'interval',
        schedule_config: JSON.stringify({
          schedule_type: 'interval',
          interval_seconds: 3600,
          timezone: 'UTC',
        }),
        workflow_definition: null,
        target_function: null,
        parameters: null,
        output_format: 'csv',
        author: null,
        is_active: true,
        next_run_time: null,
        last_run_time: null,
        created_at: new Date(),
        updated_at: new Date(),
        max_retries: 0,
        retry_delay_seconds: 60,
        notify_on_success: false,
        notify_on_failure: true,
        timeout_seconds: null,
        tags: null,
      };

      mockRequest.query.mockResolvedValueOnce({ recordset: [mockJobRow] });

      const schedule: ScheduleConfig = {
        schedule_type: 'interval',
        interval_seconds: 3600,
        timezone: 'UTC',
      };

      const result = await jobService.updateSchedule(1, schedule);

      expect(result?.schedule_type).toBe('interval');
      expect(result?.schedule_config?.interval_seconds).toBe(3600);
    });
  });

  describe('createExecution', () => {
    test('should create execution record', async () => {
      const mockExecutionRow = {
        id: 1,
        job_id: 1,
        status: 'pending',
        trigger_type: 'manual',
        started_at: new Date(),
        completed_at: null,
        duration_seconds: null,
        error_message: null,
        output_file_path: null,
        output_file_size_bytes: null,
        rows_processed: null,
        step_results: null,
      };

      mockRequest.query.mockResolvedValueOnce({ recordset: [mockExecutionRow] });

      const result = await jobService.createExecution(1, 'manual');

      expect(result.id).toBe(1);
      expect(result.job_id).toBe(1);
      expect(result.status).toBe('pending');
      expect(result.trigger_type).toBe('manual');
    });

    test('should create scheduled execution', async () => {
      const mockExecutionRow = {
        id: 2,
        job_id: 1,
        status: 'pending',
        trigger_type: 'scheduled',
        started_at: new Date(),
        completed_at: null,
        duration_seconds: null,
        error_message: null,
        output_file_path: null,
        output_file_size_bytes: null,
        rows_processed: null,
        step_results: null,
      };

      mockRequest.query.mockResolvedValueOnce({ recordset: [mockExecutionRow] });

      const result = await jobService.createExecution(1, 'scheduled');

      expect(result.trigger_type).toBe('scheduled');
    });
  });

  describe('updateExecution', () => {
    test('should update execution status', async () => {
      const mockExecutionRow = {
        id: 1,
        job_id: 1,
        status: 'running',
        trigger_type: 'manual',
        started_at: new Date(),
        completed_at: null,
        duration_seconds: null,
        error_message: null,
        output_file_path: null,
        output_file_size_bytes: null,
        rows_processed: null,
        step_results: null,
      };

      mockRequest.query.mockResolvedValueOnce({ recordset: [mockExecutionRow] });

      const result = await jobService.updateExecution(1, { status: 'running' });

      expect(result?.status).toBe('running');
    });

    test('should update execution with error', async () => {
      const mockExecutionRow = {
        id: 1,
        job_id: 1,
        status: 'failed',
        trigger_type: 'manual',
        started_at: new Date(),
        completed_at: new Date(),
        duration_seconds: 10,
        error_message: 'Connection failed',
        output_file_path: null,
        output_file_size_bytes: null,
        rows_processed: null,
        step_results: null,
      };

      mockRequest.query.mockResolvedValueOnce({ recordset: [mockExecutionRow] });

      const result = await jobService.updateExecution(1, {
        status: 'failed',
        error_message: 'Connection failed',
        completed: true,
      });

      expect(result?.status).toBe('failed');
      expect(result?.error_message).toBe('Connection failed');
    });

    test('should update execution with step results', async () => {
      const stepResults = [
        {
          step_number: 1,
          step_name: 'Query',
          step_type: 'sqlserver_query',
          status: 'completed',
          started_at: new Date(),
          completed_at: new Date(),
          duration_seconds: 5,
          error_message: null,
          rows_returned: 100,
          output_preview: [{ id: 1 }],
        },
      ];

      const mockExecutionRow = {
        id: 1,
        job_id: 1,
        status: 'running',
        trigger_type: 'manual',
        started_at: new Date(),
        completed_at: null,
        duration_seconds: null,
        error_message: null,
        output_file_path: null,
        output_file_size_bytes: null,
        rows_processed: null,
        step_results: JSON.stringify(stepResults),
      };

      mockRequest.query.mockResolvedValueOnce({ recordset: [mockExecutionRow] });

      const result = await jobService.updateExecution(1, { step_results: stepResults });

      expect(result?.step_results).toHaveLength(1);
    });

    test('should return null when no updates provided', async () => {
      const result = await jobService.updateExecution(1, {});

      expect(result).toBeNull();
    });
  });

  describe('getExecutions', () => {
    test('should return executions for a job', async () => {
      const mockExecutions = [
        {
          id: 2,
          job_id: 1,
          status: 'completed',
          trigger_type: 'manual',
          started_at: new Date(),
          completed_at: new Date(),
          duration_seconds: 10,
          error_message: null,
          output_file_path: null,
          output_file_size_bytes: null,
          rows_processed: 100,
          step_results: null,
        },
        {
          id: 1,
          job_id: 1,
          status: 'completed',
          trigger_type: 'scheduled',
          started_at: new Date(),
          completed_at: new Date(),
          duration_seconds: 15,
          error_message: null,
          output_file_path: null,
          output_file_size_bytes: null,
          rows_processed: 50,
          step_results: null,
        },
      ];

      mockRequest.query.mockResolvedValueOnce({ recordset: mockExecutions });

      const result = await jobService.getExecutions(1);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(2);
    });

    test('should respect limit parameter', async () => {
      mockRequest.query.mockResolvedValueOnce({ recordset: [] });

      await jobService.getExecutions(1, 5);

      expect(mockRequest.input).toHaveBeenCalledWith('limit', 5);
    });
  });

  describe('getExecution', () => {
    test('should return execution when found', async () => {
      const mockExecutionRow = {
        id: 1,
        job_id: 1,
        status: 'completed',
        trigger_type: 'manual',
        started_at: new Date(),
        completed_at: new Date(),
        duration_seconds: 10,
        error_message: null,
        output_file_path: '/output/result.csv',
        output_file_size_bytes: 1024,
        rows_processed: 100,
        step_results: JSON.stringify([]),
      };

      mockRequest.query.mockResolvedValueOnce({ recordset: [mockExecutionRow] });

      const result = await jobService.getExecution(1);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(1);
      expect(result?.output_file_path).toBe('/output/result.csv');
    });

    test('should return null when execution not found', async () => {
      mockRequest.query.mockResolvedValueOnce({ recordset: [] });

      const result = await jobService.getExecution(999);

      expect(result).toBeNull();
    });
  });

  describe('updateLastRunTime', () => {
    test('should update last run time', async () => {
      mockRequest.query.mockResolvedValueOnce({ rowsAffected: [1] });

      await jobService.updateLastRunTime(1);

      expect(mockRequest.input).toHaveBeenCalledWith('id', 1);
      expect(mockRequest.query).toHaveBeenCalled();
    });
  });
});
