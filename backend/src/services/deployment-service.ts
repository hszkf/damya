import {
  GlueClient,
  CreateJobCommand,
  UpdateJobCommand,
  GetJobCommand,
  GetJobsCommand,
  CreateTriggerCommand,
  UpdateTriggerCommand,
  GetTriggerCommand,
  DeleteTriggerCommand,
  StartJobRunCommand,
  GetJobRunsCommand,
  type GetJobCommandOutput,
} from '@aws-sdk/client-glue';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { fromIni } from '@aws-sdk/credential-provider-ini';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { Deployment, JobRun } from '../models/deployment';
import { deploymentStore } from './deployment-store';
import { logger } from '../utils/logger';

const ACCOUNT_ID = '545009847083';
const REGION = 'ap-southeast-1';
const GLUE_BUCKET = `aws-glue-assets-${ACCOUNT_ID}-${REGION}`;
const ROLE_ARN = `arn:aws:iam::${ACCOUNT_ID}:role/aws-glue-service-role`;

const glueClient = new GlueClient({
  region: REGION,
  credentials: fromIni({ profile: process.env.AWS_PROFILE || 'data-prod' }),
});

const s3Client = new S3Client({
  region: REGION,
  credentials: fromIni({ profile: process.env.AWS_PROFILE || 'data-prod' }),
});

const SHAREPOINT_CONFIG = {
  site_url: 'https://myarbm.sharepoint.com/sites/ARBMReporting',
  document_library: 'Documents',
  auth: {
    tenant: 'd2efeacf-5b67-4965-bea8-984ad94db574',
    client_id: '77144ce4-fcb3-4b88-b81f-828b0203d9d7',
    thumbprint: '7E7DBB2253AE8D0FDC9C02156E8820982E803FA8',
    resource: 'https://myarbm.sharepoint.com',
    private_key: `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC887ju6YQKfddk
+ii/svgmOa9IKORMueBR/fZt2axDcYwd5sGGPJAuCq+2lxqNvN9ymlWqv0HeUV89
6G0jZ3pjjhqjxiF2b6kk8kmX++Tna5/oHeLP7n2NuqeE7fJ334HuOgYjhj24lwdb
B1GQ4ryUIMeuNS4nGc2PH/cSGgxncr9w5dpBvcLyQpmv2ZEFoZ1GvQafS0FYMlMA
A5BVGptNYSJqVRep2CwnDI9XLW20bxHSNz5xfl/Nx3tCHIRnjtqWUrOrFTOJZODN
j6xz1DSi1MazUIUgeoZLmGFPqR5dPEXCGUtbFb9nBohhbH3WXMO0XakGu00hykCJ
fgUtKuZ5AgMBAAECggEBALM5bnnXL3KQKMXT7uDeTjhb0OHeP6ZzTM4Y2S0bIiWa
x2/5WCkOuyeg5UiJDRvSQhQ/RfC+lyjcAD4Ff7fsSA+0U5pyrXzcrxCnbJznxhio
YjXWWzQloBvWJ12UIcAIVgL0MKxzgYncX5K9X2XRW1QZv62DLfLSq8MNa9pUsN1R
PBLFdUHzmJlzWAGsmWFJSMsSQ7bpgO2N21+LDjl7hUtr+z9xKuYGB4Lr1tgIWuG1
z2yA4S6nvV4P21sVlwu9pjvMeoA0Gx4EgIPi2I2QUXKqWm+C94VgOtjCIVEJb757
jFqHZCbv3YBhBI05G4k+lv4ihnO0FbVK0C0oXIFHiQECgYEA8hupvtR17lYRIrld
8tTh3rWsaywMUAJPinIK6mSB/VklbQCkBr0rZ91yemQDF/5XRxCXFX4bqvb3MJBP
iXI/JCeFtSbvllwReJkozssTN3Xvj72FXmTn0cNUM46NV4k50thbrY7fO/iq2cA7
x26RfnOfUOMqjJeJyYH6IA8xJFkCgYEAx8s/ff+hPiKEV3mWa0LUTVoDMOUfIElz
JK5pqTQOumHax6FLQSKzr+9/i4rXmKcHobJRJ0sCSnd43mkinA+i3hbbkCyf1CE/
qYSQuLNjOcIj09TUbOSmKa3GaI64GspcAhci/+u7zjiG5Q8ZLY9l9jFW3R1l9UjS
4KlUY4XUDyECgYB4KXCrLOnHO+JPWK8fSbc9APAtVPRbdXoi3Y07Xl0B8A/aNNo0
GgmECG27/w1mCC8rLzm9ShTTWrW+3bEMJ67c89yx1zxMZS+qqmGNmU7VVOxsbATY
n75K5uZQnGzcSFhxpD6EOofjTP0HDBjfV6pQl3Q4AjdpBgE2CROqe7/JKQKBgFyd
jzUtRuWywn56UowuUpP44fnMfH1PDx017K0PALTNn8lir6vmFj28W/enyQFujE8c
hhoc31b9wv325qBJb0pcdjODPCPttcEzPpMgNSMVJ96OjlpcM9qmP49AeX+Rxs0B
RKw17r1N3tpYAWfpTW6uuIGPmy/1LiwO0pu/8emBAoGBAL1wNtSvXNtu5NwHmy3n
ksUsvAxwuijNRNpa0VzqNgXLQwhMlu+9l58wb83eouKtzoIpJDEo9Ra3mjSSPDiW
2wPV2aKBqdehXfk8B97csp5XkJyyhBEdMGqn2Y9eQ1T4VWVs3IjLNqtearwxOzLr
hFSIPFOfhOXPVxuobjIwCrrd
-----END PRIVATE KEY-----`,
  },
};

