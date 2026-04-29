import { getPool } from './database/sqlserver';
import type {
  Job,
  CreateJobRequest,
  UpdateJobRequest,
  Execution,
  ScheduleConfig,
} from '../models/job';

// Helper to format UUID: remove dashes and lowercase
export function formatUuid(uuid: string): string {
  return uuid.replace(/-/g, '').toLowerCase();
}

// Helper to normalize UUID: add dashes back for database queries
export function normalizeUuid(uuid: string): string {
  // Remove any existing dashes and lowercase
  const clean = uuid.replace(/-/g, '').toLowerCase();
  // Add dashes in standard UUID format: 8-4-4-4-12
  return `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20)}`.toUpperCase();
}

export class JobService {
  // Create a new job
  async createJob(request: CreateJobRequest): Promise<Job> {
    const pool = await getPool();

    const result = await pool.request()
      .input('job_name', request.job_name)
      .input('description', request.description || null)
      .input('job_type', request.job_type)
      .input('schedule_type', request.schedule_config?.schedule_type || 'cron')
      .input('schedule_config', request.schedule_config ? JSON.stringify(request.schedule_config) : null)
      .input('workflow_definition', request.workflow_definition ? JSON.stringify(request.workflow_definition) : null)
      .input('target_function', request.target_function || null)
      .input('parameters', request.parameters ? JSON.stringify(request.parameters) : null)
      .input('output_format', request.output_format || 'csv')
      .input('author', request.author || null)
      .input('is_active', request.is_active ?? true)
      .input('max_retries', request.max_retries || 0)
      .input('retry_delay_seconds', request.retry_delay_seconds || 60)
      .input('notify_on_success', request.notify_on_success ?? false)
      .input('notify_on_failure', request.notify_on_failure ?? true)
      .query(`
        INSERT INTO jobs (
          job_name, description, job_type, schedule_type, schedule_config,
          workflow_definition, target_function, parameters, output_format,
          author, is_active, max_retries, retry_delay_seconds,
          notify_on_success, notify_on_failure,
          created_at, updated_at
        )
        OUTPUT INSERTED.*
        VALUES (
          @job_name, @description, @job_type, @schedule_type, @schedule_config,
          @workflow_definition, @target_function, @parameters, @output_format,
          @author, @is_active, @max_retries, @retry_delay_seconds,
          @notify_on_success, @notify_on_failure,
          GETUTCDATE(), GETUTCDATE()
        )
      `);

    return this.parseJobRow(result.recordset[0]);
  }

