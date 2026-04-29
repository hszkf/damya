import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { ollamaService, type ChatMessage } from '../services/ollama-service';

export const aiRoutes = new Hono();

// Health check
aiRoutes.get('/health', async (c) => {
  try {
    const health = await ollamaService.healthCheck();
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

// List models
aiRoutes.get('/models', async (c) => {
  try {
    const models = await ollamaService.listModels();
    return c.json({
      success: true,
      data: models,
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

// Non-streaming chat
aiRoutes.post('/chat', async (c) => {
  try {
    const body = await c.req.json();
    const { messages, model, temperature, max_tokens } = body;

    if (!messages || !Array.isArray(messages)) {
      return c.json(
        {
          success: false,
          error: 'messages array is required',
        },
        400
      );
    }

    const response = await ollamaService.chat(messages as ChatMessage[], {
      model,
      temperature,
      max_tokens,
    });

    return c.json({
      success: true,
      data: {
        message: response.message,
        model: response.model,
        done: response.done,
      },
    });
  } catch (error: any) {
    console.error('Chat error:', error);
    return c.json(
      {
        success: false,
        error: error.message || 'Chat failed',
      },
      500
    );
  }
});

// Streaming chat
aiRoutes.post('/chat/stream', async (c) => {
  try {
    const body = await c.req.json();
    const { messages, model, temperature, max_tokens } = body;

    if (!messages || !Array.isArray(messages)) {
      return c.json(
        {
          success: false,
          error: 'messages array is required',
        },
        400
      );
    }

    return streamSSE(c, async (stream) => {
      try {
        for await (const chunk of ollamaService.chatStream(messages as ChatMessage[], {
          model,
          temperature,
          max_tokens,
        })) {
          await stream.writeSSE({
            data: JSON.stringify({ content: chunk }),
          });
        }

        await stream.writeSSE({
          data: JSON.stringify({ done: true }),
        });
      } catch (error: any) {
        await stream.writeSSE({
          data: JSON.stringify({ error: error.message }),
        });
      }
    });
  } catch (error: any) {
    console.error('Stream chat error:', error);
    return c.json(
      {
        success: false,
        error: error.message || 'Stream chat failed',
      },
      500
    );
  }
});

// Chat with memory (placeholder for mem0 integration)
aiRoutes.post('/chat/with-memory', async (c) => {
  try {
    const body = await c.req.json();
    const { messages, model, user_id, temperature, max_tokens } = body;

    if (!messages || !Array.isArray(messages)) {
      return c.json(
        {
          success: false,
          error: 'messages array is required',
        },
        400
      );
    }

    // For now, just use regular chat
    // In production, this would integrate with mem0 for memory persistence
    const response = await ollamaService.chat(messages as ChatMessage[], {
      model,
      temperature,
      max_tokens,
    });

    return c.json({
      success: true,
      data: {
        message: response.message,
        model: response.model,
        done: response.done,
        memory_used: false, // Placeholder
      },
    });
  } catch (error: any) {
    console.error('Chat with memory error:', error);
    return c.json(
      {
        success: false,
        error: error.message || 'Chat with memory failed',
      },
      500
    );
  }
});

// Generate embeddings
aiRoutes.post('/embed', async (c) => {
  try {
    const body = await c.req.json();
    const { text, model } = body;

    if (!text) {
      return c.json(
        {
          success: false,
          error: 'text is required',
        },
        400
      );
    }

    const embedding = await ollamaService.embed(text, model);

    return c.json({
      success: true,
      data: {
        embedding,
        dimensions: embedding.length,
      },
    });
  } catch (error: any) {
    console.error('Embed error:', error);
    return c.json(
      {
        success: false,
        error: error.message || 'Embedding failed',
      },
      500
    );
  }
});
