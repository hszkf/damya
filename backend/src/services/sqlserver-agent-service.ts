/**
 * SQL Server Agent Service
 *
 * Provides functions to list, read, create, and update SQL Server Agent jobs.
 * Uses the msdb system database to query job information.
 *
 * Security: Uses parameterized queries where possible to prevent SQL injection.
 */

import sql from 'mssql';
import { getPool, dbUser } from './database/sqlserver';

// Database Mail profile name (configurable via env)
const MAIL_PROFILE_NAME = process.env.SQLSERVER_MAIL_PROFILE || 'ARBM Data';

// Schedule frequency type constants
const FREQ_TYPE = {
  ONCE: 1 as number,
  DAILY: 4 as number,
  WEEKLY: 8 as number,
  MONTHLY: 16 as number,
  MONTHLY_RELATIVE: 32 as number,
  ON_AGENT_START: 64 as number,
  ON_IDLE: 128 as number,
};

// Subday frequency type constants
const SUBDAY_TYPE = {
  AT_TIME: 1 as number,
  SECONDS: 2 as number,
  MINUTES: 4 as number,
  HOURS: 8 as number,
};

// Day of week bitmask for SQL Server schedules
const DOW_BITMASK = {
  SUNDAY: 1,
  MONDAY: 2,
  TUESDAY: 4,
  WEDNESDAY: 8,
  THURSDAY: 16,
  FRIDAY: 32,
  SATURDAY: 64,
} as const;

// Run status codes
const RUN_STATUS = {
  FAILED: 0,
  SUCCEEDED: 1,
  RETRY: 2,
  CANCELLED: 3,
  IN_PROGRESS: 4,
} as const;

export interface AgentJobSchedule {
  schedule_id: number;
  schedule_name: string;
  enabled: boolean;
  freq_type: string;
  freq_interval: number;
  freq_subday_type: string;
  freq_subday_interval: number;
  active_start_date: number;
  active_end_date: number;
  active_start_time: number;
  active_end_time: number;
  next_run_date: number | null;
  next_run_time: number | null;
  schedule_description: string;
}

export interface AgentJobStep {
  step_id: number;
  step_name: string;
  subsystem: string;
  command: string;
  database_name: string;
  on_success_action: number;
  on_fail_action: number;
  retry_attempts: number;
  retry_interval: number;
}

export interface AgentJob {
  job_id: string;
  job_name: string;
  description: string | null;
  enabled: boolean;
  date_created: Date;
  date_modified: Date;
  owner: string;
  category: string;
  current_status: string;
  last_run_date: string | null;
  last_run_time: string | null;
  last_run_status: string | null;
  last_run_duration: string | null;
  next_run_date: string | null;
  next_run_time: string | null;
  step_count: number;
  has_schedule: boolean;
  on_success_action?: number;
  on_fail_action?: number;
  success_count?: number;
  fail_count?: number;
  schedules?: AgentJobSchedule[];
  steps?: AgentJobStep[];
}

