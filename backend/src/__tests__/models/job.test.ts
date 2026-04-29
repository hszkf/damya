import { describe, expect, test } from 'bun:test';
import {
  JobType,
  ScheduleType,
  StepType,
  ExecutionStatus,
  OutputFormat,
  ErrorHandlingMode,
  TriggerType,
  WorkflowStepSchema,
  ScheduleConfigSchema,
  WorkflowDefinitionSchema,
  CreateJobRequestSchema,
  UpdateJobRequestSchema,
  ScheduleJobRequestSchema,
  CronValidationRequestSchema,
  RunJobRequestSchema,
} from '../../models/job';

describe('Job Model Enums', () => {
  describe('JobType', () => {
    test('should accept valid job types', () => {
      expect(JobType.parse('workflow')).toBe('workflow');
      expect(JobType.parse('function')).toBe('function');
    });

    test('should reject invalid job types', () => {
      expect(() => JobType.parse('invalid')).toThrow();
      expect(() => JobType.parse('')).toThrow();
      expect(() => JobType.parse(null)).toThrow();
    });
  });

  describe('ScheduleType', () => {
    test('should accept valid schedule types', () => {
      expect(ScheduleType.parse('cron')).toBe('cron');
      expect(ScheduleType.parse('interval')).toBe('interval');
      expect(ScheduleType.parse('date')).toBe('date');
    });

    test('should reject invalid schedule types', () => {
      expect(() => ScheduleType.parse('hourly')).toThrow();
      expect(() => ScheduleType.parse('')).toThrow();
    });
  });

  describe('StepType', () => {
    test('should accept valid step types', () => {
      expect(StepType.parse('redshift_query')).toBe('redshift_query');
      expect(StepType.parse('sqlserver_query')).toBe('sqlserver_query');
      expect(StepType.parse('merge')).toBe('merge');
    });

    test('should reject invalid step types', () => {
      expect(() => StepType.parse('mysql_query')).toThrow();
    });
  });

  describe('ExecutionStatus', () => {
    test('should accept valid execution statuses', () => {
      expect(ExecutionStatus.parse('pending')).toBe('pending');
      expect(ExecutionStatus.parse('running')).toBe('running');
      expect(ExecutionStatus.parse('completed')).toBe('completed');
      expect(ExecutionStatus.parse('failed')).toBe('failed');
      expect(ExecutionStatus.parse('cancelled')).toBe('cancelled');
    });

    test('should reject invalid execution statuses', () => {
      expect(() => ExecutionStatus.parse('success')).toThrow();
    });
  });

  describe('OutputFormat', () => {
    test('should accept valid output formats', () => {
      expect(OutputFormat.parse('csv')).toBe('csv');
      expect(OutputFormat.parse('excel')).toBe('excel');
      expect(OutputFormat.parse('json')).toBe('json');
    });

    test('should reject invalid output formats', () => {
      expect(() => OutputFormat.parse('xml')).toThrow();
    });
  });

  describe('ErrorHandlingMode', () => {
    test('should accept valid error handling modes', () => {
      expect(ErrorHandlingMode.parse('stop')).toBe('stop');
      expect(ErrorHandlingMode.parse('continue')).toBe('continue');
      expect(ErrorHandlingMode.parse('retry')).toBe('retry');
    });

    test('should reject invalid error handling modes', () => {
      expect(() => ErrorHandlingMode.parse('ignore')).toThrow();
    });
  });

  describe('TriggerType', () => {
    test('should accept valid trigger types', () => {
      expect(TriggerType.parse('manual')).toBe('manual');
      expect(TriggerType.parse('scheduled')).toBe('scheduled');
    });

    test('should reject invalid trigger types', () => {
      expect(() => TriggerType.parse('automatic')).toThrow();
    });
  });
});

describe('WorkflowStepSchema', () => {
  test('should validate a valid SQL Server query step', () => {
    const step = {
      step_number: 1,
      step_name: 'Fetch Users',
      step_type: 'sqlserver_query',
      query: 'SELECT * FROM users',
      save_as: 'users_data',
      description: 'Fetch all users from database',
    };

    const result = WorkflowStepSchema.parse(step);
    expect(result.step_number).toBe(1);
    expect(result.step_name).toBe('Fetch Users');
    expect(result.step_type).toBe('sqlserver_query');
    expect(result.query).toBe('SELECT * FROM users');
  });

  test('should validate a valid merge step', () => {
    const step = {
      step_number: 3,
      step_name: 'Merge Data',
      step_type: 'merge',
      merge_type: 'inner_join',
      source_tables: ['users_data', 'orders_data'],
      join_keys: ['user_id'],
    };

    const result = WorkflowStepSchema.parse(step);
    expect(result.merge_type).toBe('inner_join');
    expect(result.source_tables).toEqual(['users_data', 'orders_data']);
    expect(result.join_keys).toEqual(['user_id']);
  });

  test('should accept valid merge types', () => {
    const mergeTypes = ['union', 'union_all', 'inner_join', 'left_join'];

    for (const mergeType of mergeTypes) {
      const step = {
        step_number: 1,
        step_name: 'Merge',
        step_type: 'merge',
        merge_type: mergeType,
        source_tables: ['a', 'b'],
      };
      expect(() => WorkflowStepSchema.parse(step)).not.toThrow();
    }
  });

  test('should reject invalid step_type', () => {
    const step = {
      step_number: 1,
      step_name: 'Invalid Step',
      step_type: 'invalid_type',
    };

    expect(() => WorkflowStepSchema.parse(step)).toThrow();
  });

  test('should require step_number and step_name', () => {
    expect(() => WorkflowStepSchema.parse({ step_type: 'merge' })).toThrow();
    expect(() =>
      WorkflowStepSchema.parse({ step_number: 1, step_type: 'merge' })
    ).toThrow();
  });
});

