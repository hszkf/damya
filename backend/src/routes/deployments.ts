import { Hono } from 'hono';
import { CreateDeploymentSchema, UpdateDeploymentSchema } from '../models/deployment';
import { deploymentStore } from '../services/deployment-store';
import { deploymentService } from '../services/deployment-service';
import { logger } from '../utils/logger';

export const deploymentRoutes = new Hono();

// Health check (must be before /:id)
deploymentRoutes.get('/health', async (c) => {
  const health = await deploymentService.checkHealth();
  return c.json({ status: 'success', ...health });
});

// List all AWS Glue jobs (must be before /:id)
deploymentRoutes.get('/glue-jobs', async (c) => {
  try {
    const result = await deploymentService.listGlueJobs();
    return c.json({ status: 'success', ...result });
  } catch (error: any) {
    logger.error('Failed to list Glue jobs', error);
    return c.json({ status: 'error', error: error.message }, 500);
  }
});

// List all deployments
deploymentRoutes.get('/', async (c) => {
  const deployments = deploymentStore.getAll();
  return c.json({ status: 'success', deployments });
});

// Get single deployment
deploymentRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const deployment = deploymentStore.getById(id);
  if (!deployment) {
    return c.json({ status: 'error', error: 'Deployment not found' }, 404);
  }
  return c.json({ status: 'success', deployment });
});

// Create deployment
deploymentRoutes.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const validated = CreateDeploymentSchema.parse(body);
    const deployment = deploymentStore.create(validated);
    logger.info('Deployment created', { metadata: { id: deployment.id, name: deployment.name } });
    return c.json({ status: 'success', deployment }, 201);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return c.json({ status: 'error', error: error.errors.map((e: any) => e.message).join(', ') }, 400);
    }
    return c.json({ status: 'error', error: error.message }, 400);
  }
});

// Update deployment
deploymentRoutes.put('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const validated = UpdateDeploymentSchema.parse(body);
    const deployment = deploymentStore.update(id, validated);
    if (!deployment) {
      return c.json({ status: 'error', error: 'Deployment not found' }, 404);
    }
    return c.json({ status: 'success', deployment });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return c.json({ status: 'error', error: error.errors.map((e: any) => e.message).join(', ') }, 400);
    }
    return c.json({ status: 'error', error: error.message }, 400);
  }
});

// Delete deployment
deploymentRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const deployment = deploymentStore.getById(id);
  if (!deployment) {
    return c.json({ status: 'error', error: 'Deployment not found' }, 404);
  }

  // Undeploy if currently deployed
  if (deployment.status === 'deployed') {
    try {
      await deploymentService.undeploy(id);
    } catch (err: any) {
      logger.warn('Failed to undeploy during delete', { error: err.message });
    }
  }

  deploymentStore.delete(id);
  return c.json({ status: 'success', message: 'Deployment deleted' });
});

// Deploy to AWS Glue
deploymentRoutes.post('/:id/deploy', async (c) => {
  try {
    const id = c.req.param('id');
    const deployment = await deploymentService.deploy(id);
    return c.json({ status: 'success', deployment, message: 'Deployed to AWS Glue successfully' });
  } catch (error: any) {
    logger.error('Deploy failed', error);
    deploymentStore.updateStatus(c.req.param('id'), { status: 'failed' });
    return c.json({ status: 'error', error: error.message }, 500);
  }
});

// Undeploy from AWS Glue
deploymentRoutes.post('/:id/undeploy', async (c) => {
  try {
    const id = c.req.param('id');
    await deploymentService.undeploy(id);
    return c.json({ status: 'success', message: 'Undeployed from AWS Glue' });
  } catch (error: any) {
    logger.error('Undeploy failed', error);
    return c.json({ status: 'error', error: error.message }, 500);
  }
});

// Trigger manual run
deploymentRoutes.post('/:id/run', async (c) => {
  try {
    const id = c.req.param('id');
    const { runId } = await deploymentService.startRun(id);
    return c.json({ status: 'success', run_id: runId, message: 'Job run started' });
  } catch (error: any) {
    logger.error('Start run failed', error);
    return c.json({ status: 'error', error: error.message }, 500);
  }
});

// Get job runs
deploymentRoutes.get('/:id/runs', async (c) => {
  try {
    const id = c.req.param('id');
    const maxResults = parseInt(c.req.query('max_results') || '10');
    const runs = await deploymentService.getJobRuns(id, maxResults);
    return c.json({ status: 'success', runs });
  } catch (error: any) {
    return c.json({ status: 'error', error: error.message }, 500);
  }
});

