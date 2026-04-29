import { describe, expect, test, mock, beforeEach } from 'bun:test';
import { Hono } from 'hono';

// Mock RAG service
const mockRagService = {
  healthCheck: mock(() =>
    Promise.resolve({
      status: 'healthy',
      chroma: true,
    })
  ),
  createSession: mock(() =>
    Promise.resolve({
      id: 'session-123',
      name: 'Test Session',
      documents: [],
      createdAt: new Date(),
    })
  ),
  getSession: mock(() => null),
  deleteSession: mock(() => Promise.resolve()),
  addDocument: mock(() =>
    Promise.resolve({
      id: 'doc-123',
      name: 'test.txt',
      size: 100,
      type: 'text/plain',
      chunks: 2,
      uploadedAt: new Date(),
    })
  ),
  getDocuments: mock(() => []),
  deleteDocument: mock(() => Promise.resolve()),
  query: mock(() =>
    Promise.resolve({
      answer: 'This is the answer based on the documents.',
      citations: [
        {
          documentId: 'doc-1',
          documentName: 'source.txt',
          content: 'Relevant content',
          score: 0.9,
        },
      ],
    })
  ),
  queryStream: mock(async function* () {
    yield { type: 'citations', data: [] };
    yield { type: 'content', data: 'Streaming response' };
  }),
};

mock.module('../../services/rag-service', () => ({
  ragService: mockRagService,
}));

// Import routes after mocking
import { ragRoutes } from '../../routes/rag';

describe('RAG Routes', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.route('/rag', ragRoutes);

    // Clear all mocks
    Object.values(mockRagService).forEach((m) => m.mockClear());
  });

  describe('GET /rag/health', () => {
    test('should return healthy status', async () => {
      const res = await app.request('/rag/health');
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.status).toBe('healthy');
      expect(json.data.chroma).toBe(true);
    });

    test('should handle health check errors', async () => {
      mockRagService.healthCheck.mockRejectedValueOnce(new Error('ChromaDB error'));

      const res = await app.request('/rag/health');
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.success).toBe(false);
    });
  });

  describe('POST /rag/session', () => {
    test('should create new session', async () => {
      const res = await app.request('/rag/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.success).toBe(true);
      expect(json.data.id).toBe('session-123');
    });

    test('should create session with custom name', async () => {
      mockRagService.createSession.mockResolvedValueOnce({
        id: 'session-456',
        name: 'Custom Session',
        documents: [],
        createdAt: new Date(),
      });

      const res = await app.request('/rag/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Custom Session' }),
      });
      const json = await res.json();

      expect(json.data.name).toBe('Custom Session');
    });

    test('should handle empty body', async () => {
      const res = await app.request('/rag/session', {
        method: 'POST',
      });

      expect(res.status).toBe(201);
    });
  });

  describe('GET /rag/session/:sessionId', () => {
    test('should return session when found', async () => {
      mockRagService.getSession.mockReturnValueOnce({
        id: 'session-123',
        name: 'Test Session',
        documents: [],
        createdAt: new Date(),
      });

      const res = await app.request('/rag/session/session-123');
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.id).toBe('session-123');
    });

    test('should return 404 when session not found', async () => {
      mockRagService.getSession.mockReturnValueOnce(null);

      const res = await app.request('/rag/session/non-existent');
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.success).toBe(false);
      expect(json.error).toContain('not found');
    });
  });

  describe('DELETE /rag/session/:sessionId', () => {
    test('should delete session', async () => {
      const res = await app.request('/rag/session/session-123', { method: 'DELETE' });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(mockRagService.deleteSession).toHaveBeenCalledWith('session-123');
    });

    test('should handle delete errors', async () => {
      mockRagService.deleteSession.mockRejectedValueOnce(new Error('Delete failed'));

      const res = await app.request('/rag/session/session-123', { method: 'DELETE' });
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.success).toBe(false);
    });
  });

  describe('POST /rag/session/:sessionId/documents', () => {
    test('should upload document to session', async () => {
      const formData = new FormData();
      formData.append(
        'file',
        new File(['Test document content'], 'document.txt', { type: 'text/plain' })
      );

      const res = await app.request('/rag/session/session-123/documents', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.success).toBe(true);
      expect(json.data.id).toBe('doc-123');
      expect(json.data.name).toBe('test.txt');
    });

    test('should return 400 when no file provided', async () => {
      const formData = new FormData();

      const res = await app.request('/rag/session/session-123/documents', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toContain('No file');
    });

    test('should handle upload errors', async () => {
      const formData = new FormData();
      formData.append('file', new File(['Content'], 'test.txt'));

      mockRagService.addDocument.mockRejectedValueOnce(new Error('Session not found'));

      const res = await app.request('/rag/session/session-123/documents', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.success).toBe(false);
    });
  });

  describe('GET /rag/session/:sessionId/documents', () => {
    test('should list documents in session', async () => {
      mockRagService.getDocuments.mockReturnValueOnce([
        { id: 'doc-1', name: 'file1.txt', size: 100, type: 'text/plain', chunks: 2 },
        { id: 'doc-2', name: 'file2.txt', size: 200, type: 'text/plain', chunks: 3 },
      ]);

      const res = await app.request('/rag/session/session-123/documents');
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(2);
    });

    test('should return empty array for session with no documents', async () => {
      mockRagService.getDocuments.mockReturnValueOnce([]);

      const res = await app.request('/rag/session/session-123/documents');
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data).toEqual([]);
    });
  });

  describe('DELETE /rag/session/:sessionId/documents/:documentId', () => {
    test('should delete document from session', async () => {
      const res = await app.request('/rag/session/session-123/documents/doc-123', {
        method: 'DELETE',
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(mockRagService.deleteDocument).toHaveBeenCalledWith('session-123', 'doc-123');
    });

    test('should handle delete errors', async () => {
      mockRagService.deleteDocument.mockRejectedValueOnce(new Error('Document not found'));

      const res = await app.request('/rag/session/session-123/documents/doc-123', {
        method: 'DELETE',
      });
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.success).toBe(false);
    });
  });

  describe('POST /rag/session/:sessionId/query', () => {
    test('should query session and return answer with citations', async () => {
      const res = await app.request('/rag/session/session-123/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: 'What is the main topic?' }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.answer).toBeDefined();
      expect(json.data.citations).toHaveLength(1);
    });

    test('should return 400 when question is missing', async () => {
      const res = await app.request('/rag/session/session-123/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toContain('question');
    });

    test('should handle query errors', async () => {
      mockRagService.query.mockRejectedValueOnce(new Error('Session not found'));

      const res = await app.request('/rag/session/session-123/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: 'Test?' }),
      });
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.success).toBe(false);
    });
  });

  describe('POST /rag/session/:sessionId/query/stream', () => {
    test('should stream query response', async () => {
      const res = await app.request('/rag/session/session-123/query/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: 'What is the answer?' }),
      });

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('text/event-stream');
    });

    test('should return 400 when question is missing', async () => {
      const res = await app.request('/rag/session/session-123/query/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
    });
  });
});