describe('ScheduleConfigSchema', () => {
  test('should validate cron schedule config', () => {
    const config = {
      schedule_type: 'cron',
      cron_expression: '0 9 * * *',
      timezone: 'America/New_York',
    };

    const result = ScheduleConfigSchema.parse(config);
    expect(result.schedule_type).toBe('cron');
    expect(result.cron_expression).toBe('0 9 * * *');
    expect(result.timezone).toBe('America/New_York');
  });

  test('should validate interval schedule config', () => {
    const config = {
      schedule_type: 'interval',
      interval_seconds: 3600,
    };

    const result = ScheduleConfigSchema.parse(config);
    expect(result.schedule_type).toBe('interval');
    expect(result.interval_seconds).toBe(3600);
  });

  test('should validate date schedule config', () => {
    const config = {
      schedule_type: 'date',
      run_date: '2025-12-31T23:59:59Z',
    };

    const result = ScheduleConfigSchema.parse(config);
    expect(result.schedule_type).toBe('date');
    expect(result.run_date).toBe('2025-12-31T23:59:59Z');
  });

  test('should default timezone to UTC', () => {
    const config = {
      schedule_type: 'cron',
      cron_expression: '0 9 * * *',
    };

    const result = ScheduleConfigSchema.parse(config);
    expect(result.timezone).toBe('UTC');
  });

  test('should reject invalid schedule type', () => {
    const config = {
      schedule_type: 'weekly',
    };

    expect(() => ScheduleConfigSchema.parse(config)).toThrow();
  });
});

describe('WorkflowDefinitionSchema', () => {
  test('should validate a workflow with multiple steps', () => {
    const workflow = {
      steps: [
        {
          step_number: 1,
          step_name: 'Query Users',
          step_type: 'sqlserver_query',
          query: 'SELECT * FROM users',
          save_as: 'users',
        },
        {
          step_number: 2,
          step_name: 'Query Orders',
          step_type: 'redshift_query',
          query: 'SELECT * FROM orders',
          save_as: 'orders',
        },
        {
          step_number: 3,
          step_name: 'Merge Data',
          step_type: 'merge',
          merge_type: 'left_join',
          source_tables: ['users', 'orders'],
          join_keys: ['user_id'],
        },
      ],
      error_handling: 'continue',
    };

    const result = WorkflowDefinitionSchema.parse(workflow);
    expect(result.steps).toHaveLength(3);
    expect(result.error_handling).toBe('continue');
  });

  test('should default error_handling to stop', () => {
    const workflow = {
      steps: [
        {
          step_number: 1,
          step_name: 'Query',
          step_type: 'sqlserver_query',
          query: 'SELECT 1',
        },
      ],
    };

    const result = WorkflowDefinitionSchema.parse(workflow);
    expect(result.error_handling).toBe('stop');
  });

  test('should accept empty steps array', () => {
    const workflow = {
      steps: [],
    };

    const result = WorkflowDefinitionSchema.parse(workflow);
    expect(result.steps).toHaveLength(0);
  });
});