function getS3Paths(deployment: Deployment) {
  const prefix = `src/damya/${deployment.glue_job_name}`;
  return {
    python: `${prefix}/${deployment.glue_job_name}.py`,
    yaml: `${prefix}/${deployment.glue_job_name}.yaml`,
    sql: `${prefix}/${deployment.glue_job_name}.sql`,
    pythonFull: `s3://${GLUE_BUCKET}/${prefix}/${deployment.glue_job_name}.py`,
    yamlFull: `s3://${GLUE_BUCKET}/${prefix}/${deployment.glue_job_name}.yaml`,
    sqlFull: `s3://${GLUE_BUCKET}/${prefix}/${deployment.glue_job_name}.sql`,
  };
}

function generateYamlConfig(deployment: Deployment): string {
  const spFolderName = deployment.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+$/g, '');

  const config = {
    aws: {
      account_id: ACCOUNT_ID,
      region: REGION,
      role_arn: ROLE_ARN,
      glue_bucket: GLUE_BUCKET,
    },
    s3: {
      output: {
        bucket: 'prod-545009847083-analytics-reporting',
        directory: `reports/${deployment.glue_job_name}`,
      },
    },
    sharepoint: {
      ...SHAREPOINT_CONFIG,
      folder_path: ['Reporting', spFolderName],
    },
    email: {
      from: 'arbmdata@alrajhibank.com.my',
      to: deployment.email_to,
      cc: deployment.email_cc,
      subject: deployment.email_subject,
      graph_endpoint: 'https://graph.microsoft.com/v1.0',
    },
    job: {
      name: deployment.glue_job_name,
      description: deployment.description || deployment.name,
      sql_tag: deployment.sql_tag,
    },
    spark: {
      config: {
        'spark.sql.adaptive.enabled': 'true',
        'spark.sql.adaptive.coalescePartitions.enabled': 'true',
        'spark.sql.shuffle.partitions': '10',
        'spark.default.parallelism': '10',
        'spark.sql.broadcastTimeout': '3600',
        'spark.sql.autoBroadcastJoinThreshold': '10485760',
      },
      job_args: {
        'enable-metrics': 'true',
        'enable-continuous-cloudwatch-log': 'true',
        'enable-spark-ui': 'true',
        'enable-job-insights': 'true',
        'job-language': 'python',
        'TempDir': `s3://aws-glue-temporary-${ACCOUNT_ID}-${REGION}/temporary/`,
        'spark-event-logs-path': `s3://${GLUE_BUCKET}/sparkHistoryLogs/`,
      },
    },
    excel: {
      sheets: [deployment.name.length > 31 ? deployment.name.slice(0, 31) : deployment.name],
      float_format: '%.2f',
      header_format: {
        bold: false,
        text_wrap: true,
        valign: 'vcenter',
        align: 'center',
        bg_color: '#4F81BD',
        font_color: 'white',
        border: 1,
      },
      max_column_width: 50,
    },
  };

  let yaml = '';
  const flatten = (obj: any, indent: number = 0): void => {
    for (const [key, value] of Object.entries(obj)) {
      const prefix = '  '.repeat(indent);
      if (value === null || value === undefined) {
        yaml += `${prefix}${key}: null\n`;
      } else if (typeof value === 'string') {
        if (value.includes('\n')) {
          yaml += `${prefix}${key}: |\n`;
          for (const line of value.split('\n')) {
            yaml += `${prefix}  ${line}\n`;
          }
        } else if (value.includes(':') || value.includes('#') || value.includes("'") || value.includes('"')) {
          yaml += `${prefix}${key}: "${value.replace(/"/g, '\\"')}"\n`;
        } else {
          yaml += `${prefix}${key}: ${value}\n`;
        }
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        yaml += `${prefix}${key}: ${value}\n`;
      } else if (Array.isArray(value)) {
        if (value.length === 0) {
          yaml += `${prefix}${key}: []\n`;
        } else if (typeof value[0] === 'string') {
          for (const item of value) {
            yaml += `${prefix}- ${item}\n`;
          }
        } else {
          yaml += `${prefix}${key}:\n`;
          for (const item of value) {
            flatten(item, indent + 1);
            yaml += `${prefix}\n`;
          }
        }
      } else if (typeof value === 'object') {
        yaml += `${prefix}${key}:\n`;
        flatten(value, indent + 1);
      }
    }
  };
  flatten(config);
  return yaml;
}

