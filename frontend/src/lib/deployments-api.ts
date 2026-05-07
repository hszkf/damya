const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

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
  status: "draft" | "deployed" | "failed" | "deleted";
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

export interface CreateDeploymentRequest {
  name: string;
  description?: string;
  sql_query: string;
  cron_expression: string;
  email_to: string[];
  email_cc?: string[];
  email_subject?: string;
  worker_type?: string;
  num_workers?: number;
  timeout_minutes?: number;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}/deployments${path}`.replace(/\/$/, '');
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function listDeployments(): Promise<Deployment[]> {
  const res = await apiFetch<{ status: string; deployments: Deployment[] }>("");
  return res.deployments;
}

export async function getDeployment(id: string): Promise<Deployment> {
  const res = await apiFetch<{ status: string; deployment: Deployment }>(`/${id}`);
  return res.deployment;
}

export async function createDeployment(input: CreateDeploymentRequest): Promise<Deployment> {
  const res = await apiFetch<{ status: string; deployment: Deployment }>("/", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return res.deployment;
}

export async function updateDeployment(id: string, input: Partial<CreateDeploymentRequest>): Promise<Deployment> {
  const res = await apiFetch<{ status: string; deployment: Deployment }>(`/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
  return res.deployment;
}

export async function deleteDeployment(id: string): Promise<void> {
  await apiFetch(`/${id}`, { method: "DELETE" });
}

export async function deployDeployment(id: string): Promise<Deployment> {
  const res = await apiFetch<{ status: string; deployment: Deployment }>(`/${id}/deploy`, {
    method: "POST",
  });
  return res.deployment;
}

export async function undeployDeployment(id: string): Promise<void> {
  await apiFetch(`/${id}/undeploy`, { method: "POST" });
}

export async function runDeployment(id: string): Promise<{ run_id: string }> {
  const res = await apiFetch<{ status: string; run_id: string }>(`/${id}/run`, {
    method: "POST",
  });
  return res;
}

export async function getDeploymentRuns(id: string, maxResults: number = 10): Promise<JobRun[]> {
  const res = await apiFetch<{ status: string; runs: JobRun[] }>(`/${id}/runs?max_results=${maxResults}`);
  return res.runs;
}

export interface GlueJob {
  name: string;
  description: string;
  role: string;
  created_on: string;
  last_modified_on: string;
  worker_type: string;
  number_of_workers: number;
  glue_version: string;
  timeout: number;
  command: { name: string; script_location: string; python_version: string };
}

export async function listGlueJobs(): Promise<GlueJob[]> {
  const res = await apiFetch<{ status: string; jobs: GlueJob[] }>("/glue-jobs");
  return res.jobs;
}