  // Get all jobs with optional filtering
  async getJobs(filters?: {
    author?: string;
    job_type?: string;
    is_active?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ jobs: Job[]; total: number }> {
    const pool = await getPool();

    let whereClause = 'WHERE 1=1';
    const countRequest = pool.request();
    const dataRequest = pool.request();

    if (filters?.author) {
      whereClause += ' AND author = @author';
      countRequest.input('author', filters.author);
      dataRequest.input('author', filters.author);
    }
    if (filters?.job_type) {
      whereClause += ' AND job_type = @job_type';
      countRequest.input('job_type', filters.job_type);
      dataRequest.input('job_type', filters.job_type);
    }
    if (filters?.is_active !== undefined) {
      whereClause += ' AND is_active = @is_active';
      countRequest.input('is_active', filters.is_active);
      dataRequest.input('is_active', filters.is_active);
    }

    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    // Get total count
    const countResult = await countRequest.query(`SELECT COUNT(*) as total FROM jobs ${whereClause}`);
    const total = countResult.recordset[0].total;

    // Get paginated results with last execution info
    dataRequest.input('limit', limit);
    dataRequest.input('offset', offset);

    const result = await dataRequest.query(`
      SELECT j.*,
             le.started_at as last_run_started_at,
             le.completed_at as last_run_completed_at,
             le.status as last_run_status
      FROM jobs j
      OUTER APPLY (
        SELECT TOP 1 started_at, completed_at, status
        FROM job_executions
        WHERE job_id = j.id
        ORDER BY started_at DESC
      ) le
      ${whereClause}
      ORDER BY j.created_at DESC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `);

    return {
      jobs: result.recordset.map((row: any) => this.parseJobRow(row)),
      total,
    };
  }

  // Get a single job by ID
  async getJob(jobId: string): Promise<Job | null> {
    const pool = await getPool();
    const normalizedId = normalizeUuid(jobId);

    const result = await pool.request()
      .input('id', normalizedId)
      .query(`
        SELECT j.*,
               le.started_at as last_run_started_at,
               le.completed_at as last_run_completed_at,
               le.status as last_run_status
        FROM jobs j
        OUTER APPLY (
          SELECT TOP 1 started_at, completed_at, status
          FROM job_executions
          WHERE job_id = j.id
          ORDER BY started_at DESC
        ) le
        WHERE j.id = @id
      `);

    if (result.recordset.length === 0) {
      return null;
    }

    return this.parseJobRow(result.recordset[0]);
  }

  // Update a job
  async updateJob(jobId: string, request: UpdateJobRequest): Promise<Job | null> {
    const pool = await getPool();
    const normalizedId = normalizeUuid(jobId);

    const updates: string[] = [];
    const sqlRequest = pool.request().input('id', normalizedId);

    if (request.job_name !== undefined) {
      updates.push('job_name = @job_name');
      sqlRequest.input('job_name', request.job_name);
    }
    if (request.description !== undefined) {
      updates.push('description = @description');
      sqlRequest.input('description', request.description);
    }
    if (request.job_type !== undefined) {
      updates.push('job_type = @job_type');
      sqlRequest.input('job_type', request.job_type);
    }
    if (request.schedule_config !== undefined) {
      updates.push('schedule_type = @schedule_type');
      updates.push('schedule_config = @schedule_config');
      sqlRequest.input('schedule_type', request.schedule_config?.schedule_type || null);
      sqlRequest.input('schedule_config', JSON.stringify(request.schedule_config));
    }
    if (request.workflow_definition !== undefined) {
      updates.push('workflow_definition = @workflow_definition');
      sqlRequest.input('workflow_definition', JSON.stringify(request.workflow_definition));
    }
    if (request.target_function !== undefined) {
      updates.push('target_function = @target_function');
      sqlRequest.input('target_function', request.target_function);
    }
    if (request.parameters !== undefined) {
      updates.push('parameters = @parameters');
      sqlRequest.input('parameters', JSON.stringify(request.parameters));
    }
    if (request.output_format !== undefined) {
      updates.push('output_format = @output_format');
      sqlRequest.input('output_format', request.output_format);
    }
    if (request.author !== undefined) {
      updates.push('author = @author');
      sqlRequest.input('author', request.author);
    }
    if (request.is_active !== undefined) {
      updates.push('is_active = @is_active');
      sqlRequest.input('is_active', request.is_active);
    }
    if (request.max_retries !== undefined) {
      updates.push('max_retries = @max_retries');
      sqlRequest.input('max_retries', request.max_retries);
    }
    if (request.retry_delay_seconds !== undefined) {
      updates.push('retry_delay_seconds = @retry_delay_seconds');
      sqlRequest.input('retry_delay_seconds', request.retry_delay_seconds);
    }
    if (request.notify_on_success !== undefined) {
      updates.push('notify_on_success = @notify_on_success');
      sqlRequest.input('notify_on_success', request.notify_on_success);
    }
    if (request.notify_on_failure !== undefined) {
      updates.push('notify_on_failure = @notify_on_failure');
      sqlRequest.input('notify_on_failure', request.notify_on_failure);
    }
    if (updates.length === 0) {
      return this.getJob(jobId);
    }

    updates.push('updated_at = GETUTCDATE()');

    const result = await sqlRequest.query(`
      UPDATE jobs
      SET ${updates.join(', ')}
      OUTPUT INSERTED.*
      WHERE id = @id
    `);

    if (result.recordset.length === 0) {
      return null;
    }

    return this.parseJobRow(result.recordset[0]);
  }

  // Delete a job
  async deleteJob(jobId: string): Promise<boolean> {
    const pool = await getPool();
    const normalizedId = normalizeUuid(jobId);

    // Delete executions first
    await pool.request()
      .input('job_id', normalizedId)
      .query('DELETE FROM job_executions WHERE job_id = @job_id');

    // Delete job
    const result = await pool.request()
      .input('id', normalizedId)
      .query('DELETE FROM jobs WHERE id = @id');

    return result.rowsAffected[0] > 0;
  }

  // Toggle job active status
  async toggleJob(jobId: string): Promise<Job | null> {
    const pool = await getPool();
    const normalizedId = normalizeUuid(jobId);

    const result = await pool.request()
      .input('id', normalizedId)
      .query(`
        UPDATE jobs
        SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END,
            updated_at = GETUTCDATE()
        OUTPUT INSERTED.*
        WHERE id = @id
      `);

    if (result.recordset.length === 0) {
      return null;
    }

    return this.parseJobRow(result.recordset[0]);
  }

  // Update job schedule
  async updateSchedule(jobId: string, scheduleConfig: ScheduleConfig): Promise<Job | null> {
    const pool = await getPool();
    const normalizedId = normalizeUuid(jobId);

    const result = await pool.request()
      .input('id', normalizedId)
      .input('schedule_type', scheduleConfig.schedule_type)
      .input('schedule_config', JSON.stringify(scheduleConfig))
      .query(`
        UPDATE jobs
        SET schedule_type = @schedule_type,
            schedule_config = @schedule_config,
            updated_at = GETUTCDATE()
        OUTPUT INSERTED.*
        WHERE id = @id
      `);

    if (result.recordset.length === 0) {
      return null;
    }

    return this.parseJobRow(result.recordset[0]);
  }

  // Create execution record
  async createExecution(jobId: string, triggerType: 'manual' | 'scheduled'): Promise<Execution> {
    const pool = await getPool();
    const normalizedId = normalizeUuid(jobId);

    const result = await pool.request()
      .input('job_id', normalizedId)
      .input('status', 'pending')
      .input('trigger_type', triggerType)
      .query(`
        INSERT INTO job_executions (job_id, status, trigger_type, started_at)
        OUTPUT INSERTED.*
        VALUES (@job_id, @status, @trigger_type, GETUTCDATE())
      `);

    return this.parseExecutionRow(result.recordset[0]);
  }

  // Update execution
  async updateExecution(
    executionId: string,
    updates: {
      status?: string;
      error_message?: string;
      output_file_path?: string;
      output_file_size_bytes?: number;
      rows_processed?: number;
      step_results?: any[];
      completed?: boolean;
    }
  ): Promise<Execution | null> {
    const pool = await getPool();
    const normalizedId = normalizeUuid(executionId);

    const setClauses: string[] = [];
    const request = pool.request().input('id', normalizedId);

    if (updates.status) {
      setClauses.push('status = @status');
      request.input('status', updates.status);
    }
    if (updates.error_message !== undefined) {
      setClauses.push('error_message = @error_message');
      request.input('error_message', updates.error_message);
    }
    if (updates.output_file_path !== undefined) {
      setClauses.push('output_file_path = @output_file_path');
      request.input('output_file_path', updates.output_file_path);
    }
    if (updates.output_file_size_bytes !== undefined) {
      setClauses.push('output_file_size_bytes = @output_file_size_bytes');
      request.input('output_file_size_bytes', updates.output_file_size_bytes);
    }
    if (updates.rows_processed !== undefined) {
      setClauses.push('rows_processed = @rows_processed');
      request.input('rows_processed', updates.rows_processed);
    }
    if (updates.step_results !== undefined) {
      setClauses.push('step_results = @step_results');
      request.input('step_results', JSON.stringify(updates.step_results));
    }
    if (updates.completed) {
      setClauses.push('completed_at = GETUTCDATE()');
      setClauses.push('duration_seconds = DATEDIFF(SECOND, started_at, GETUTCDATE())');
    }

    if (setClauses.length === 0) {
      return null;
    }

    const result = await request.query(`
      UPDATE job_executions
      SET ${setClauses.join(', ')}
      OUTPUT INSERTED.*
      WHERE id = @id
    `);

    if (result.recordset.length === 0) {
      return null;
    }

    return this.parseExecutionRow(result.recordset[0]);
  }

  // Get executions for a job
  async getExecutions(jobId: string, limit?: number): Promise<Execution[]> {
    const pool = await getPool();
    const normalizedId = normalizeUuid(jobId);

    // If no limit specified, fetch all executions
    const query = limit
      ? `
        SELECT TOP (@limit) *
        FROM job_executions
        WHERE job_id = @job_id
        ORDER BY started_at DESC
      `
      : `
        SELECT *
        FROM job_executions
        WHERE job_id = @job_id
        ORDER BY started_at DESC
      `;

    const request = pool.request().input('job_id', normalizedId);
    if (limit) {
      request.input('limit', limit);
    }

    const result = await request.query(query);
    return result.recordset.map((row: any) => this.parseExecutionRow(row));
  }

  // Get single execution
  async getExecution(executionId: string): Promise<Execution | null> {
    const pool = await getPool();
    const normalizedId = normalizeUuid(executionId);

    const result = await pool.request()
      .input('id', normalizedId)
      .query('SELECT * FROM job_executions WHERE id = @id');

    if (result.recordset.length === 0) {
      return null;
    }

    return this.parseExecutionRow(result.recordset[0]);
  }

  // Update last run time
  async updateLastRunTime(jobId: string): Promise<void> {
    const pool = await getPool();
    const normalizedId = normalizeUuid(jobId);

    await pool.request()
      .input('id', normalizedId)
      .query('UPDATE jobs SET last_run_time = GETUTCDATE() WHERE id = @id');
  }

  // Helper to parse job row from DB
  private parseJobRow(row: any): Job {
    return {
      id: formatUuid(row.id),
      job_name: row.job_name,
      description: row.description,
      job_type: row.job_type,
      schedule_type: row.schedule_type,
      schedule_config: row.schedule_config ? JSON.parse(row.schedule_config) : null,
      workflow_definition: row.workflow_definition ? JSON.parse(row.workflow_definition) : null,
      target_function: row.target_function,
      parameters: row.parameters ? JSON.parse(row.parameters) : null,
      output_format: row.output_format,
      author: row.author,
      is_active: row.is_active,
      next_run_time: row.next_run_time,
      last_run_time: row.last_run_time,
      last_run_started_at: row.last_run_started_at,
      last_run_completed_at: row.last_run_completed_at,
      last_run_status: row.last_run_status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      max_retries: row.max_retries,
      retry_delay_seconds: row.retry_delay_seconds,
      notify_on_success: row.notify_on_success,
      notify_on_failure: row.notify_on_failure,
      timeout_seconds: null,
      tags: null,
    };
  }

  // Helper to parse execution row from DB
  private parseExecutionRow(row: any): Execution {
    return {
      id: formatUuid(row.id),
      job_id: formatUuid(row.job_id),
      status: row.status,
      trigger_type: row.trigger_type,
      started_at: row.started_at,
      completed_at: row.completed_at,
      duration_seconds: row.duration_seconds,
      error_message: row.error_message,
      output_file_path: row.output_file_path,
      output_file_size_bytes: row.output_file_size_bytes,
      rows_processed: row.rows_processed,
      step_results: row.step_results ? JSON.parse(row.step_results) : null,
    };
  }
}

export const jobService = new JobService();
