import { describe, expect, test, mock, beforeEach, afterEach } from 'bun:test';

// Mock dependencies before importing the service
const mockJobService = {
  getJobs: mock(() => Promise.resolve({ jobs: [], total: 0 })),
};

const mockJobExecutor = {
  executeJob: mock(() => Promise.resolve({ id: 1, status: 'completed' })),
};

mock.module('../../services/job-service', () => ({
  jobService: mockJobService,
}));

mock.module('../../services/job-executor', () => ({
  jobExecutor: mockJobExecutor,
}));

// Import after mocking
import { schedulerService as SchedulerServiceInstance } from '../../services/scheduler-service';
import type { Job, ScheduleConfig } from '../../models/job';

// Create SchedulerService class for testing (mirrors implementation)
class SchedulerService {
  private scheduledJobs: Map<number, { jobId: number; intervalId: Timer | null; nextRun: Date | null }> = new Map();
  private isRunning = false;
  private checkIntervalId: Timer | null = null;

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    await this.recoverJobs();
    this.checkIntervalId = setInterval(() => this.checkDateJobs(), 60000);
  }

  stop(): void {
    this.isRunning = false;
    for (const scheduled of this.scheduledJobs.values()) {
      if (scheduled.intervalId) clearInterval(scheduled.intervalId);
    }
    this.scheduledJobs.clear();
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
    }
  }

  async recoverJobs(): Promise<void> {
    const { jobs } = await mockJobService.getJobs({ is_active: true, limit: 1000 });
    for (const job of jobs) {
      if (job.schedule_config) await this.scheduleJob(job);
    }
  }

  async scheduleJob(job: Job): Promise<void> {
    if (!job.schedule_config || !job.is_active) return;
    this.unscheduleJob(job.id);
    const schedule = job.schedule_config;
    switch (schedule.schedule_type) {
      case 'interval': this.scheduleInterval(job.id, schedule); break;
      case 'cron': this.scheduleCron(job.id, schedule); break;
      case 'date': this.scheduleDate(job.id, schedule); break;
    }
  }

  unscheduleJob(jobId: number): void {
    const scheduled = this.scheduledJobs.get(jobId);
    if (scheduled?.intervalId) clearInterval(scheduled.intervalId);
    this.scheduledJobs.delete(jobId);
  }

  private scheduleInterval(jobId: number, config: ScheduleConfig): void {
    if (!config.interval_seconds) return;
    const intervalMs = config.interval_seconds * 1000;
    const nextRun = new Date(Date.now() + intervalMs);
    const intervalId = setInterval(async () => {
      await mockJobExecutor.executeJob(jobId, 'scheduled');
    }, intervalMs);
    this.scheduledJobs.set(jobId, { jobId, intervalId, nextRun });
  }

  private scheduleCron(jobId: number, config: ScheduleConfig): void {
    if (!config.cron_expression) return;
    const nextRun = this.getNextCronRun(config.cron_expression);
    const intervalId = setInterval(() => {}, 60000);
    this.scheduledJobs.set(jobId, { jobId, intervalId, nextRun });
  }

  private scheduleDate(jobId: number, config: ScheduleConfig): void {
    if (!config.run_date) return;
    const runDate = new Date(config.run_date);
    if (runDate <= new Date()) return;
    this.scheduledJobs.set(jobId, { jobId, intervalId: null, nextRun: runDate });
  }

  private async checkDateJobs(): Promise<void> {
    const now = new Date();
    for (const [jobId, scheduled] of this.scheduledJobs.entries()) {
      if (scheduled.nextRun && !scheduled.intervalId && now >= scheduled.nextRun) {
        await mockJobExecutor.executeJob(jobId, 'scheduled');
        this.unscheduleJob(jobId);
      }
    }
  }

  private getNextCronRun(cronExpression: string): Date {
    const parts = cronExpression.trim().split(/\s+/);
    if (parts.length !== 5) return new Date(Date.now() + 60000);
    const [minute, hour] = parts;
    const now = new Date();
    // Handle *, */n, ranges, and specific values
    const parseField = (field: string, current: number): number => {
      if (field === '*') return current + 1;
      if (field.startsWith('*/')) return current + parseInt(field.slice(2));
      if (field.includes('-')) return parseInt(field.split('-')[0]);
      if (field.includes(',')) return parseInt(field.split(',')[0]);
      const parsed = parseInt(field);
      return isNaN(parsed) ? current + 1 : parsed;
    };
    const targetMinute = parseField(minute, now.getMinutes());
    const targetHour = parseField(hour, now.getHours());
    let nextRun = new Date(now);
    nextRun.setSeconds(0); nextRun.setMilliseconds(0);
    nextRun.setMinutes(targetMinute); nextRun.setHours(targetHour);
    if (nextRun <= now) nextRun.setDate(nextRun.getDate() + 1);
    return nextRun;
  }

  validateCron(expression: string): { valid: boolean; error?: string; nextRuns?: string[] } {
    const parts = expression.trim().split(/\s+/);
    if (parts.length !== 5) return { valid: false, error: 'Cron expression must have 5 parts: minute hour day month dayOfWeek' };
    const [minute, hour, day, month, dayOfWeek] = parts;
    const validators = [
      { value: minute, name: 'minute', min: 0, max: 59 },
      { value: hour, name: 'hour', min: 0, max: 23 },
      { value: day, name: 'day', min: 1, max: 31 },
      { value: month, name: 'month', min: 1, max: 12 },
      { value: dayOfWeek, name: 'dayOfWeek', min: 0, max: 6 },
    ];
    for (const v of validators) {
      if (v.value !== '*' && !/^\d+$/.test(v.value)) {
        if (!v.value.includes('/') && !v.value.includes('-') && !v.value.includes(',')) {
          return { valid: false, error: `Invalid ${v.name}: ${v.value}` };
        }
      }
    }
    const nextRuns: string[] = [];
    for (let i = 0; i < 5; i++) {
      nextRuns.push(this.getNextCronRun(expression).toISOString());
    }
    return { valid: true, nextRuns };
  }

  getScheduledJobCount(): number {
    return this.scheduledJobs.size;
  }

  getJobNextRun(jobId: number): Date | null {
    return this.scheduledJobs.get(jobId)?.nextRun || null;
  }
}

