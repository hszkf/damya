import { jobService } from './job-service';
import * as sqlserver from './database/sqlserver';
import * as redshift from './database/redshift';
import { websocketManager } from '../utils/websocket';
import type { Job, WorkflowStep, StepResult, Execution } from '../models/job';

export class JobExecutor {
  private stepResults: Map<string, any[]> = new Map();

  async executeJob(jobId: string, triggerType: 'manual' | 'scheduled' = 'manual'): Promise<Execution> {
    const job = await jobService.getJob(jobId);

    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    // Create execution record
    const execution = await jobService.createExecution(jobId, triggerType);

    // Update status to running
    await jobService.updateExecution(execution.id, { status: 'running' });
    websocketManager.broadcast(jobId, {
      type: 'job_status',
      execution_id: execution.id,
      job_id: jobId,
      status: 'running',
      message: 'Job execution started',
    });

    try {
      if (job.job_type === 'workflow' && job.workflow_definition) {
        await this.executeWorkflow(job, execution);
      } else if (job.job_type === 'function' && job.target_function) {
        await this.executeFunction(job, execution);
      } else {
        throw new Error(`Invalid job configuration for job ${jobId}`);
      }

      // Mark as completed
      await jobService.updateExecution(execution.id, {
        status: 'completed',
        completed: true,
      });

      websocketManager.broadcast(jobId, {
        type: 'job_completed',
        execution_id: execution.id,
        job_id: jobId,
        status: 'completed',
        duration_seconds: 0,
      });

      // Update last run time
      await jobService.updateLastRunTime(jobId);

      return (await jobService.getExecution(execution.id))!;
    } catch (error: any) {
      // Mark as failed
      await jobService.updateExecution(execution.id, {
        status: 'failed',
        error_message: error.message,
        completed: true,
      });

      websocketManager.broadcast(jobId, {
        type: 'job_completed',
        execution_id: execution.id,
        job_id: jobId,
        status: 'failed',
        error: error.message,
        duration_seconds: 0,
      });

      throw error;
    } finally {
      // Clear step results
      this.stepResults.clear();
    }
  }

  private async executeWorkflow(job: Job, execution: Execution): Promise<void> {
    const workflow = job.workflow_definition!;
    const stepResults: StepResult[] = [];

    for (const step of workflow.steps) {
      // Broadcast step started
      websocketManager.broadcast(job.id, {
        type: 'step_progress',
        execution_id: execution.id,
        job_id: job.id,
        step_id: `step_${step.step_number}`,
        step_name: step.step_name,
        status: 'running',
      });

      const stepResult = await this.executeStep(step, job, execution);
      stepResults.push(stepResult);

      // Update execution with step results
      await jobService.updateExecution(execution.id, {
        step_results: stepResults,
      });

      // Broadcast step completed
      websocketManager.broadcast(job.id, {
        type: 'step_progress',
        execution_id: execution.id,
        job_id: job.id,
        step_id: `step_${step.step_number}`,
        step_name: step.step_name,
        status: stepResult.status,
        rows_processed: stepResult.rows_returned,
        duration_seconds: stepResult.duration_seconds,
      });

      // Check if step failed and error handling is 'stop'
      if (stepResult.status === 'failed' && workflow.error_handling === 'stop') {
        throw new Error(`Step ${step.step_name} failed: ${stepResult.error_message}`);
      }
    }
  }

  private async executeStep(step: WorkflowStep, job: Job, execution: Execution): Promise<StepResult> {
    const startTime = new Date();

    try {
      let result: { columns: string[]; rows: any[]; rowCount: number };

      switch (step.step_type) {
        case 'sqlserver_query':
          result = await this.executeSqlServerQuery(step);
          break;
        case 'redshift_query':
          result = await this.executeRedshiftQuery(step);
          break;
        case 'merge':
          result = await this.executeMerge(step);
          break;
        default:
          throw new Error(`Unknown step type: ${step.step_type}`);
      }

      // Save results if save_as is specified
      if (step.save_as) {
        this.stepResults.set(step.save_as, result.rows);
      }

      const endTime = new Date();

      return {
        step_number: step.step_number,
        step_name: step.step_name,
        step_type: step.step_type,
        status: 'completed',
        started_at: startTime,
        completed_at: endTime,
        duration_seconds: Math.round((endTime.getTime() - startTime.getTime()) / 1000),
        error_message: null,
        rows_returned: result.rowCount,
        output_preview: result.rows.slice(0, 10),
      };
    } catch (error: any) {
      const endTime = new Date();

      return {
        step_number: step.step_number,
        step_name: step.step_name,
        step_type: step.step_type,
        status: 'failed',
        started_at: startTime,
        completed_at: endTime,
        duration_seconds: Math.round((endTime.getTime() - startTime.getTime()) / 1000),
        error_message: error.message,
        rows_returned: null,
        output_preview: null,
      };
    }
  }

