import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import type { Deployment, CreateDeploymentInput, UpdateDeploymentInput } from '../models/deployment';
import { generateDefaults } from '../models/deployment';

const DATA_DIR = join(import.meta.dir, '../../data');
const DATA_FILE = join(DATA_DIR, 'deployments.json');

class DeploymentStore {
  private deployments: Map<string, Deployment> = new Map();

  constructor() {
    this.load();
  }

  private load(): void {
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!existsSync(DATA_FILE)) {
      writeFileSync(DATA_FILE, '[]', 'utf-8');
      return;
    }
    try {
      const raw = readFileSync(DATA_FILE, 'utf-8');
      const arr: Deployment[] = JSON.parse(raw);
      for (const d of arr) this.deployments.set(d.id, d);
    } catch {
      writeFileSync(DATA_FILE, '[]', 'utf-8');
    }
  }

  private save(): void {
    const arr = Array.from(this.deployments.values());
    writeFileSync(DATA_FILE, JSON.stringify(arr, null, 2), 'utf-8');
  }

  getAll(): Deployment[] {
    return Array.from(this.deployments.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  getById(id: string): Deployment | undefined {
    return this.deployments.get(id);
  }

  create(input: CreateDeploymentInput): Deployment {
    const id = randomUUID();
    const now = new Date().toISOString();
    const defaults = generateDefaults(input);

    const deployment: Deployment = {
      id,
      name: input.name,
      job_name: defaults.job_name!,
      description: defaults.description!,
      sql_query: input.sql_query,
      sql_tag: defaults.sql_tag!,
      cron_expression: input.cron_expression,
      cron_description: '',
      email_to: input.email_to,
      email_cc: input.email_cc || [],
      email_subject: defaults.email_subject!,
      glue_job_name: defaults.glue_job_name!,
      glue_trigger_name: defaults.glue_trigger_name!,
      worker_type: defaults.worker_type!,
      num_workers: defaults.num_workers!,
      glue_version: defaults.glue_version!,
      timeout_minutes: defaults.timeout_minutes!,
      max_retries: defaults.max_retries!,
      s3_output_bucket: defaults.s3_output_bucket!,
      s3_output_prefix: defaults.s3_output_prefix!,
      status: defaults.status!,
      last_deployed_at: defaults.last_deployed_at!,
      last_run_status: defaults.last_run_status!,
      last_run_at: defaults.last_run_at!,
      last_run_id: defaults.last_run_id!,
      created_at: now,
      updated_at: now,
      author: defaults.author!,
    };

    this.deployments.set(id, deployment);
    this.save();
    return deployment;
  }

  update(id: string, updates: UpdateDeploymentInput): Deployment | null {
    const existing = this.deployments.get(id);
    if (!existing) return null;

    const updated: Deployment = {
      ...existing,
      ...updates,
      id: existing.id,
      created_at: existing.created_at,
      updated_at: new Date().toISOString(),
    };

    if (updates.name && updates.name !== existing.name) {
      updated.job_name = generateDefaults({ ...existing, ...updates }).job_name!;
      updated.glue_job_name = updated.job_name;
      updated.glue_trigger_name = `sched-${updated.job_name}`;
    }

    this.deployments.set(id, updated);
    this.save();
    return updated;
  }

  updateStatus(id: string, status: Partial<Pick<Deployment, 'status' | 'last_deployed_at' | 'last_run_status' | 'last_run_at' | 'last_run_id'>>): Deployment | null {
    const existing = this.deployments.get(id);
    if (!existing) return null;

    const updated: Deployment = {
      ...existing,
      ...status,
      updated_at: new Date().toISOString(),
    };

    this.deployments.set(id, updated);
    this.save();
    return updated;
  }

  delete(id: string): boolean {
    const deleted = this.deployments.delete(id);
    if (deleted) this.save();
    return deleted;
  }
}

export const deploymentStore = new DeploymentStore();