export interface AgentJobListResult {
  jobs: AgentJob[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

export interface AgentJobHistory {
  job_name: string;
  step_id: number;
  step_name: string;
  status: string;
  run_date: string | null;
  run_time: string | null;
  run_duration: string | null;
  message: string;
}

export interface EmailNotificationConfig {
  enabled: boolean;
  from_email?: string;
  to_email: string;        // Multiple recipients separated by semicolon
  cc_email?: string;       // CC recipients separated by semicolon
  bcc_email?: string;      // BCC recipients separated by semicolon
  subject?: string;
  body?: string;
  attach_results?: boolean;
  attachment_filename?: string;
}

export interface CreateAgentJobInput {
  job_name: string;
  description?: string;
  step_command?: string;
  step_name?: string;
  database_name?: string;
  enabled?: boolean;
  category?: string;
  schedule_cron?: string; // Cron expression (min hr day mon dow)
  email_notification?: EmailNotificationConfig;
}

// Parse cron expression and convert to SQL Server Agent schedule parameters
// Cron format: minute hour day month dayofweek
// Examples: "0 8 * * *" = Daily at 8AM, "0 0 * * 0" = Weekly Sunday, "*/5 * * * *" = Every 5 min
interface ScheduleParams {
  freq_type: number;
  freq_interval: number;
  freq_subday_type: number;
  freq_subday_interval: number;
  active_start_time: number;
}

function parseCronToSchedule(cron: string): ScheduleParams {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error('Invalid cron expression. Expected 5 parts: minute hour day month dayofweek');
  }

  const [minute, hour, day, month, dayOfWeek] = parts;

  // Default: Daily at specified time
  let freq_type = FREQ_TYPE.DAILY;
  let freq_interval = 1; // Every day
  let freq_subday_type = SUBDAY_TYPE.AT_TIME;
  let freq_subday_interval = 0;
  let active_start_time = 0;

  // Parse minute for subday scheduling (e.g., */5 = every 5 minutes)
  if (minute.startsWith('*/')) {
    const interval = parseInt(minute.slice(2));
    if (!isNaN(interval) && interval > 0) {
      freq_subday_type = SUBDAY_TYPE.MINUTES;
      freq_subday_interval = interval;
      active_start_time = 0; // Start at midnight
    }
  } else if (hour.startsWith('*/')) {
    // Every N hours
    const interval = parseInt(hour.slice(2));
    if (!isNaN(interval) && interval > 0) {
      freq_subday_type = SUBDAY_TYPE.HOURS;
      freq_subday_interval = interval;
      active_start_time = 0;
    }
  } else {
    // Specific time
    const hourNum = hour === '*' ? 0 : parseInt(hour);
    const minuteNum = minute === '*' ? 0 : parseInt(minute);
    active_start_time = (hourNum * 10000) + (minuteNum * 100); // HHMMSS format
  }

  // Check for weekly schedule (specific day of week)
  if (dayOfWeek !== '*') {
    freq_type = FREQ_TYPE.WEEKLY;
    // Convert cron day of week (0=Sunday) to SQL Server bitmask
    const cronDow = parseInt(dayOfWeek);
    if (!isNaN(cronDow)) {
      const sqlDowMap: Record<number, number> = {
        0: DOW_BITMASK.SUNDAY,
        1: DOW_BITMASK.MONDAY,
        2: DOW_BITMASK.TUESDAY,
        3: DOW_BITMASK.WEDNESDAY,
        4: DOW_BITMASK.THURSDAY,
        5: DOW_BITMASK.FRIDAY,
        6: DOW_BITMASK.SATURDAY,
      };
      freq_interval = sqlDowMap[cronDow] || DOW_BITMASK.SUNDAY;
    }
  }

  // Check for monthly schedule (specific day of month)
  if (day !== '*' && dayOfWeek === '*') {
    freq_type = FREQ_TYPE.MONTHLY;
    freq_interval = parseInt(day) || 1; // Day of month
  }

  return {
    freq_type,
    freq_interval,
    freq_subday_type,
    freq_subday_interval,
    active_start_time,
  };
}

export interface UpdateAgentJobInput {
  new_name?: string;
  description?: string;
  enabled?: boolean;
  step_command?: string;
  step_name?: string;
  database_name?: string;
}

// Helper function to ensure job_id is a proper GUID string
// The mssql driver returns uniqueidentifier as a string already
function toGuidString(jobId: any): string {
  if (typeof jobId === 'string') {
    return jobId.toUpperCase();
  }
  // If it's a buffer (older driver versions), convert it
  if (Buffer.isBuffer(jobId)) {
    const hex = jobId.toString('hex').toUpperCase();
    const p1 = hex.slice(0, 8).match(/../g)?.reverse().join('') || '';
    const p2 = hex.slice(8, 12).match(/../g)?.reverse().join('') || '';
    const p3 = hex.slice(12, 16).match(/../g)?.reverse().join('') || '';
    const p4 = hex.slice(16, 20);
    const p5 = hex.slice(20);
    return `${p1}-${p2}-${p3}-${p4}-${p5}`;
  }
  return String(jobId);
}

// Helper function to format time from SQL Server integer (HHMMSS)
function formatTime(time: number | null): string | null {
  if (time === null || time === undefined) return null;
  const timeStr = time.toString().padStart(6, '0');
  return `${timeStr.slice(0, 2)}:${timeStr.slice(2, 4)}:${timeStr.slice(4, 6)}`;
}

// Helper function to format date from SQL Server integer (YYYYMMDD)
function formatDate(date: number | null): string | null {
  if (date === null || date === undefined || date === 0) return null;
  const dateStr = date.toString();
  return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
}

// Helper function to format duration (HHMMSS format)
function formatDuration(duration: number | null): string | null {
  if (duration === null || duration === undefined) return null;
  const durStr = duration.toString().padStart(6, '0');
  const hours = parseInt(durStr.slice(0, 2));
  const minutes = parseInt(durStr.slice(2, 4));
  const seconds = parseInt(durStr.slice(4, 6));
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

// Helper function to get frequency type description
function getFreqTypeDescription(freqType: number): string {
  const types: Record<number, string> = {
    [FREQ_TYPE.ONCE]: 'Once',
    [FREQ_TYPE.DAILY]: 'Daily',
    [FREQ_TYPE.WEEKLY]: 'Weekly',
    [FREQ_TYPE.MONTHLY]: 'Monthly',
    [FREQ_TYPE.MONTHLY_RELATIVE]: 'Monthly (relative)',
    [FREQ_TYPE.ON_AGENT_START]: 'When SQL Server Agent starts',
    [FREQ_TYPE.ON_IDLE]: 'When computer is idle',
  };
  return types[freqType] || 'Unknown';
}

// Helper function to get subday type description
function getSubdayTypeDescription(subdayType: number): string {
  const types: Record<number, string> = {
    [SUBDAY_TYPE.AT_TIME]: 'At the specified time',
    [SUBDAY_TYPE.SECONDS]: 'Seconds',
    [SUBDAY_TYPE.MINUTES]: 'Minutes',
    [SUBDAY_TYPE.HOURS]: 'Hours',
  };
  return types[subdayType] || 'Unknown';
}

// Map run status code to string
function mapRunStatus(status: number | null): string | null {
  if (status === null || status === undefined) return null;
  const statusMap: Record<number, string> = {
    [RUN_STATUS.FAILED]: 'Failed',
    [RUN_STATUS.SUCCEEDED]: 'Succeeded',
    [RUN_STATUS.RETRY]: 'Retry',
    [RUN_STATUS.CANCELLED]: 'Cancelled',
    [RUN_STATUS.IN_PROGRESS]: 'In Progress',
  };
  return statusMap[status] ?? 'Unknown';
}

export async function listAgentJobs(
  page: number = 1,
  limit: number = 10
): Promise<AgentJobListResult> {
  const pool = await getPool();
  const offset = (page - 1) * limit;

  // Get total count
  const countResult = await pool.request().query(`
    SELECT COUNT(*) AS total FROM msdb.dbo.sysjobs
  `);
  const total = countResult.recordset[0].total;

  // Get jobs with full information including last run, next run, step count
  // Using parameterized query for offset and limit
  const result = await pool.request()
    .input('offset', sql.Int, offset)
    .input('limit', sql.Int, limit)
    .query(`
    WITH LastRun AS (
      SELECT
        job_id,
        run_date,
        run_time,
        run_status,
        run_duration,
        ROW_NUMBER() OVER (PARTITION BY job_id ORDER BY run_date DESC, run_time DESC) AS rn
      FROM msdb.dbo.sysjobhistory
      WHERE step_id = 0
    ),
    NextRun AS (
      SELECT
        js.job_id,
        MIN(CAST(js.next_run_date AS VARCHAR) + RIGHT('000000' + CAST(js.next_run_time AS VARCHAR), 6)) AS next_run
      FROM msdb.dbo.sysjobschedules js
      WHERE js.next_run_date > 0
      GROUP BY js.job_id
    ),
    StepCount AS (
      SELECT job_id, COUNT(*) AS step_count
      FROM msdb.dbo.sysjobsteps
      GROUP BY job_id
    ),
    ScheduleCount AS (
      SELECT job_id, COUNT(*) AS schedule_count
      FROM msdb.dbo.sysjobschedules
      GROUP BY job_id
    ),
    RunningJobs AS (
      SELECT DISTINCT job_id
      FROM msdb.dbo.sysjobactivity
      WHERE run_requested_date IS NOT NULL AND stop_execution_date IS NULL
    ),
    FirstStep AS (
      SELECT job_id, on_success_action, on_fail_action
      FROM msdb.dbo.sysjobsteps
      WHERE step_id = 1
    ),
    JobStats AS (
      SELECT
        job_id,
        SUM(CASE WHEN run_status = 1 THEN 1 ELSE 0 END) AS success_count,
        SUM(CASE WHEN run_status = 0 THEN 1 ELSE 0 END) AS fail_count
      FROM msdb.dbo.sysjobhistory
      WHERE step_id = 0
      GROUP BY job_id
    )
    SELECT
      j.job_id,
      j.name AS job_name,
      j.description,
      j.enabled,
      j.date_created,
      j.date_modified,
      SUSER_SNAME(j.owner_sid) AS owner,
      c.name AS category,
      CASE WHEN rj.job_id IS NOT NULL THEN 'Running' ELSE 'Idle' END AS current_status,
      lr.run_date AS last_run_date,
      lr.run_time AS last_run_time,
      lr.run_status AS last_run_status,
      lr.run_duration AS last_run_duration,
      CASE WHEN nr.next_run IS NOT NULL THEN LEFT(nr.next_run, 8) ELSE NULL END AS next_run_date,
      CASE WHEN nr.next_run IS NOT NULL THEN RIGHT(nr.next_run, 6) ELSE NULL END AS next_run_time,
      ISNULL(sc.step_count, 0) AS step_count,
      CASE WHEN ISNULL(schc.schedule_count, 0) > 0 THEN 1 ELSE 0 END AS has_schedule,
      fs.on_success_action,
      fs.on_fail_action,
      ISNULL(js.success_count, 0) AS success_count,
      ISNULL(js.fail_count, 0) AS fail_count
    FROM msdb.dbo.sysjobs j
    LEFT JOIN msdb.dbo.syscategories c ON j.category_id = c.category_id
    LEFT JOIN LastRun lr ON j.job_id = lr.job_id AND lr.rn = 1
    LEFT JOIN NextRun nr ON j.job_id = nr.job_id
    LEFT JOIN StepCount sc ON j.job_id = sc.job_id
    LEFT JOIN ScheduleCount schc ON j.job_id = schc.job_id
    LEFT JOIN RunningJobs rj ON j.job_id = rj.job_id
    LEFT JOIN FirstStep fs ON j.job_id = fs.job_id
    LEFT JOIN JobStats js ON j.job_id = js.job_id
    ORDER BY j.date_modified DESC, j.name
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `);

  const totalPages = Math.ceil(total / limit);

  const jobs = result.recordset.map((row: any) => ({
    job_id: toGuidString(row.job_id),
    job_name: row.job_name,
    description: row.description,
    enabled: row.enabled === 1,
    date_created: row.date_created,
    date_modified: row.date_modified,
    owner: row.owner,
    category: row.category,
    current_status: row.current_status,
    last_run_date: formatDate(row.last_run_date),
    last_run_time: formatTime(row.last_run_time),
    last_run_status: mapRunStatus(row.last_run_status),
    last_run_duration: formatDuration(row.last_run_duration),
    next_run_date: row.next_run_date ? formatDate(parseInt(row.next_run_date)) : null,
    next_run_time: row.next_run_time ? formatTime(parseInt(row.next_run_time)) : null,
    step_count: row.step_count,
    has_schedule: row.has_schedule === 1,
    on_success_action: row.on_success_action,
    on_fail_action: row.on_fail_action,
    success_count: row.success_count,
    fail_count: row.fail_count,
  }));

  return {
    jobs,
    pagination: {
      page,
      limit,
      total,
      total_pages: totalPages,
      has_next: page < totalPages,
      has_prev: page > 1,
    },
  };
}

export async function getAgentJob(jobName: string): Promise<AgentJob | null> {
  const pool = await getPool();

  // Get job details with last run info using parameterized query
  const jobResult = await pool.request()
    .input('jobName', sql.NVarChar(128), jobName)
    .query(`
    WITH LastRun AS (
      SELECT
        job_id,
        run_date,
        run_time,
        run_status,
        run_duration,
        ROW_NUMBER() OVER (PARTITION BY job_id ORDER BY run_date DESC, run_time DESC) AS rn
      FROM msdb.dbo.sysjobhistory
      WHERE step_id = 0
    ),
    RunningJobs AS (
      SELECT DISTINCT job_id
      FROM msdb.dbo.sysjobactivity
      WHERE run_requested_date IS NOT NULL AND stop_execution_date IS NULL
    )
    SELECT
      j.job_id,
      j.name AS job_name,
      j.description,
      j.enabled,
      j.date_created,
      j.date_modified,
      SUSER_SNAME(j.owner_sid) AS owner,
      c.name AS category,
      CASE WHEN rj.job_id IS NOT NULL THEN 'Running' ELSE 'Idle' END AS current_status,
      lr.run_date AS last_run_date,
      lr.run_time AS last_run_time,
      lr.run_status AS last_run_status,
      lr.run_duration AS last_run_duration
    FROM msdb.dbo.sysjobs j
    LEFT JOIN msdb.dbo.syscategories c ON j.category_id = c.category_id
    LEFT JOIN LastRun lr ON j.job_id = lr.job_id AND lr.rn = 1
    LEFT JOIN RunningJobs rj ON j.job_id = rj.job_id
    WHERE j.name = @jobName
  `);

  if (jobResult.recordset.length === 0) {
    return null;
  }

  const row = jobResult.recordset[0];
  const jobId = row.job_id;
  // Convert Buffer to GUID string format for SQL Server
  const jobIdGuid = toGuidString(jobId);

  // Get job steps using parameterized query
  const stepsResult = await pool.request()
    .input('jobId', sql.UniqueIdentifier, jobIdGuid)
    .query(`
    SELECT
      step_id,
      step_name,
      subsystem,
      command,
      database_name,
      on_success_action,
      on_fail_action,
      retry_attempts,
      retry_interval
    FROM msdb.dbo.sysjobsteps
    WHERE job_id = @jobId
    ORDER BY step_id
  `);

  const steps: AgentJobStep[] = stepsResult.recordset.map((s: any) => ({
    step_id: s.step_id,
    step_name: s.step_name,
    subsystem: s.subsystem,
    command: s.command,
    database_name: s.database_name,
    on_success_action: s.on_success_action,
    on_fail_action: s.on_fail_action,
    retry_attempts: s.retry_attempts,
    retry_interval: s.retry_interval,
  }));

  // Get job schedules using parameterized query
  const schedulesResult = await pool.request()
    .input('jobId', sql.UniqueIdentifier, jobIdGuid)
    .query(`
    SELECT
      s.schedule_id,
      s.name AS schedule_name,
      s.enabled,
      s.freq_type,
      s.freq_interval,
      s.freq_subday_type,
      s.freq_subday_interval,
      s.active_start_date,
      s.active_end_date,
      s.active_start_time,
      s.active_end_time,
      js.next_run_date,
      js.next_run_time
    FROM msdb.dbo.sysjobschedules js
    JOIN msdb.dbo.sysschedules s ON js.schedule_id = s.schedule_id
    WHERE js.job_id = @jobId
  `);

  const schedules: AgentJobSchedule[] = schedulesResult.recordset.map((s: any) => ({
    schedule_id: s.schedule_id,
    schedule_name: s.schedule_name,
    enabled: s.enabled === 1,
    freq_type: getFreqTypeDescription(s.freq_type),
    freq_interval: s.freq_interval,
    freq_subday_type: getSubdayTypeDescription(s.freq_subday_type),
    freq_subday_interval: s.freq_subday_interval,
    active_start_date: s.active_start_date,
    active_end_date: s.active_end_date,
    active_start_time: s.active_start_time,
    active_end_time: s.active_end_time,
    next_run_date: s.next_run_date,
    next_run_time: s.next_run_time,
    schedule_description: buildScheduleDescription(s),
  }));

  // Get next run time from schedules
  let nextRunDate: string | null = null;
  let nextRunTime: string | null = null;
  if (schedules.length > 0) {
    const nextSchedule = schedulesResult.recordset.find((s: any) => s.next_run_date > 0);
    if (nextSchedule) {
      nextRunDate = formatDate(nextSchedule.next_run_date);
      nextRunTime = formatTime(nextSchedule.next_run_time);
    }
  }

  return {
    job_id: jobIdGuid,
    job_name: row.job_name,
    description: row.description,
    enabled: row.enabled === 1,
    date_created: row.date_created,
    date_modified: row.date_modified,
    owner: row.owner,
    category: row.category,
    current_status: row.current_status,
    last_run_date: formatDate(row.last_run_date),
    last_run_time: formatTime(row.last_run_time),
    last_run_status: mapRunStatus(row.last_run_status),
    last_run_duration: formatDuration(row.last_run_duration),
    next_run_date: nextRunDate,
    next_run_time: nextRunTime,
    step_count: steps.length,
    has_schedule: schedules.length > 0,
    steps,
    schedules,
  };
}

// Helper to build human-readable schedule description
function buildScheduleDescription(schedule: any): string {
  const freqType = getFreqTypeDescription(schedule.freq_type);
  const startTime = formatTime(schedule.active_start_time);

  let desc = freqType;
  if (startTime) {
    desc += ` at ${startTime}`;
  }
  if (schedule.freq_subday_interval > 0 && schedule.freq_subday_type > SUBDAY_TYPE.AT_TIME) {
    const subdayType = getSubdayTypeDescription(schedule.freq_subday_type);
    desc += ` every ${schedule.freq_subday_interval} ${subdayType.toLowerCase()}`;
  }
  return desc;
}

// Generate T-SQL command with optional email notification
function generateStepCommand(
  query: string,
  emailConfig?: EmailNotificationConfig
): string {
  if (!emailConfig?.enabled) {
    return query;
  }

  const fromEmail = emailConfig.from_email || 'BI-Alert@alrajhibank.com.my';
  const toEmail = emailConfig.to_email;
  const ccEmail = emailConfig.cc_email || '';
  const bccEmail = emailConfig.bcc_email || '';
  const subject = emailConfig.subject || 'SQL Server Agent Job Results';
  const body = emailConfig.body || 'Hi,\n\nPlease find attached the query results.\n\nRegards,\nBI Team';
  const filename = emailConfig.attachment_filename || 'QueryResults.csv';

  // Build optional CC/BCC parameters
  let ccParam = '';
  let bccParam = '';
  if (ccEmail.trim()) {
    ccParam = `\n    @copy_recipients = '${ccEmail.replace(/'/g, "''")}',`;
  }
  if (bccEmail.trim()) {
    bccParam = `\n    @blind_copy_recipients = '${bccEmail.replace(/'/g, "''")}',`;
  }

  // Use sp_send_dbmail with query results as attachment
  const emailCommand = `
    -- Execute query and send results via email
    EXEC msdb.dbo.sp_send_dbmail
      @from_address = '${fromEmail.replace(/'/g, "''")}',
      @recipients = '${toEmail.replace(/'/g, "''")}',${ccParam}${bccParam}
      @subject = N'${subject.replace(/'/g, "''")}',
      @body = N'${body.replace(/'/g, "''")}',
      @body_format = 'HTML',
      @query = N'${query.replace(/'/g, "''")}',
      @attach_query_result_as_file = 1,
      @query_attachment_filename = '${filename.replace(/'/g, "''")}',
      @query_result_header = 1,
      @query_result_separator = ',',
      @query_result_width = 32767,
      @query_result_no_padding = 1;
  `;

  return emailCommand.trim();
}

export async function createAgentJob(input: CreateAgentJobInput): Promise<AgentJob> {
  const pool = await getPool();
  const {
    job_name,
    description = '',
    step_command = '',
    step_name,
    database_name,
    enabled = true,
    category = '[Uncategorized (Local)]',
    schedule_cron,
    email_notification,
  } = input;

  // Check if job already exists using parameterized query
  const existsResult = await pool.request()
    .input('jobName', sql.NVarChar(128), job_name)
    .query(`SELECT 1 FROM msdb.dbo.sysjobs WHERE name = @jobName`);

  if (existsResult.recordset.length > 0) {
    throw new Error(`Job '${job_name}' already exists. Use update to modify it.`);
  }

  const ownerLogin = dbUser;

  // Create the job using parameterized stored procedure call
  await pool.request()
    .input('job_name', sql.NVarChar(128), job_name)
    .input('description', sql.NVarChar(512), description)
    .input('category_name', sql.NVarChar(128), category)
    .input('owner_login_name', sql.NVarChar(128), ownerLogin)
    .input('enabled', sql.Bit, enabled ? 1 : 0)
    .execute('msdb.dbo.sp_add_job');

  // Add job step if command provided
  if (step_command) {
    const actualStepName = step_name || `${job_name}_Step1`;
    const actualDatabase = database_name || process.env.SQLSERVER_DATABASE || 'Staging';

    // Generate command with email notification if configured
    const finalCommand = generateStepCommand(step_command, email_notification);

    await pool.request()
      .input('job_name', sql.NVarChar(128), job_name)
      .input('step_name', sql.NVarChar(128), actualStepName)
      .input('subsystem', sql.NVarChar(40), 'TSQL')
      .input('command', sql.NVarChar(sql.MAX), finalCommand)
      .input('database_name', sql.NVarChar(128), actualDatabase)
      .input('retry_attempts', sql.Int, 0)
      .input('retry_interval', sql.Int, 0)
      .input('on_success_action', sql.TinyInt, 1)
      .input('on_fail_action', sql.TinyInt, 2)
      .execute('msdb.dbo.sp_add_jobstep');

    console.log(`Job step created${email_notification?.enabled ? ' with email notification' : ''}`);
  }

  // Add job to server FIRST (required before adding schedule)
  await pool.request()
    .input('job_name', sql.NVarChar(128), job_name)
    .input('server_name', sql.NVarChar(128), '(local)')
    .execute('msdb.dbo.sp_add_jobserver');

  // Add schedule if cron expression provided (AFTER job is added to server)
  if (schedule_cron) {
    try {
      const scheduleParams = parseCronToSchedule(schedule_cron);
      const scheduleName = `${job_name}_Schedule`;

      // Get today's date in YYYYMMDD format for active_start_date
      const today = new Date();
      const activeStartDate = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();

      console.log(`Creating schedule for job '${job_name}': cron=${schedule_cron}, params=`, scheduleParams);

      await pool.request()
        .input('job_name', sql.NVarChar(128), job_name)
        .input('name', sql.NVarChar(128), scheduleName)
        .input('enabled', sql.Bit, 1)
        .input('freq_type', sql.Int, scheduleParams.freq_type)
        .input('freq_interval', sql.Int, scheduleParams.freq_interval)
        .input('freq_subday_type', sql.Int, scheduleParams.freq_subday_type)
        .input('freq_subday_interval', sql.Int, scheduleParams.freq_subday_interval)
        .input('active_start_date', sql.Int, activeStartDate)
        .input('active_start_time', sql.Int, scheduleParams.active_start_time)
        .execute('msdb.dbo.sp_add_jobschedule');

      console.log(`Schedule created successfully for job '${job_name}'`);
    } catch (scheduleError: any) {
      console.error(`Failed to create schedule for job '${job_name}':`, scheduleError.message);
      // Continue without schedule - job is still created
    }
  }

  const job = await getAgentJob(job_name);
  if (!job) {
    throw new Error('Failed to retrieve created job');
  }
  return job;
}

export async function updateAgentJob(
  jobName: string,
  input: UpdateAgentJobInput
): Promise<AgentJob> {
  const pool = await getPool();
  const { new_name, description, enabled, step_command, step_name, database_name } = input;

  // Check if job exists using parameterized query
  const existsResult = await pool.request()
    .input('jobName', sql.NVarChar(128), jobName)
    .query(`SELECT job_id FROM msdb.dbo.sysjobs WHERE name = @jobName`);

  if (existsResult.recordset.length === 0) {
    throw new Error(`Job '${jobName}' not found.`);
  }

  const jobId = existsResult.recordset[0].job_id;
  const jobIdGuid = toGuidString(jobId);

  // Update job properties using parameterized stored procedure
  if (new_name !== undefined || description !== undefined || enabled !== undefined) {
    const request = pool.request()
      .input('job_id', sql.UniqueIdentifier, jobIdGuid);

    if (new_name !== undefined) {
      request.input('new_name', sql.NVarChar(128), new_name);
    }
    if (description !== undefined) {
      request.input('description', sql.NVarChar(512), description);
    }
    if (enabled !== undefined) {
      request.input('enabled', sql.Bit, enabled ? 1 : 0);
    }

    // Build dynamic SQL for sp_update_job since it has many optional parameters
    let updateQuery = `EXEC msdb.dbo.sp_update_job @job_id = @job_id`;
    if (new_name !== undefined) updateQuery += `, @new_name = @new_name`;
    if (description !== undefined) updateQuery += `, @description = @description`;
    if (enabled !== undefined) updateQuery += `, @enabled = @enabled`;

    await request.query(updateQuery);
  }

  // Update step if any step properties provided
  if (step_command !== undefined || step_name !== undefined || database_name !== undefined) {
    try {
      const request = pool.request()
        .input('job_id', sql.UniqueIdentifier, jobIdGuid)
        .input('step_id', sql.Int, 1);

      let updateStepQuery = `EXEC msdb.dbo.sp_update_jobstep @job_id = @job_id, @step_id = @step_id`;

      if (step_name !== undefined) {
        request.input('step_name', sql.NVarChar(128), step_name);
        updateStepQuery += `, @step_name = @step_name`;
      }
      if (step_command !== undefined) {
        request.input('command', sql.NVarChar(sql.MAX), step_command);
        updateStepQuery += `, @command = @command`;
      }
      if (database_name !== undefined) {
        request.input('database_name', sql.NVarChar(128), database_name);
        updateStepQuery += `, @database_name = @database_name`;
      }

      await request.query(updateStepQuery);
    } catch (error: any) {
      // Step update may fail due to permissions - continue with job update
      console.warn(`Failed to update job step: ${error.message}`);
    }
  }

  const finalName = new_name ?? jobName;
  const job = await getAgentJob(finalName);
  if (!job) {
    throw new Error('Failed to retrieve updated job');
  }
  return job;
}

export async function startAgentJob(jobName: string): Promise<{ job_name: string; status: string; message: string }> {
  const pool = await getPool();

  // Check if job exists using parameterized query
  const existsResult = await pool.request()
    .input('jobName', sql.NVarChar(128), jobName)
    .query(`SELECT 1 FROM msdb.dbo.sysjobs WHERE name = @jobName`);

  if (existsResult.recordset.length === 0) {
    throw new Error(`Job '${jobName}' not found.`);
  }

  // Start job using parameterized stored procedure
  await pool.request()
    .input('job_name', sql.NVarChar(128), jobName)
    .execute('msdb.dbo.sp_start_job');

  return {
    job_name: jobName,
    status: 'started',
    message: `Job '${jobName}' started successfully.`,
  };
}

export async function stopAgentJob(jobName: string): Promise<{ job_name: string; status: string; message: string }> {
  const pool = await getPool();

  // Check if job exists using parameterized query
  const existsResult = await pool.request()
    .input('jobName', sql.NVarChar(128), jobName)
    .query(`SELECT 1 FROM msdb.dbo.sysjobs WHERE name = @jobName`);

  if (existsResult.recordset.length === 0) {
    throw new Error(`Job '${jobName}' not found.`);
  }

  // Stop job using parameterized stored procedure
  await pool.request()
    .input('job_name', sql.NVarChar(128), jobName)
    .execute('msdb.dbo.sp_stop_job');

  return {
    job_name: jobName,
    status: 'stopped',
    message: `Job '${jobName}' stopped successfully.`,
  };
}

export async function getAgentJobHistory(jobName: string, limit: number = 50): Promise<AgentJobHistory[]> {
  const pool = await getPool();

  // Get job history using parameterized query
  const result = await pool.request()
    .input('jobName', sql.NVarChar(128), jobName)
    .input('limit', sql.Int, limit)
    .query(`
    SELECT TOP (@limit)
      j.name AS job_name,
      h.step_id,
      h.step_name,
      h.run_status,
      h.run_date,
      h.run_time,
      h.run_duration,
      h.message
    FROM msdb.dbo.sysjobhistory h
    JOIN msdb.dbo.sysjobs j ON h.job_id = j.job_id
    WHERE j.name = @jobName
    ORDER BY h.run_date DESC, h.run_time DESC, h.step_id ASC
  `);

  return result.recordset.map((row: any) => ({
    job_name: row.job_name,
    step_id: row.step_id,
    step_name: row.step_name,
    status: mapRunStatus(row.run_status) || 'Unknown',
    run_date: formatDate(row.run_date),
    run_time: formatTime(row.run_time),
    run_duration: formatDuration(row.run_duration),
    message: row.message,
  }));
}

export interface AllJobHistoryResult {
  history: AgentJobHistory[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

/**
 * Get unique job owners from execution history
 */
export async function getJobOwners(): Promise<string[]> {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT DISTINCT SUSER_SNAME(j.owner_sid) AS owner
    FROM msdb.dbo.sysjobs j
    WHERE SUSER_SNAME(j.owner_sid) IS NOT NULL
    ORDER BY owner
  `);
  return result.recordset.map((row: any) => row.owner).filter(Boolean);
}

/**
 * Get execution history across all jobs with pagination and filtering
 */
export async function getAllAgentJobHistory(
  page: number = 1,
  limit: number = 50,
  filters?: {
    job_name?: string;
    status?: string;
    date_from?: string;
    date_to?: string;
    owner?: string;
    sort_by?: 'run_date' | 'duration';
    sort_dir?: 'asc' | 'desc';
  }
): Promise<AllJobHistoryResult> {
  const pool = await getPool();
  const offset = (page - 1) * limit;

  // Build WHERE clause for filters
  let whereClause = 'WHERE h.step_id = 0'; // Only job-level outcomes, not step-level
  const filterParams: Record<string, any> = {};

  if (filters?.job_name) {
    whereClause += ' AND j.name LIKE @jobName';
    filterParams.jobName = `%${filters.job_name}%`;
  }

  if (filters?.status) {
    const statusMap: Record<string, number> = {
      'Failed': 0,
      'Succeeded': 1,
      'Retry': 2,
      'Cancelled': 3,
      'In Progress': 4,
    };
    if (statusMap[filters.status] !== undefined) {
      whereClause += ' AND h.run_status = @runStatus';
      filterParams.runStatus = statusMap[filters.status];
    }
  }

  if (filters?.date_from) {
    whereClause += ' AND h.run_date >= @dateFrom';
    filterParams.dateFrom = parseInt(filters.date_from.replace(/-/g, ''));
  }

  if (filters?.date_to) {
    whereClause += ' AND h.run_date <= @dateTo';
    filterParams.dateTo = parseInt(filters.date_to.replace(/-/g, ''));
  }

  if (filters?.owner) {
    whereClause += ' AND SUSER_SNAME(j.owner_sid) LIKE @owner';
    filterParams.owner = `%${filters.owner}%`;
  }

  // Build ORDER BY clause
  let orderByClause = 'ORDER BY h.run_date DESC, h.run_time DESC';
  if (filters?.sort_by === 'duration') {
    orderByClause = `ORDER BY h.run_duration ${filters.sort_dir === 'asc' ? 'ASC' : 'DESC'}`;
  } else if (filters?.sort_by === 'run_date') {
    orderByClause = `ORDER BY h.run_date ${filters.sort_dir === 'asc' ? 'ASC' : 'DESC'}, h.run_time ${filters.sort_dir === 'asc' ? 'ASC' : 'DESC'}`;
  }

  // Get total count
  const countRequest = pool.request();
  for (const [key, value] of Object.entries(filterParams)) {
    if (key === 'jobName' || key === 'owner') {
      countRequest.input(key, sql.NVarChar(128), value);
    } else if (key === 'runStatus' || key === 'dateFrom' || key === 'dateTo') {
      countRequest.input(key, sql.Int, value);
    }
  }

  const countResult = await countRequest.query(`
    SELECT COUNT(*) AS total
    FROM msdb.dbo.sysjobhistory h
    JOIN msdb.dbo.sysjobs j ON h.job_id = j.job_id
    ${whereClause}
  `);
  const total = countResult.recordset[0].total;

  // Get paginated results
  const dataRequest = pool.request()
    .input('offset', sql.Int, offset)
    .input('limit', sql.Int, limit);

  for (const [key, value] of Object.entries(filterParams)) {
    if (key === 'jobName' || key === 'owner') {
      dataRequest.input(key, sql.NVarChar(128), value);
    } else if (key === 'runStatus' || key === 'dateFrom' || key === 'dateTo') {
      dataRequest.input(key, sql.Int, value);
    }
  }

  const result = await dataRequest.query(`
    SELECT
      j.name AS job_name,
      h.step_id,
      h.step_name,
      h.run_status,
      h.run_date,
      h.run_time,
      h.run_duration,
      h.message,
      SUSER_SNAME(j.owner_sid) AS owner
    FROM msdb.dbo.sysjobhistory h
    JOIN msdb.dbo.sysjobs j ON h.job_id = j.job_id
    ${whereClause}
    ${orderByClause}
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `);

  const totalPages = Math.ceil(total / limit);

  const history = result.recordset.map((row: any) => ({
    job_name: row.job_name,
    step_id: row.step_id,
    step_name: row.step_name,
    status: mapRunStatus(row.run_status) || 'Unknown',
    run_date: formatDate(row.run_date),
    run_time: formatTime(row.run_time),
    run_duration: formatDuration(row.run_duration),
    message: row.message,
    owner: row.owner,
  }));

  return {
    history,
    pagination: {
      page,
      limit,
      total,
      total_pages: totalPages,
      has_next: page < totalPages,
      has_prev: page > 1,
    },
  };
}

/**
 * Delete a SQL Server Agent job and its execution history
 */
export async function deleteAgentJob(jobName: string): Promise<{ job_name: string; status: string; message: string }> {
  const pool = await getPool();

  // Check if job exists using parameterized query
  const existsResult = await pool.request()
    .input('jobName', sql.NVarChar(128), jobName)
    .query(`SELECT job_id FROM msdb.dbo.sysjobs WHERE name = @jobName`);

  if (existsResult.recordset.length === 0) {
    throw new Error(`Job '${jobName}' not found.`);
  }

  // Delete job using sp_delete_job stored procedure
  // This also deletes job history, steps, schedules, and alerts
  await pool.request()
    .input('job_name', sql.NVarChar(128), jobName)
    .input('delete_history', sql.Bit, 1)
    .input('delete_unused_schedule', sql.Bit, 1)
    .execute('msdb.dbo.sp_delete_job');

  return {
    job_name: jobName,
    status: 'deleted',
    message: `Job '${jobName}' and its execution history deleted successfully.`,
  };
}

/**
 * Check Database Mail configuration and available profiles
 */
export async function checkDatabaseMailConfig(): Promise<{
  enabled: boolean;
  profiles: Array<{ profile_name: string; is_default: boolean }>;
  accounts: Array<{ account_name: string; email_address: string }>;
}> {
  const pool = await getPool();

  // Check if Database Mail XPs are enabled
  const xpResult = await pool.request().query(`
    SELECT CONVERT(INT, value_in_use) AS enabled
    FROM sys.configurations
    WHERE name = 'Database Mail XPs'
  `);
  const enabled = xpResult.recordset[0]?.enabled === 1;

  // Get available profiles
  const profilesResult = await pool.request().query(`
    SELECT
      p.name AS profile_name,
      CASE WHEN pp.is_default = 1 THEN 1 ELSE 0 END AS is_default
    FROM msdb.dbo.sysmail_profile p
    LEFT JOIN msdb.dbo.sysmail_principalprofile pp
      ON p.profile_id = pp.profile_id
      AND pp.principal_sid = SUSER_SID()
    ORDER BY p.name
  `);

  // Get mail accounts
  const accountsResult = await pool.request().query(`
    SELECT name AS account_name, email_address
    FROM msdb.dbo.sysmail_account
    ORDER BY name
  `);

  return {
    enabled,
    profiles: profilesResult.recordset.map((r: any) => ({
      profile_name: r.profile_name,
      is_default: r.is_default === 1,
    })),
    accounts: accountsResult.recordset.map((r: any) => ({
      account_name: r.account_name,
      email_address: r.email_address,
    })),
  };
}

/**
 * Send a test email using SQL Server Database Mail
 */
export interface TestEmailInput {
  from_email: string;
  to_email: string;
  cc_email?: string;
  bcc_email?: string;
  subject: string;
  body: string;
  query?: string;
  attach_results?: boolean;
  attachment_filename?: string;
  profile_name?: string;  // Optional: specify profile explicitly
}

export async function sendTestEmail(input: TestEmailInput): Promise<{ success: boolean; message: string; mail_id?: number }> {
  const pool = await getPool();

  const {
    from_email,
    to_email,
    cc_email,
    bcc_email,
    subject,
    body,
    query,
    attach_results = false,
    attachment_filename = 'QueryResults.csv',
    profile_name,
  } = input;

  // Determine which profile to use
  let profileToUse = profile_name;

  // If no profile specified, try to find an available one
  if (!profileToUse) {
    try {
      const config = await checkDatabaseMailConfig();

      if (!config.enabled) {
        throw new Error('Database Mail XPs are not enabled on the server. Run: EXEC sp_configure \'Database Mail XPs\', 1; RECONFIGURE;');
      }

      if (config.profiles.length === 0) {
        throw new Error('No Database Mail profiles found. Please configure Database Mail on SQL Server.');
      }

      // Try to find a default profile first, otherwise use the first available
      const defaultProfile = config.profiles.find(p => p.is_default);
      profileToUse = defaultProfile?.profile_name || config.profiles[0].profile_name;

      console.log(`Using Database Mail profile: ${profileToUse}`);
    } catch (configError: any) {
      // If we can't check config, try without profile and let SQL Server handle it
      console.warn('Could not check Database Mail config:', configError.message);
    }
  }

  // Build the sp_send_dbmail parameters dynamically
  const params: string[] = [];

  // Add profile_name if we have one
  if (profileToUse) {
    params.push('@profile_name = @profile_name');
  }

  params.push('@from_address = @from_email');
  params.push('@recipients = @to_email');

  if (cc_email?.trim()) {
    params.push('@copy_recipients = @cc_email');
  }

  if (bcc_email?.trim()) {
    params.push('@blind_copy_recipients = @bcc_email');
  }

  params.push('@subject = @subject');
  params.push('@body = @body');
  params.push("@body_format = 'HTML'");

  // If query is provided and attach_results is true, add query attachment
  if (query?.trim() && attach_results) {
    params.push('@query = @query');
    params.push('@attach_query_result_as_file = 1');
    params.push('@query_attachment_filename = @filename');
    params.push('@query_result_header = 1');
    params.push("@query_result_separator = ','");
    params.push('@query_result_width = 32767');
    params.push('@query_result_no_padding = 1');
  }

  params.push('@mailitem_id = @mailitem_id OUTPUT');

  const emailQuery = `
    DECLARE @mailitem_id INT;
    EXEC msdb.dbo.sp_send_dbmail
      ${params.join(',\n      ')};
    SELECT @mailitem_id AS mail_id;`;

  try {
    const request = pool.request()
      .input('from_email', sql.NVarChar(255), from_email)
      .input('to_email', sql.NVarChar(sql.MAX), to_email)
      .input('subject', sql.NVarChar(255), subject)
      .input('body', sql.NVarChar(sql.MAX), body);

    if (profileToUse) {
      request.input('profile_name', sql.NVarChar(128), profileToUse);
    }

    if (cc_email?.trim()) {
      request.input('cc_email', sql.NVarChar(sql.MAX), cc_email);
    }

    if (bcc_email?.trim()) {
      request.input('bcc_email', sql.NVarChar(sql.MAX), bcc_email);
    }

    if (query?.trim() && attach_results) {
      request.input('query', sql.NVarChar(sql.MAX), query);
      request.input('filename', sql.NVarChar(255), attachment_filename);
    }

    const result = await request.query(emailQuery);
    const mailId = result.recordset?.[0]?.mail_id;

    return {
      success: true,
      message: `Test email sent successfully${mailId ? ` (Mail ID: ${mailId})` : ''} using profile: ${profileToUse || 'default'}`,
      mail_id: mailId,
    };
  } catch (error: any) {
    console.error('Error sending test email:', error);
    throw new Error(error.message || 'Failed to send test email');
  }
}
