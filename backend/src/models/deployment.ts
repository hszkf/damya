import { z } from 'zod';

export interface Deployment {
  id: string;
  name: string;
  job_name: string;
  description: string;

  sql_query: string;
  sql_tag: string;

  cron_expression: string;
  cron_description: string;

  email_to: string[];
  email_cc: string[];
  email_subject: string;

  glue_job_name: string;
  glue_trigger_name: string;
  worker_type: string;
  num_workers: number;
  glue_version: string;
  timeout_minutes: number;
  max_retries: number;

  s3_output_bucket: string;
  s3_output_prefix: string;

  status: 'draft' | 'deployed' | 'failed' | 'deleted';
  last_deployed_at: string | null;
  last_run_status: string | null;
  last_run_at: string | null;
  last_run_id: string | null;

  created_at: string;
  updated_at: string;
  author: string;
}

export interface JobRun {
  id: string;
  status: string;
  started_on: string | null;
  completed_on: string | null;
  execution_time: number;
  error_message: string | null;
  trigger_type: string;
  attempt: number;
}

export const CreateDeploymentSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional().default(''),
  sql_query: z.string().min(1),
  sql_tag: z.string().optional().default('main_sql'),
  cron_expression: z.string().min(9),
  email_to: z.array(z.string().email()).min(1),
  email_cc: z.array(z.string().email()).optional().default([]),
  email_subject: z.string().optional(),
  worker_type: z.enum(['G.1X', 'G.2X', 'G.025X']).optional().default('G.1X'),
  num_workers: z.number().min(1).max(100).optional().default(2),
  timeout_minutes: z.number().min(1).max(480).optional().default(10),
  author: z.string().optional().default('unknown'),
});

export const UpdateDeploymentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  sql_query: z.string().min(1).optional(),
  sql_tag: z.string().optional(),
  cron_expression: z.string().min(9).optional(),
  email_to: z.array(z.string().email()).min(1).optional(),
  email_cc: z.array(z.string().email()).optional(),
  email_subject: z.string().optional(),
  worker_type: z.enum(['G.1X', 'G.2X', 'G.025X']).optional(),
  num_workers: z.number().min(1).max(100).optional(),
  timeout_minutes: z.number().min(1).max(480).optional(),
});

export type CreateDeploymentInput = z.infer<typeof CreateDeploymentSchema>;
export type UpdateDeploymentInput = z.infer<typeof UpdateDeploymentSchema>;

const ACCOUNT_ID = '545009847083';
const REGION = 'ap-southeast-1';

export function generateJobName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `damya-${slug}`;
}

export function generateDefaults(input: CreateDeploymentInput): Partial<Deployment> {
  const jobName = generateJobName(input.name);
  return {
    job_name: jobName,
    description: input.description || '',
    sql_tag: input.sql_tag || 'main_sql',
    glue_job_name: jobName,
    glue_trigger_name: `sched-${jobName}`,
    worker_type: input.worker_type || 'G.1X',
    num_workers: input.num_workers || 2,
    glue_version: '5.0',
    timeout_minutes: input.timeout_minutes || 10,
    max_retries: 0,
    s3_output_bucket: `aws-glue-assets-${ACCOUNT_ID}-${REGION}`,
    s3_output_prefix: `src/damya/${jobName}`,
    email_subject: input.email_subject || `[${input.name}] Report Ready`,
    status: 'draft',
    last_deployed_at: null,
    last_run_status: null,
    last_run_at: null,
    last_run_id: null,
    author: input.author || 'unknown',
  };
}
