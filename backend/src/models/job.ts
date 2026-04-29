import { z } from 'zod';

// Enums
export const JobType = z.enum(['workflow', 'function']);
export const ScheduleType = z.enum(['cron', 'interval', 'date']);
export const StepType = z.enum(['redshift_query', 'sqlserver_query', 'merge']);
export const ExecutionStatus = z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']);
export const OutputFormat = z.enum(['csv', 'excel', 'json']);
export const ErrorHandlingMode = z.enum(['stop', 'continue', 'retry']);
export const TriggerType = z.enum(['manual', 'scheduled']);

export type JobType = z.infer<typeof JobType>;
export type ScheduleType = z.infer<typeof ScheduleType>;
export type StepType = z.infer<typeof StepType>;
export type ExecutionStatus = z.infer<typeof ExecutionStatus>;
export type OutputFormat = z.infer<typeof OutputFormat>;
export type ErrorHandlingMode = z.infer<typeof ErrorHandlingMode>;
export type TriggerType = z.infer<typeof TriggerType>;

// Workflow Step Schema - supports both frontend format (id, name, type) and legacy format (step_number, step_name, step_type)
export const WorkflowStepSchema = z.object({
  // Frontend format
  id: z.string().optional(),
  name: z.string().optional(),
  type: StepType.optional(),
  // Legacy format
  step_number: z.number().optional(),
  step_name: z.string().optional(),
  step_type: StepType.optional(),
  // Common fields
  query: z.string().optional(),
  save_as: z.string().optional(),
  output_table: z.string().optional(),
  description: z.string().optional(),
  depends_on: z.array(z.string()).optional(),
  timeout_seconds: z.number().optional(),
  // Merge specific fields
  merge_type: z.enum(['union', 'union_all', 'inner_join', 'left_join']).optional(),
  source_tables: z.array(z.string()).optional(),
  join_keys: z.array(z.string()).optional(),
}).refine(
  (data) => (data.name || data.step_name) && (data.type || data.step_type),
  { message: "Step must have either (name, type) or (step_name, step_type)" }
);

export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;

// Schedule Config Schema
export const ScheduleConfigSchema = z.object({
  schedule_type: ScheduleType,
  cron_expression: z.string().optional(),
  interval_seconds: z.number().optional(),
  run_date: z.string().optional(), // ISO date string
  timezone: z.string().default('UTC'),
});

export type ScheduleConfig = z.infer<typeof ScheduleConfigSchema>;

// Error handling - supports both string and object format
export const ErrorHandlingSchema = z.union([
  ErrorHandlingMode,
  z.object({
    on_step_failure: ErrorHandlingMode.optional().default('stop'),
    notify_on_failure: z.boolean().optional().default(true),
    notify_on_success: z.boolean().optional().default(false),
  }),
]).transform((val) => {
  // Normalize to string format for storage
  if (typeof val === 'string') return val;
  return val.on_step_failure || 'stop';
});

// Workflow Definition Schema
export const WorkflowDefinitionSchema = z.object({
  version: z.string().optional(),
  steps: z.array(WorkflowStepSchema),
  error_handling: ErrorHandlingSchema.optional().default('stop'),
});

export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>;

// Create Job Request
export const CreateJobRequestSchema = z.object({
  job_name: z.string().min(1).max(255),
  description: z.string().optional(),
  job_type: JobType,
  schedule_config: ScheduleConfigSchema.optional(),
  workflow_definition: WorkflowDefinitionSchema.optional(),
  target_function: z.string().optional(),
  parameters: z.record(z.string(), z.unknown()).optional(),
  output_format: OutputFormat.default('csv'),
  author: z.string().optional(),
  is_active: z.boolean().default(true),
  max_retries: z.number().default(0),
  retry_delay_seconds: z.number().default(60),
  notify_on_success: z.boolean().default(false),
  notify_on_failure: z.boolean().default(true),
  timeout_seconds: z.number().optional(),
  tags: z.array(z.string()).optional(),
});

export type CreateJobRequest = z.infer<typeof CreateJobRequestSchema>;

// Update Job Request
export const UpdateJobRequestSchema = CreateJobRequestSchema.partial();
export type UpdateJobRequest = z.infer<typeof UpdateJobRequestSchema>;

// Job (full model from DB)
export interface Job {
  id: number;
  job_name: string;
  description: string | null;
  job_type: JobType;
  schedule_type: ScheduleType | null;
  schedule_config: ScheduleConfig | null;
  workflow_definition: WorkflowDefinition | null;
  target_function: string | null;
  parameters: Record<string, any> | null;
  output_format: OutputFormat;
  author: string | null;
  is_active: boolean;
  next_run_time: Date | null;
  last_run_time: Date | null;
  last_run_started_at: Date | null;
  last_run_completed_at: Date | null;
  last_run_status: ExecutionStatus | null;
  created_at: Date;
  updated_at: Date;
  max_retries: number;
  retry_delay_seconds: number;
  notify_on_success: boolean;
  notify_on_failure: boolean;
  timeout_seconds: number | null;
  tags: string[] | null;
}

// Step Result
export interface StepResult {
  step_number: number;
  step_name: string;
  step_type: StepType;
  status: ExecutionStatus;
  started_at: Date;
  completed_at: Date | null;
  duration_seconds: number | null;
  error_message: string | null;
  rows_returned: number | null;
  output_preview: any[] | null;
}

// Execution Record
export interface Execution {
  id: number;
  job_id: number;
  status: ExecutionStatus;
  trigger_type: TriggerType;
  started_at: Date;
  completed_at: Date | null;
  duration_seconds: number | null;
  error_message: string | null;
  output_file_path: string | null;
  output_file_size_bytes: number | null;
  rows_processed: number | null;
  step_results: StepResult[] | null;
}

// Schedule Job Request
export const ScheduleJobRequestSchema = z.object({
  schedule_config: ScheduleConfigSchema,
});

export type ScheduleJobRequest = z.infer<typeof ScheduleJobRequestSchema>;

// Run Job Request
export const RunJobRequestSchema = z.object({
  parameters: z.record(z.string(), z.unknown()).optional(),
});

export type RunJobRequest = z.infer<typeof RunJobRequestSchema>;

// Cron Validation Request
export const CronValidationRequestSchema = z.object({
  expression: z.string(),
});

export type CronValidationRequest = z.infer<typeof CronValidationRequestSchema>;