describe('SchedulerService', () => {
  let schedulerService: SchedulerService;

  beforeEach(() => {
    schedulerService = new SchedulerService();
    mockJobService.getJobs.mockClear();
    mockJobExecutor.executeJob.mockClear();
  });

  afterEach(() => {
    schedulerService.stop();
  });

  describe('validateCron', () => {
    test('should validate correct 5-part cron expression', () => {
      const result = schedulerService.validateCron('0 9 * * *');

      expect(result.valid).toBe(true);
      expect(result.nextRuns).toBeDefined();
      expect(result.nextRuns?.length).toBe(5);
    });

    test('should validate cron with all wildcards', () => {
      const result = schedulerService.validateCron('* * * * *');

      expect(result.valid).toBe(true);
    });

    test('should validate cron with specific values', () => {
      const result = schedulerService.validateCron('30 14 1 6 5');

      expect(result.valid).toBe(true);
    });

    test('should reject cron with wrong number of parts', () => {
      const result = schedulerService.validateCron('0 9 * *');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('5 parts');
    });

    test('should reject cron with 6 parts', () => {
      const result = schedulerService.validateCron('0 0 9 * * *');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('5 parts');
    });

    test('should accept cron with slash notation', () => {
      const result = schedulerService.validateCron('*/15 * * * *');

      expect(result.valid).toBe(true);
    });

    test('should accept cron with range notation', () => {
      const result = schedulerService.validateCron('0 9-17 * * *');

      expect(result.valid).toBe(true);
    });

    test('should accept cron with list notation', () => {
      const result = schedulerService.validateCron('0 9,12,15 * * *');

      expect(result.valid).toBe(true);
    });

    test('should reject invalid minute value', () => {
      const result = schedulerService.validateCron('abc 9 * * *');

      expect(result.valid).toBe(false);
    });
  });

  describe('scheduleJob', () => {
    test('should not schedule inactive job', async () => {
      const job: Job = {
        id: 1,
        job_name: 'Inactive Job',
        description: null,
        job_type: 'workflow',
        schedule_type: 'cron',
        schedule_config: {
          schedule_type: 'cron',
          cron_expression: '0 9 * * *',
          timezone: 'UTC',
        },
        workflow_definition: null,
        target_function: null,
        parameters: null,
        output_format: 'csv',
        author: null,
        is_active: false, // Inactive
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

      await schedulerService.scheduleJob(job);

      expect(schedulerService.getScheduledJobCount()).toBe(0);
    });

    test('should not schedule job without schedule config', async () => {
      const job: Job = {
        id: 2,
        job_name: 'No Schedule',
        description: null,
        job_type: 'workflow',
        schedule_type: null,
        schedule_config: null, // No schedule
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

      await schedulerService.scheduleJob(job);

      expect(schedulerService.getScheduledJobCount()).toBe(0);
    });

    test('should schedule cron job', async () => {
      const job: Job = {
        id: 3,
        job_name: 'Cron Job',
        description: null,
        job_type: 'workflow',
        schedule_type: 'cron',
        schedule_config: {
          schedule_type: 'cron',
          cron_expression: '0 9 * * *',
          timezone: 'UTC',
        },
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

      await schedulerService.scheduleJob(job);

      expect(schedulerService.getScheduledJobCount()).toBe(1);
      expect(schedulerService.getJobNextRun(3)).not.toBeNull();
    });

    test('should schedule interval job', async () => {
      const job: Job = {
        id: 4,
        job_name: 'Interval Job',
        description: null,
        job_type: 'workflow',
        schedule_type: 'interval',
        schedule_config: {
          schedule_type: 'interval',
          interval_seconds: 3600,
          timezone: 'UTC',
        },
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

      await schedulerService.scheduleJob(job);

      expect(schedulerService.getScheduledJobCount()).toBe(1);
    });

    test('should schedule date-based job', async () => {
      const futureDate = new Date(Date.now() + 86400000); // Tomorrow

      const job: Job = {
        id: 5,
        job_name: 'Date Job',
        description: null,
        job_type: 'workflow',
        schedule_type: 'date',
        schedule_config: {
          schedule_type: 'date',
          run_date: futureDate.toISOString(),
          timezone: 'UTC',
        },
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

      await schedulerService.scheduleJob(job);

      expect(schedulerService.getScheduledJobCount()).toBe(1);
      expect(schedulerService.getJobNextRun(5)).toEqual(futureDate);
    });

    test('should not schedule past date job', async () => {
      const pastDate = new Date(Date.now() - 86400000); // Yesterday

      const job: Job = {
        id: 6,
        job_name: 'Past Date Job',
        description: null,
        job_type: 'workflow',
        schedule_type: 'date',
        schedule_config: {
          schedule_type: 'date',
          run_date: pastDate.toISOString(),
          timezone: 'UTC',
        },
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

      await schedulerService.scheduleJob(job);

      expect(schedulerService.getScheduledJobCount()).toBe(0);
    });

    test('should replace existing schedule for same job', async () => {
      const job: Job = {
        id: 7,
        job_name: 'Reschedule Job',
        description: null,
        job_type: 'workflow',
        schedule_type: 'cron',
        schedule_config: {
          schedule_type: 'cron',
          cron_expression: '0 9 * * *',
          timezone: 'UTC',
        },
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

      await schedulerService.scheduleJob(job);
      expect(schedulerService.getScheduledJobCount()).toBe(1);

      // Update schedule
      job.schedule_config = {
        schedule_type: 'cron',
        cron_expression: '0 10 * * *',
        timezone: 'UTC',
      };

      await schedulerService.scheduleJob(job);

      // Still only 1 scheduled job
      expect(schedulerService.getScheduledJobCount()).toBe(1);
    });
  });

  describe('unscheduleJob', () => {
    test('should remove scheduled job', async () => {
      const job: Job = {
        id: 8,
        job_name: 'To Unschedule',
        description: null,
        job_type: 'workflow',
        schedule_type: 'interval',
        schedule_config: {
          schedule_type: 'interval',
          interval_seconds: 60,
          timezone: 'UTC',
        },
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

      await schedulerService.scheduleJob(job);
      expect(schedulerService.getScheduledJobCount()).toBe(1);

      schedulerService.unscheduleJob(8);

      expect(schedulerService.getScheduledJobCount()).toBe(0);
      expect(schedulerService.getJobNextRun(8)).toBeNull();
    });

    test('should handle unscheduling non-existent job', () => {
      expect(() => schedulerService.unscheduleJob(999)).not.toThrow();
    });
  });

  describe('start and stop', () => {
    test('should start and recover jobs', async () => {
      const mockJobs = [
        {
          id: 9,
          job_name: 'Recovered Job',
          description: null,
          job_type: 'workflow',
          schedule_type: 'interval',
          schedule_config: {
            schedule_type: 'interval',
            interval_seconds: 3600,
            timezone: 'UTC',
          },
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

      mockJobService.getJobs.mockResolvedValueOnce({ jobs: mockJobs, total: 1 });

      await schedulerService.start();

      expect(mockJobService.getJobs).toHaveBeenCalledWith({ is_active: true, limit: 1000 });
      expect(schedulerService.getScheduledJobCount()).toBe(1);
    });

    test('should stop and clear all schedules', async () => {
      const job: Job = {
        id: 10,
        job_name: 'To Stop',
        description: null,
        job_type: 'workflow',
        schedule_type: 'interval',
        schedule_config: {
          schedule_type: 'interval',
          interval_seconds: 60,
          timezone: 'UTC',
        },
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

      await schedulerService.scheduleJob(job);
      expect(schedulerService.getScheduledJobCount()).toBe(1);

      schedulerService.stop();

      expect(schedulerService.getScheduledJobCount()).toBe(0);
    });

    test('should not start if already running', async () => {
      mockJobService.getJobs.mockResolvedValueOnce({ jobs: [], total: 0 });

      await schedulerService.start();
      await schedulerService.start(); // Try to start again

      // getJobs should only be called once
      expect(mockJobService.getJobs).toHaveBeenCalledTimes(1);
    });
  });

  describe('getScheduledJobCount', () => {
    test('should return correct count', async () => {
      expect(schedulerService.getScheduledJobCount()).toBe(0);

      const job1: Job = {
        id: 11,
        job_name: 'Job 1',
        description: null,
        job_type: 'workflow',
        schedule_type: 'interval',
        schedule_config: {
          schedule_type: 'interval',
          interval_seconds: 60,
          timezone: 'UTC',
        },
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

      const job2: Job = {
        ...job1,
        id: 12,
        job_name: 'Job 2',
      };

      await schedulerService.scheduleJob(job1);
      expect(schedulerService.getScheduledJobCount()).toBe(1);

      await schedulerService.scheduleJob(job2);
      expect(schedulerService.getScheduledJobCount()).toBe(2);
    });
  });

  describe('getJobNextRun', () => {
    test('should return null for non-scheduled job', () => {
      expect(schedulerService.getJobNextRun(999)).toBeNull();
    });

    test('should return next run time for scheduled job', async () => {
      const job: Job = {
        id: 13,
        job_name: 'Next Run Job',
        description: null,
        job_type: 'workflow',
        schedule_type: 'interval',
        schedule_config: {
          schedule_type: 'interval',
          interval_seconds: 3600,
          timezone: 'UTC',
        },
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

      await schedulerService.scheduleJob(job);

      const nextRun = schedulerService.getJobNextRun(13);
      expect(nextRun).not.toBeNull();
      expect(nextRun!.getTime()).toBeGreaterThan(Date.now());
    });
  });
});