function generateSqlFile(deployment: Deployment): string {
  return `-- @${deployment.sql_tag}\n${deployment.sql_query}`;
}

function getPythonTemplate(): string {
  const templatePath = join(import.meta.dir, '../templates/glue_job_template.py');
  return readFileSync(templatePath, 'utf-8');
}

async function uploadToS3(key: string, content: string): Promise<void> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: GLUE_BUCKET,
      Key: key,
      Body: content,
    })
  );
  logger.info(`Uploaded to S3: s3://${GLUE_BUCKET}/${key}`);
}

function buildGlueArguments(deployment: Deployment, paths: ReturnType<typeof getS3Paths>) {
  return {
    '--enable-continuous-cloudwatch-log': 'true',
    '--enable-metrics': 'true',
    '--enable-spark-ui': 'true',
    '--spark-event-logs-path': `s3://${GLUE_BUCKET}/sparkHistoryLogs/`,
    '--enable-job-insights': 'true',
    '--enable-glue-datacatalog': 'true',
    '--job-language': 'python',
    '--YAML_S3_PATH': paths.yamlFull,
    '--SQL_S3_PATH': paths.sqlFull,
    '--additional-python-modules': 'pyyaml,boto3,msal,office365-REST-Python-Client,xlsxwriter,requests',
    '--datalake-formats': 'iceberg',
    '--conf': [
      'spark.sql.extensions=org.apache.iceberg.spark.extensions.IcebergSparkSessionExtensions',
      'spark.sql.catalog.glue_catalog=org.apache.iceberg.spark.SparkCatalog',
      `spark.sql.catalog.glue_catalog.warehouse=s3://prod-${ACCOUNT_ID}-on-prem-archived-s3`,
      'spark.sql.catalog.glue_catalog.catalog-impl=org.apache.iceberg.aws.glue.GlueCatalog',
      'spark.sql.catalog.glue_catalog.io-impl=org.apache.iceberg.aws.s3.S3FileIO',
      'spark.sql.defaultCatalog=glue_catalog',
    ].join(' --conf '),
    '--TempDir': `s3://aws-glue-temporary-${ACCOUNT_ID}-${REGION}/temporary/`,
  };
}

function toGlueCron(cronExpression: string): string {
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length === 5) {
    return `cron(${parts[0]} ${parts[1]} ${parts[2]} ${parts[3]} ${parts[4]} *)`;
  }
  if (parts.length === 6) {
    return `cron(${parts.join(' ')})`;
  }
  return `cron(${cronExpression})`;
}

