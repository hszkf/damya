import { describe, expect, test, mock, beforeEach } from 'bun:test';
import { Hono } from 'hono';

// Mock ollama service
const mockOllamaService = {
  healthCheck: mock(() =>
    Promise.resolve({
      status: 'healthy',
      models: ['llama2', 'qwen3'],
    })
  ),
  listModels: mock(() => Promise.resolve(['llama2', 'mistral', 'qwen3'])),
  chat: mock(() =>
    Promise.resolve({
      model: 'qwen3',
      message: { role: 'assistant', content: 'Hello! How can I help?' },
      done: true,
    })
  ),
  chatStream: mock(async function* () {
    yield 'Hello';
    yield ' World';
    yield '!';
  }),
  embed: mock(() => Promise.resolve(new Array(384).fill(0.1))),
};

mock.module('../../services/ollama-service', () => ({
  ollamaService: mockOllamaService,
}));

// Import routes after mocking
import { aiRoutes } from '../../routes/ai';

describe('AI Routes', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.route('/ai', aiRoutes);

    // Clear all mocks
    Object.values(mockOllamaService).forEach((m) => m.mockClear());
  });

  describe('GET /ai/health', () => {
    test('should return healthy status with models', async () => {
      const res = await app.request('/ai/health');
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.status).toBe('healthy');
      expect(json.data.models).toContain('llama2');
    });

    test('should handle health check errors', async () => {
      mockOllamaService.healthCheck.mockRejectedValueOnce(new Error('Ollama not available'));

      const res = await app.request('/ai/health');
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.success).toBe(false);
    });
  });

  describe('GET /ai/models', () => {
    test('should return list of available models', async () => {
      const res = await app.request('/ai/models');
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toContain('llama2');
      expect(json.data).toContain('mistral');
      expect(json.data).toContain('qwen3');
    });

    test('should handle model listing errors', async () => {
      mockOllamaService.listModels.mockRejectedValueOnce(new Error('Failed to list models'));

      const res = await app.request('/ai/models');
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.success).toBe(false);
    });
  });

  describe('POST /ai/chat', () => {
    test('should send chat message and receive response', async () => {
      const res = await app.request('/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello!' }],
        }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.message.content).toBe('Hello! How can I help?');
      expect(json.data.done).toBe(true);
    });

    test('should accept model, temperature and max_tokens options', async () => {
      await app.request('/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Test' }],
          model: 'llama2',
          temperature: 0.5,
          max_tokens: 100,
        }),
      });

      expect(mockOllamaService.chat).toHaveBeenCalledWith(
        [{ role: 'user', content: 'Test' }],
        { model: 'llama2', temperature: 0.5, max_tokens: 100 }
      );
    });

    test('should return 400 when messages is missing', async () => {
      const res = await app.request('/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toContain('messages');
    });

    test('should return 400 when messages is not an array', async () => {
      const res = await app.request('/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: 'not an array' }),
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
    });

    test('should handle chat errors', async () => {
      mockOllamaService.chat.mockRejectedValueOnce(new Error('Model not found'));

      const res = await app.request('/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Test' }],
        }),
      });
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.success).toBe(false);
    });
  });

  describe('POST /ai/chat/stream', () => {
    test('should stream chat response', async () => {
      const res = await app.request('/ai/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello!' }],
        }),
      });

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('text/event-stream');
    });

    test('should return 400 when messages is missing', async () => {
      const res = await app.request('/ai/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
    });
  });

  describe('POST /ai/chat/with-memory', () => {
    test('should send chat with memory (placeholder)', async () => {
      const res = await app.request('/ai/chat/with-memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Remember my name is John' }],
          user_id: 'user-123',
        }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.memory_used).toBe(false); // Placeholder
    });

    test('should return 400 when messages is missing', async () => {
      const res = await app.request('/ai/chat/with-memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: 'user-123' }),
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
    });
  });

  describe('POST /ai/embed', () => {
    test('should generate embeddings for text', async () => {
      const res = await app.request('/ai/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Hello world' }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.embedding).toHaveLength(384);
      expect(json.data.dimensions).toBe(384);
    });

    test('should accept custom model', async () => {
      await app.request('/ai/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: 'Test text',
          model: 'custom-embed-model',
        }),
      });

      expect(mockOllamaService.embed).toHaveBeenCalledWith('Test text', 'custom-embed-model');
    });

    test('should return 400 when text is missing', async () => {
      const res = await app.request('/ai/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toContain('text');
    });

    test('should handle embedding errors', async () => {
      mockOllamaService.embed.mockRejectedValueOnce(new Error('Embedding failed'));

      const res = await app.request('/ai/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Test' }),
      });
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.success).toBe(false);
    });
  });
});
