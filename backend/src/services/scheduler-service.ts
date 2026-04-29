import { jobService } from './job-service';
import { jobExecutor } from './job-executor';
import type { Job, ScheduleConfig } from '../models/job';

interface ScheduledJob {
  jobId: string;
  intervalId: Timer | null;
  nextRun: Date | null;
}

class SchedulerService {
  private scheduledJobs: Map<string, ScheduledJob> = new Map();
  private isRunning = false;
  private checkIntervalId: Timer | null = null;

  async start(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;
    console.log('Scheduler service starting...');

    // Recover scheduled jobs from database
    await this.recoverJobs();

    // Start periodic check for date-based jobs
    this.checkIntervalId = setInterval(() => this.checkDateJobs(), 60000); // Check every minute

    console.log('Scheduler service started');
  }

  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;

    // Clear all scheduled intervals
    for (const scheduled of this.scheduledJobs.values()) {
      if (scheduled.intervalId) {
        clearInterval(scheduled.intervalId);
      }
    }
    this.scheduledJobs.clear();

    // Stop periodic check
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
    }

    console.log('Scheduler service stopped');
  }

  async recoverJobs(): Promise<void> {
    try {
      const { jobs } = await jobService.getJobs({ is_active: true, limit: 1000 });

      for (const job of jobs) {
        if (job.schedule_config) {
          await this.scheduleJob(job);
        }
      }

      console.log(`Recovered ${this.scheduledJobs.size} scheduled jobs`);
    } catch (error) {
      console.error('Error recovering jobs:', error);
    }
  }

  async scheduleJob(job: Job): Promise<void> {
    if (!job.schedule_config || !job.is_active) {
      return;
    }

    // Remove existing schedule if any
    this.unscheduleJob(job.id);

    const schedule = job.schedule_config;

    switch (schedule.schedule_type) {
      case 'interval':
        this.scheduleInterval(job.id, schedule);
        break;
      case 'cron':
        this.scheduleCron(job.id, schedule);
        break;
      case 'date':
        this.scheduleDate(job.id, schedule);
        break;
    }
  }

  unscheduleJob(jobId: string): void {
    const scheduled = this.scheduledJobs.get(jobId);
    if (scheduled?.intervalId) {
      clearInterval(scheduled.intervalId);
    }
    this.scheduledJobs.delete(jobId);
  }

  private scheduleInterval(jobId: string, config: ScheduleConfig): void {
    if (!config.interval_seconds) {
      console.error(`No interval specified for job ${jobId}`);
      return;
    }

    const intervalMs = config.interval_seconds * 1000;
    const nextRun = new Date(Date.now() + intervalMs);

    const intervalId = setInterval(async () => {
      await this.executeScheduledJob(jobId);
    }, intervalMs);

    this.scheduledJobs.set(jobId, {
      jobId,
      intervalId,
      nextRun,
    });

    console.log(`Scheduled job ${jobId} to run every ${config.interval_seconds} seconds`);
  }

  private scheduleCron(jobId: string, config: ScheduleConfig): void {
    if (!config.cron_expression) {
      console.error(`No cron expression specified for job ${jobId}`);
      return;
    }

    const nextRun = this.getNextCronRun(config.cron_expression);

    // For cron, we check every 10 seconds for reasonably precise timing
    // This ensures jobs run within ~10 seconds of their scheduled time
    const intervalId = setInterval(async () => {
      const now = new Date();
      const scheduled = this.scheduledJobs.get(jobId);

      if (scheduled?.nextRun && now >= scheduled.nextRun) {
        // Calculate next run BEFORE executing to avoid race conditions
        // This ensures manual runs don't affect the schedule
        const newNextRun = this.getNextCronRun(config.cron_expression!);
        scheduled.nextRun = newNextRun;
        
        // Now execute the scheduled job
        await this.executeScheduledJob(jobId);
      }
    }, 10000); // Check every 10 seconds

    this.scheduledJobs.set(jobId, {
      jobId,
      intervalId,
      nextRun,
    });

    console.log(`Scheduled job ${jobId} with cron: ${config.cron_expression}, next run: ${nextRun.toISOString()}`);
  }

  private scheduleDate(jobId: string, config: ScheduleConfig): void {
    if (!config.run_date) {
      console.error(`No run date specified for job ${jobId}`);
      return;
    }

    const runDate = new Date(config.run_date);
    const now = new Date();

    if (runDate <= now) {
      console.warn(`Job ${jobId} run date has already passed`);
      return;
    }

    this.scheduledJobs.set(jobId, {
      jobId,
      intervalId: null,
      nextRun: runDate,
    });

    console.log(`Scheduled job ${jobId} for ${runDate.toISOString()}`);
  }

  private async checkDateJobs(): Promise<void> {
    const now = new Date();

    for (const [jobId, scheduled] of this.scheduledJobs.entries()) {
      if (scheduled.nextRun && !scheduled.intervalId && now >= scheduled.nextRun) {
        await this.executeScheduledJob(jobId);
        this.unscheduleJob(jobId);
      }
    }
  }

  private async executeScheduledJob(jobId: string): Promise<void> {
    try {
      console.log(`Executing scheduled job ${jobId}`);
      await jobExecutor.executeJob(jobId, 'scheduled');
    } catch (error) {
      console.error(`Error executing scheduled job ${jobId}:`, error);
    }
  }

  private getNextCronRun(cronExpression: string, afterDate?: Date): Date {
    // Simple cron parser for common patterns
    // Format: minute hour day month dayOfWeek
    const parts = cronExpression.trim().split(/\s+/);

    if (parts.length !== 5) {
      // Default to next minute if invalid
      return new Date(Date.now() + 60000);
    }

    const [minutePart, hourPart, dayPart, monthPart, dayOfWeekPart] = parts;
    const now = afterDate || new Date();

    // Handle "every X minutes" patterns like */5
    if (minutePart.startsWith('*/')) {
      const interval = parseInt(minutePart.slice(2));
      const currentMinute = now.getMinutes();
      const nextMinute = Math.ceil((currentMinute + 1) / interval) * interval;
      
      let nextRun = new Date(now);
      nextRun.setSeconds(0);
      nextRun.setMilliseconds(0);
      
      if (nextMinute >= 60) {
        nextRun.setMinutes(0);
        nextRun.setHours(nextRun.getHours() + 1);
      } else {
        nextRun.setMinutes(nextMinute);
      }
      
      return nextRun;
    }

    // Handle "every minute" pattern
    if (minutePart === '*' && hourPart === '*') {
      let nextRun = new Date(now);
      nextRun.setSeconds(0);
      nextRun.setMilliseconds(0);
      nextRun.setMinutes(nextRun.getMinutes() + 1);
      return nextRun;
    }

    // Parse specific minute/hour values
    const targetMinute = minutePart === '*' ? 0 : parseInt(minutePart);
    const targetHour = hourPart === '*' ? now.getHours() : parseInt(hourPart);

    let nextRun = new Date(now);
    nextRun.setSeconds(0);
    nextRun.setMilliseconds(0);
    nextRun.setMinutes(targetMinute);
    nextRun.setHours(targetHour);

    // If the time has passed today, move to next occurrence
    if (nextRun <= now) {
      if (hourPart === '*') {
        // Hourly job - move to next hour
        nextRun.setHours(nextRun.getHours() + 1);
      } else {
        // Daily or specific time - move to tomorrow
        nextRun.setDate(nextRun.getDate() + 1);
      }
    }

    return nextRun;
  }

  // Validate cron expression
  validateCron(expression: string): { valid: boolean; error?: string; description?: string; nextRuns?: string[] } {
    const parts = expression.trim().split(/\s+/);

    if (parts.length !== 5) {
      return {
        valid: false,
        error: 'Cron expression must have 5 parts: minute hour day month dayOfWeek',
      };
    }

    const [minute, hour, day, month, dayOfWeek] = parts;

    // Basic validation
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
          return {
            valid: false,
            error: `Invalid ${v.name}: ${v.value}`,
          };
        }
      }
    }

    // Generate human-readable description
    const description = this.describeCron(expression);

    // Calculate next few runs
    const nextRuns: string[] = [];
    let currentDate = new Date();

    for (let i = 0; i < 5; i++) {
      const nextRun = this.calculateNextCronRun(expression, currentDate);
      nextRuns.push(nextRun.toISOString());
      currentDate = new Date(nextRun.getTime() + 60000); // Move past this run
    }

    return {
      valid: true,
      description,
      nextRuns,
    };
  }

  private describeCron(expression: string): string {
    const parts = expression.trim().split(/\s+/);
    const [minute, hour, day, month, dayOfWeek] = parts;

    // Common patterns
    if (expression === '* * * * *') return 'Every minute';
    if (minute.startsWith('*/')) return `Every ${minute.slice(2)} minutes`;
    if (hour === '*' && minute !== '*') return `Every hour at minute ${minute}`;
    
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    let desc = '';
    
    if (minute !== '*' && hour !== '*') {
      desc = `At ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
    } else if (minute !== '*') {
      desc = `At minute ${minute}`;
    } else {
      desc = 'Every minute';
    }

    if (dayOfWeek !== '*') {
      if (dayOfWeek.includes('-')) {
        const [start, end] = dayOfWeek.split('-').map(Number);
        desc += ` on ${dayNames[start]} through ${dayNames[end]}`;
      } else if (dayOfWeek.includes(',')) {
        const days = dayOfWeek.split(',').map(d => dayNames[parseInt(d)]);
        desc += ` on ${days.join(', ')}`;
      } else {
        desc += ` on ${dayNames[parseInt(dayOfWeek)]}`;
      }
    } else if (day !== '*') {
      desc += ` on day ${day} of the month`;
    } else if (hour !== '*' && minute !== '*') {
      desc += ' daily';
    }

    return desc;
  }

  private calculateNextCronRun(expression: string, fromDate: Date): Date {
    // Reuse the main getNextCronRun function for consistency
    return this.getNextCronRun(expression, fromDate);
  }

  getScheduledJobCount(): number {
    return this.scheduledJobs.size;
  }

  getJobNextRun(jobId: string): Date | null {
    return this.scheduledJobs.get(jobId)?.nextRun || null;
  }

  getStatus(): {
    running: boolean;
    scheduled_jobs: number;
    jobs: Array<{ job_id: string; next_run: string | null }>;
  } {
    const jobs = Array.from(this.scheduledJobs.entries()).map(([jobId, scheduled]) => ({
      job_id: jobId,
      next_run: scheduled.nextRun?.toISOString() || null,
    }));

    return {
      running: this.isRunning,
      scheduled_jobs: this.scheduledJobs.size,
      jobs,
    };
  }
}

export const schedulerService = new SchedulerService();