export class DeploymentService {
  async deploy(deploymentId: string): Promise<Deployment> {
    const deployment = deploymentStore.getById(deploymentId);
    if (!deployment) throw new Error('Deployment not found');

    const paths = getS3Paths(deployment);

    logger.info('Deploying to AWS Glue', { metadata: { jobName: deployment.glue_job_name } });

    // 1. Upload files to S3
    const yamlContent = generateYamlConfig(deployment);
    const sqlContent = generateSqlFile(deployment);
    const pythonContent = getPythonTemplate();

    await uploadToS3(paths.yaml, yamlContent);
    await uploadToS3(paths.sql, sqlContent);
    await uploadToS3(paths.python, pythonContent);

    const glueArgs = buildGlueArguments(deployment, paths);

    // 2. Create or update Glue job
    let jobExists = false;
    try {
      await glueClient.send(new GetJobCommand({ JobName: deployment.glue_job_name }));
      jobExists = true;
    } catch {
      // Job doesn't exist
    }

    if (jobExists) {
      logger.info('Updating existing Glue job', { metadata: { jobName: deployment.glue_job_name } });
      await glueClient.send(
        new UpdateJobCommand({
          JobName: deployment.glue_job_name,
          JobUpdate: {
            Role: ROLE_ARN,
            Command: {
              Name: 'glueetl',
              ScriptLocation: paths.pythonFull,
              PythonVersion: '3',
            },
            DefaultArguments: glueArgs,
            Description: deployment.description || deployment.name,
            MaxRetries: deployment.max_retries,
            Timeout: deployment.timeout_minutes,
            WorkerType: deployment.worker_type,
            NumberOfWorkers: deployment.num_workers,
            GlueVersion: deployment.glue_version,
          },
        })
      );
    } else {
      logger.info('Creating new Glue job', { metadata: { jobName: deployment.glue_job_name } });
      await glueClient.send(
        new CreateJobCommand({
          Name: deployment.glue_job_name,
          Role: ROLE_ARN,
          Command: {
            Name: 'glueetl',
            ScriptLocation: paths.pythonFull,
            PythonVersion: '3',
          },
          DefaultArguments: glueArgs,
          Description: deployment.description || deployment.name,
          MaxRetries: deployment.max_retries,
          Timeout: deployment.timeout_minutes,
          WorkerType: deployment.worker_type,
          NumberOfWorkers: deployment.num_workers,
          GlueVersion: deployment.glue_version,
        })
      );
    }

    // 3. Create or update trigger
    const glueCron = toGlueCron(deployment.cron_expression);
    let triggerExists = false;
    try {
      await glueClient.send(new GetTriggerCommand({ Name: deployment.glue_trigger_name }));
      triggerExists = true;
    } catch {
      // Trigger doesn't exist
    }

    if (triggerExists) {
      logger.info('Updating existing Glue trigger', { metadata: { triggerName: deployment.glue_trigger_name } });
      await glueClient.send(
        new UpdateTriggerCommand({
          Name: deployment.glue_trigger_name,
          TriggerUpdate: {
            Schedule: glueCron,
            Actions: [{ JobName: deployment.glue_job_name }],
            Description: `Scheduled trigger for ${deployment.glue_job_name}`,
          },
        })
      );
    } else {
      logger.info('Creating new Glue trigger', { metadata: { triggerName: deployment.glue_trigger_name } });
      await glueClient.send(
        new CreateTriggerCommand({
          Name: deployment.glue_trigger_name,
          Type: 'SCHEDULED',
          Schedule: glueCron,
          Actions: [{ JobName: deployment.glue_job_name }],
          Description: `Scheduled trigger for ${deployment.glue_job_name}`,
          StartOnCreation: true,
        })
      );
    }

    // 4. Update deployment status
    const updated = deploymentStore.updateStatus(deploymentId, {
      status: 'deployed',
      last_deployed_at: new Date().toISOString(),
    });

    if (!updated) throw new Error('Failed to update deployment status');
    return updated;
  }