  private async executeSqlServerQuery(step: WorkflowStep): Promise<{ columns: string[]; rows: any[]; rowCount: number }> {
    if (!step.query) {
      throw new Error('No query provided for SQL Server step');
    }

    const result = await sqlserver.executeQuery(step.query);

    return {
      columns: result.columns,
      rows: result.rows,
      rowCount: result.rowCount,
    };
  }

  private async executeRedshiftQuery(step: WorkflowStep): Promise<{ columns: string[]; rows: any[]; rowCount: number }> {
    if (!step.query) {
      throw new Error('No query provided for Redshift step');
    }

    const result = await redshift.executeQuery(step.query);

    return {
      columns: result.columns,
      rows: result.rows,
      rowCount: result.rowCount,
    };
  }

  private async executeMerge(step: WorkflowStep): Promise<{ columns: string[]; rows: any[]; rowCount: number }> {
    if (!step.source_tables || step.source_tables.length < 2) {
      throw new Error('Merge step requires at least 2 source tables');
    }

    const tables = step.source_tables.map((name) => this.stepResults.get(name) || []);

    if (tables.some((t) => !t || t.length === 0)) {
      throw new Error('One or more source tables are empty or not found');
    }

    let mergedRows: any[] = [];

    switch (step.merge_type) {
      case 'union':
        // Union - combine and deduplicate
        const allRows = tables.flat();
        const seen = new Set<string>();
        mergedRows = allRows.filter((row) => {
          const key = JSON.stringify(row);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        break;

      case 'union_all':
        // Union All - simple concatenation
        mergedRows = tables.flat();
        break;

      case 'inner_join':
      case 'left_join':
        // Join operations
        if (!step.join_keys || step.join_keys.length === 0) {
          throw new Error('Join operations require join keys');
        }
        mergedRows = this.performJoin(tables[0], tables[1], step.join_keys, step.merge_type);
        break;

      default:
        throw new Error(`Unknown merge type: ${step.merge_type}`);
    }

    const columns = mergedRows.length > 0 ? Object.keys(mergedRows[0]) : [];

    return {
      columns,
      rows: mergedRows,
      rowCount: mergedRows.length,
    };
  }

  private performJoin(
    left: any[],
    right: any[],
    joinKeys: string[],
    joinType: 'inner_join' | 'left_join'
  ): any[] {
    const result: any[] = [];

    // Create index on right table
    const rightIndex = new Map<string, any[]>();
    for (const row of right) {
      const key = joinKeys.map((k) => row[k]).join('|');
      if (!rightIndex.has(key)) {
        rightIndex.set(key, []);
      }
      rightIndex.get(key)!.push(row);
    }

    // Perform join
    for (const leftRow of left) {
      const key = joinKeys.map((k) => leftRow[k]).join('|');
      const rightRows = rightIndex.get(key);

      if (rightRows) {
        for (const rightRow of rightRows) {
          result.push({ ...leftRow, ...rightRow });
        }
      } else if (joinType === 'left_join') {
        // For left join, include left row with nulls for right columns
        const rightNulls: Record<string, null> = {};
        if (right.length > 0) {
          for (const col of Object.keys(right[0])) {
            if (!joinKeys.includes(col)) {
              rightNulls[col] = null;
            }
          }
        }
        result.push({ ...leftRow, ...rightNulls });
      }
    }

    return result;
  }

  private async executeFunction(job: Job, execution: Execution): Promise<void> {
    // Function registry execution
    // This would be extended based on registered functions
    const functionName = job.target_function;
    const params = job.parameters || {};

    // Placeholder for function execution
    console.log(`Executing function: ${functionName} with params:`, params);

    // Update execution with result
    await jobService.updateExecution(execution.id, {
      rows_processed: 0,
      step_results: [
        {
          step_number: 1,
          step_name: functionName,
          step_type: 'function',
          status: 'completed',
          started_at: new Date(),
          completed_at: new Date(),
          duration_seconds: 0,
          error_message: null,
          rows_returned: 0,
          output_preview: null,
        },
      ],
    });
  }
}

export const jobExecutor = new JobExecutor();
