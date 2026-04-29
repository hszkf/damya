import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { ragService } from '../services/rag-service';

export const ragRoutes = new Hono();

// Health check
ragRoutes.get('/health', async (c) => {
  try {
    const health = await ragService.healthCheck();
    return c.json({
      success: true,
      data: health,
    });
  } catch (error: any) {
    return c.json(
      {
        success: false,
        error: error.message,
      },
      500
    );
  }
});

// Create new session
ragRoutes.post('/session', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { name } = body;

    const session = await ragService.createSession(name);

    return c.json(
      {
        success: true,
        data: session,
      },
      201
    );
  } catch (error: any) {
    console.error('Create session error:', error);
    return c.json(
      {
        success: false,
        error: error.message || 'Failed to create session',
      },
      500
    );
  }
});

// Get session
ragRoutes.get('/session/:sessionId', async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    const session = ragService.getSession(sessionId);

    if (!session) {
      return c.json(
        {
          success: false,
          error: 'Session not found',
        },
        404
      );
    }

    return c.json({
      success: true,
      data: session,
    });
  } catch (error: any) {
    return c.json(
      {
        success: false,
        error: error.message,
      },
      500
    );
  }
});

// Delete session
ragRoutes.delete('/session/:sessionId', async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    await ragService.deleteSession(sessionId);

    return c.json({
      success: true,
      message: 'Session deleted',
    });
  } catch (error: any) {
    return c.json(
      {
        success: false,
        error: error.message,
      },
      500
    );
  }
});

// Upload document to session
ragRoutes.post('/session/:sessionId/documents', async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    const formData = await c.req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return c.json(
        {
          success: false,
          error: 'No file provided',
        },
        400
      );
    }

    const content = Buffer.from(await file.arrayBuffer());
    const docInfo = await ragService.addDocument(
      sessionId,
      file.name,
      content,
      file.type
    );

    return c.json(
      {
        success: true,
        data: docInfo,
      },
      201
    );
  } catch (error: any) {
    console.error('Upload document error:', error);
    return c.json(
      {
        success: false,
        error: error.message || 'Failed to upload document',
      },
      500
    );
  }
});

// List documents in session
ragRoutes.get('/session/:sessionId/documents', async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    const documents = ragService.getDocuments(sessionId);

    return c.json({
      success: true,
      data: documents,
    });
  } catch (error: any) {
    return c.json(
      {
        success: false,
        error: error.message,
      },
      500
    );
  }
});

// Delete document from session
ragRoutes.delete('/session/:sessionId/documents/:documentId', async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    const documentId = c.req.param('documentId');

    await ragService.deleteDocument(sessionId, documentId);

    return c.json({
      success: true,
      message: 'Document deleted',
    });
  } catch (error: any) {
    return c.json(
      {
        success: false,
        error: error.message,
      },
      500
    );
  }
});

// Query (non-streaming)
ragRoutes.post('/session/:sessionId/query', async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    const body = await c.req.json();
    const { question } = body;

    if (!question) {
      return c.json(
        {
          success: false,
          error: 'question is required',
        },
        400
      );
    }

    const result = await ragService.query(sessionId, question);

    return c.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Query error:', error);
    return c.json(
      {
        success: false,
        error: error.message || 'Query failed',
      },
      500
    );
  }
});

// Query (streaming)
ragRoutes.post('/session/:sessionId/query/stream', async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    const body = await c.req.json();
    const { question } = body;

    if (!question) {
      return c.json(
        {
          success: false,
          error: 'question is required',
        },
        400
      );
    }

    return streamSSE(c, async (stream) => {
      try {
        for await (const chunk of ragService.queryStream(sessionId, question)) {
          await stream.writeSSE({
            data: JSON.stringify(chunk),
          });
        }

        await stream.writeSSE({
          data: JSON.stringify({ type: 'done' }),
        });
      } catch (error: any) {
        await stream.writeSSE({
          data: JSON.stringify({ type: 'error', data: error.message }),
        });
      }
    });
  } catch (error: any) {
    console.error('Query stream error:', error);
    return c.json(
      {
        success: false,
        error: error.message || 'Query stream failed',
      },
      500
    );
  }
});