  async undeploy(deploymentId: string): Promise<void> {
    const deployment = deploymentStore.getById(deploymentId);
    if (!deployment) throw new Error('Deployment not found');

    // Delete trigger
    try {
      await glueClient.send(new DeleteTriggerCommand({ Name: deployment.glue_trigger_name }));
      logger.info('Deleted Glue trigger', { metadata: { triggerName: deployment.glue_trigger_name } });
    } catch {
      // Trigger may not exist
    }

    // Delete job
    try {
      const { DeleteJobCommand } = await import('@aws-sdk/client-glue');
      await glueClient.send(new DeleteJobCommand({ JobName: deployment.glue_job_name }));
      logger.info('Deleted Glue job', { metadata: { jobName: deployment.glue_job_name } });
    } catch {
      // Job may not exist
    }

    deploymentStore.updateStatus(deploymentId, { status: 'draft', last_deployed_at: null });
  }

  async startRun(deploymentId: string): Promise<{ runId: string }> {
    const deployment = deploymentStore.getById(deploymentId);
    if (!deployment) throw new Error('Deployment not found');
    if (deployment.status !== 'deployed') throw new Error('Deployment must be deployed first');

    const result = await glueClient.send(
      new StartJobRunCommand({ JobName: deployment.glue_job_name })
    );

    const runId = result.JobRunId || '';
    deploymentStore.updateStatus(deploymentId, {
      last_run_status: 'RUNNING',
      last_run_at: new Date().toISOString(),
      last_run_id: runId,
    });

    logger.info('Started Glue job run', { metadata: { jobName: deployment.glue_job_name, runId } });
    return { runId };
  }

  async getJobRuns(deploymentId: string, maxResults: number = 10): Promise<JobRun[]> {
    const deployment = deploymentStore.getById(deploymentId);
    if (!deployment) throw new Error('Deployment not found');

    const result = await glueClient.send(
      new GetJobRunsCommand({
        JobName: deployment.glue_job_name,
        MaxResults: maxResults,
      })
    );

    const runs: JobRun[] = (result.JobRuns || []).map((run) => ({
      id: run.Id || '',
      status: run.JobRunState || 'UNKNOWN',
      started_on: run.StartedOn?.toISOString() || null,
      completed_on: run.CompletedOn?.toISOString() || null,
      execution_time: run.ExecutionTime || 0,
      error_message: run.ErrorMessage || null,
      trigger_type: run.TriggerType || 'MANUAL',
      attempt: run.Attempt || 0,
    }));

    // Update last run status
    if (runs.length > 0 && runs[0].status !== 'RUNNING') {
      deploymentStore.updateStatus(deploymentId, {
        last_run_status: runs[0].status,
        last_run_at: runs[0].started_on,
        last_run_id: runs[0].id,
      });
    }

    return runs;
  }

  async checkHealth(): Promise<{ connected: boolean; region: string }> {
    try {
      await glueClient.send(new GetJobCommand({ JobName: 'nonexistent-job-health-check' }));
      return { connected: true, region: REGION };
    } catch (err: any) {
      if (err.name === 'EntityNotFoundException') {
        return { connected: true, region: REGION };
      }
      return { connected: false, region: REGION };
    }
  }

  async listGlueJobs(): Promise<{
    jobs: Array<{
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
    }>;
  }> {
    const allJobs: any[] = [];
    let nextToken: string | undefined;

    do {
      const result = await glueClient.send(new GetJobsCommand({ NextToken: nextToken, MaxResults: 100 }));
      if (result.Jobs) {
        allJobs.push(...result.Jobs);
      }
      nextToken = result.NextToken;
    } while (nextToken);

    const jobs = allJobs.map((job) => ({
      name: job.Name || '',
      description: job.Description || '',
      role: job.Role || '',
      created_on: job.CreatedOn?.toISOString() || '',
      last_modified_on: job.LastModifiedOn?.toISOString() || '',
      worker_type: job.WorkerType || '',
      number_of_workers: job.NumberOfWorkers || 0,
      glue_version: job.GlueVersion || '',
      timeout: job.Timeout || 0,
      command: {
        name: job.Command?.Name || '',
        script_location: job.Command?.ScriptLocation || '',
        python_version: job.Command?.PythonVersion || '',
      },
    }));

    return { jobs };
  }
}

export const deploymentService = new DeploymentService();