describe('CreateJobRequestSchema', () => {
  test('should validate a minimal workflow job', () => {
    const request = {
      job_name: 'Test Job',
      job_type: 'workflow',
      workflow_definition: {
        steps: [
          {
            step_number: 1,
            step_name: 'Test Query',
            step_type: 'sqlserver_query',
            query: 'SELECT 1',
          },
        ],
      },
    };

    const result = CreateJobRequestSchema.parse(request);
    expect(result.job_name).toBe('Test Job');
    expect(result.job_type).toBe('workflow');
    expect(result.output_format).toBe('csv'); // default
    expect(result.is_active).toBe(true); // default
    expect(result.max_retries).toBe(0); // default
    expect(result.retry_delay_seconds).toBe(60); // default
    expect(result.notify_on_success).toBe(false); // default
    expect(result.notify_on_failure).toBe(true); // default
  });

  test('should validate a function job', () => {
    const request = {
      job_name: 'Export Job',
      job_type: 'function',
      target_function: 'export_to_s3',
    };

    const result = CreateJobRequestSchema.parse(request);
    expect(result.job_type).toBe('function');
    expect(result.target_function).toBe('export_to_s3');
  });

  test('should validate a scheduled job', () => {
    const request = {
      job_name: 'Scheduled Job',
      job_type: 'workflow',
      schedule_config: {
        schedule_type: 'cron',
        cron_expression: '0 9 * * 1',
      },
      workflow_definition: {
        steps: [
          {
            step_number: 1,
            step_name: 'Weekly Report',
            step_type: 'sqlserver_query',
            query: 'SELECT * FROM weekly_metrics',
          },
        ],
      },
    };

    const result = CreateJobRequestSchema.parse(request);
    expect(result.schedule_config?.schedule_type).toBe('cron');
    expect(result.schedule_config?.cron_expression).toBe('0 9 * * 1');
  });

  test('should validate all optional fields', () => {
    const request = {
      job_name: 'Full Job',
      description: 'A complete job with all fields',
      job_type: 'workflow',
      schedule_config: {
        schedule_type: 'interval',
        interval_seconds: 3600,
      },
      workflow_definition: {
        steps: [],
        error_handling: 'retry',
      },
      output_format: 'json',
      author: 'test@example.com',
      is_active: false,
      max_retries: 3,
      retry_delay_seconds: 120,
      notify_on_success: true,
      notify_on_failure: false,
      timeout_seconds: 600,
      tags: ['production', 'etl'],
    };

    const result = CreateJobRequestSchema.parse(request);
    expect(result.description).toBe('A complete job with all fields');
    expect(result.output_format).toBe('json');
    expect(result.author).toBe('test@example.com');
    expect(result.is_active).toBe(false);
    expect(result.max_retries).toBe(3);
    expect(result.retry_delay_seconds).toBe(120);
    expect(result.notify_on_success).toBe(true);
    expect(result.notify_on_failure).toBe(false);
    expect(result.timeout_seconds).toBe(600);
    expect(result.tags).toEqual(['production', 'etl']);
  });

  test('should reject empty job_name', () => {
    const request = {
      job_name: '',
      job_type: 'workflow',
    };

    expect(() => CreateJobRequestSchema.parse(request)).toThrow();
  });

  test('should reject job_name longer than 255 characters', () => {
    const request = {
      job_name: 'a'.repeat(256),
      job_type: 'workflow',
    };

    expect(() => CreateJobRequestSchema.parse(request)).toThrow();
  });

  test('should accept job_name with exactly 255 characters', () => {
    const request = {
      job_name: 'a'.repeat(255),
      job_type: 'workflow',
    };

    const result = CreateJobRequestSchema.parse(request);
    expect(result.job_name).toHaveLength(255);
  });
});

describe('UpdateJobRequestSchema', () => {
  test('should allow partial updates', () => {
    const request = {
      job_name: 'Updated Name',
    };

    const result = UpdateJobRequestSchema.parse(request);
    expect(result.job_name).toBe('Updated Name');
    expect(result.job_type).toBeUndefined();
  });

  test('should accept empty object', () => {
    const request = {};

    const result = UpdateJobRequestSchema.parse(request);
    // Empty object may have default values in partial schema
    expect(result).toBeDefined();
  });

  test('should validate fields when provided', () => {
    const request = {
      output_format: 'invalid',
    };

    expect(() => UpdateJobRequestSchema.parse(request)).toThrow();
  });

  test('should allow updating multiple fields', () => {
    const request = {
      job_name: 'New Name',
      description: 'New Description',
      is_active: false,
      tags: ['new-tag'],
    };

    const result = UpdateJobRequestSchema.parse(request);
    expect(result.job_name).toBe('New Name');
    expect(result.description).toBe('New Description');
    expect(result.is_active).toBe(false);
    expect(result.tags).toEqual(['new-tag']);
  });
});

describe('ScheduleJobRequestSchema', () => {
  test('should validate schedule update request', () => {
    const request = {
      schedule_config: {
        schedule_type: 'cron',
        cron_expression: '30 8 * * *',
      },
    };

    const result = ScheduleJobRequestSchema.parse(request);
    expect(result.schedule_config.schedule_type).toBe('cron');
    expect(result.schedule_config.cron_expression).toBe('30 8 * * *');
  });

  test('should require schedule_config', () => {
    const request = {};

    expect(() => ScheduleJobRequestSchema.parse(request)).toThrow();
  });
});

describe('CronValidationRequestSchema', () => {
  test('should validate cron validation request', () => {
    const request = {
      expression: '0 9 * * *',
    };

    const result = CronValidationRequestSchema.parse(request);
    expect(result.expression).toBe('0 9 * * *');
  });

  test('should require expression', () => {
    const request = {};

    expect(() => CronValidationRequestSchema.parse(request)).toThrow();
  });

  test('should accept any string as expression', () => {
    const request = {
      expression: 'invalid cron',
    };

    // Schema validates it's a string, actual cron validation happens in service
    const result = CronValidationRequestSchema.parse(request);
    expect(result.expression).toBe('invalid cron');
  });
});

describe('RunJobRequestSchema', () => {
  test('should validate run job request with empty parameters', () => {
    const request = {};

    const result = RunJobRequestSchema.parse(request);
    // Should accept empty object
    expect(result).toBeDefined();
  });

  test('should accept undefined parameters', () => {
    const request = { parameters: undefined };

    const result = RunJobRequestSchema.parse(request);
    expect(result.parameters).toBeUndefined();
  });
});
