import { ChromaClient, Collection } from 'chromadb';
import { ollamaService, type ChatMessage } from './ollama-service';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

const CHROMA_HOST = process.env.CHROMA_HOST || 'localhost';
const CHROMA_PORT = parseInt(process.env.CHROMA_PORT || '8000');
const DATA_DIR = process.env.RAG_DATA_DIR || './data';

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export interface RAGSession {
  id: string;
  name: string;
  documents: DocumentInfo[];
  createdAt: Date;
}

export interface DocumentInfo {
  id: string;
  name: string;
  size: number;
  type: string;
  chunks: number;
  uploadedAt: Date;
}

export interface Citation {
  documentId: string;
  documentName: string;
  content: string;
  score: number;
}

export interface QueryResult {
  answer: string;
  citations: Citation[];
}

class RAGService {
  private client: ChromaClient | null = null;
  private sessions: Map<string, RAGSession> = new Map();
  private collections: Map<string, Collection> = new Map();

  async initialize(): Promise<void> {
    try {
      this.client = new ChromaClient({
        path: `http://${CHROMA_HOST}:${CHROMA_PORT}`,
      });
      console.log('ChromaDB client initialized');
    } catch (error) {
      console.warn('ChromaDB not available, using in-memory fallback');
      this.client = null;
    }
  }

  // Health check
  async healthCheck(): Promise<{ status: string; chroma: boolean }> {
    try {
      if (this.client) {
        await this.client.heartbeat();
        return { status: 'healthy', chroma: true };
      }
      return { status: 'degraded', chroma: false };
    } catch {
      return { status: 'unhealthy', chroma: false };
    }
  }

  // Create a new RAG session
  async createSession(name?: string): Promise<RAGSession> {
    const id = uuidv4();
    const session: RAGSession = {
      id,
      name: name || `Session ${id.slice(0, 8)}`,
      documents: [],
      createdAt: new Date(),
    };

    this.sessions.set(id, session);

    // Create ChromaDB collection for this session
    if (this.client) {
      try {
        const collection = await this.client.getOrCreateCollection({
          name: `session_${id.replace(/-/g, '_')}`,
        });
        this.collections.set(id, collection);
      } catch (error) {
        console.error('Error creating collection:', error);
      }
    }

    return session;
  }

  // Get session
  getSession(sessionId: string): RAGSession | null {
    return this.sessions.get(sessionId) || null;
  }

  // Delete session
  async deleteSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Delete ChromaDB collection
    if (this.client) {
      try {
        await this.client.deleteCollection({
          name: `session_${sessionId.replace(/-/g, '_')}`,
        });
      } catch {
        // Collection might not exist
      }
    }

    this.collections.delete(sessionId);
    this.sessions.delete(sessionId);
  }

  // Add document to session
  async addDocument(
    sessionId: string,
    fileName: string,
    content: Buffer,
    contentType: string
  ): Promise<DocumentInfo> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const docId = uuidv4();
    const text = await this.extractText(content, contentType, fileName);
    const chunks = this.chunkText(text);

    // Store in ChromaDB
    const collection = this.collections.get(sessionId);
    if (collection && chunks.length > 0) {
      try {
        // Generate embeddings for chunks
        const embeddings = await this.generateEmbeddings(chunks);

        await collection.add({
          ids: chunks.map((_, i) => `${docId}_${i}`),
          embeddings,
          documents: chunks,
          metadatas: chunks.map((_, i) => ({
            documentId: docId,
            documentName: fileName,
            chunkIndex: i,
          })),
        });
      } catch (error) {
        console.error('Error adding to collection:', error);
      }
    }

    const docInfo: DocumentInfo = {
      id: docId,
      name: fileName,
      size: content.length,
      type: contentType,
      chunks: chunks.length,
      uploadedAt: new Date(),
    };

    session.documents.push(docInfo);

    return docInfo;
  }

  // Get documents for session
  getDocuments(sessionId: string): DocumentInfo[] {
    const session = this.sessions.get(sessionId);
    return session?.documents || [];
  }

  // Delete document from session
  async deleteDocument(sessionId: string, documentId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Remove from ChromaDB
    const collection = this.collections.get(sessionId);
    if (collection) {
      try {
        // Get all chunk IDs for this document
        const results = await collection.get({
          where: { documentId },
        });

        if (results.ids.length > 0) {
          await collection.delete({
            ids: results.ids,
          });
        }
      } catch {
        // Ignore errors
      }
    }

    // Remove from session
    session.documents = session.documents.filter((d) => d.id !== documentId);
  }

  // Query with RAG
  async query(sessionId: string, question: string): Promise<QueryResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Retrieve relevant chunks
    const citations = await this.retrieveContext(sessionId, question);

    // Build prompt with context
    const context = citations
      .map((c) => `[From: ${c.documentName}]\n${c.content}`)
      .join('\n\n');

    const systemPrompt = `You are a helpful assistant that answers questions based on the provided context.
Use the following context to answer the question. If you cannot find the answer in the context, say so.
Always cite your sources by mentioning the document name.

Context:
${context}`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: question },
    ];

    const response = await ollamaService.chat(messages);

    return {
      answer: response.message.content,
      citations,
    };
  }

  // Query with streaming
  async *queryStream(
    sessionId: string,
    question: string
  ): AsyncGenerator<{ type: 'content' | 'citations'; data: any }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Retrieve relevant chunks
    const citations = await this.retrieveContext(sessionId, question);

    // Yield citations first
    yield { type: 'citations', data: citations };

    // Build prompt with context
    const context = citations
      .map((c) => `[From: ${c.documentName}]\n${c.content}`)
      .join('\n\n');

    const systemPrompt = `You are a helpful assistant that answers questions based on the provided context.
Use the following context to answer the question. If you cannot find the answer in the context, say so.
Always cite your sources by mentioning the document name.

Context:
${context}`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: question },
    ];

    // Stream response
    for await (const chunk of ollamaService.chatStream(messages)) {
      yield { type: 'content', data: chunk };
    }
  }

  // Private helpers

  private async extractText(
    content: Buffer,
    contentType: string,
    fileName: string
  ): Promise<string> {
    const ext = path.extname(fileName).toLowerCase();

    // Plain text files
    if (
      contentType.startsWith('text/') ||
      ['.txt', '.md', '.csv', '.json'].includes(ext)
    ) {
      return content.toString('utf-8');
    }

    // PDF - would need pdf-parse or similar library
    if (ext === '.pdf' || contentType === 'application/pdf') {
      // Placeholder - in production, use pdf-parse
      return `[PDF content from ${fileName}]`;
    }

    // DOCX - would need mammoth or similar library
    if (
      ext === '.docx' ||
      contentType ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      // Placeholder - in production, use mammoth
      return `[DOCX content from ${fileName}]`;
    }

    return content.toString('utf-8');
  }

  private chunkText(text: string, chunkSize = 500, overlap = 50): string[] {
    const chunks: string[] = [];
    const sentences = text.split(/[.!?]+\s+/);

    let currentChunk = '';

    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > chunkSize && currentChunk) {
        chunks.push(currentChunk.trim());
        // Keep overlap
        const words = currentChunk.split(' ');
        currentChunk = words.slice(-Math.floor(overlap / 5)).join(' ') + ' ';
      }
      currentChunk += sentence + '. ';
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  private async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];

    for (const text of texts) {
      try {
        const embedding = await ollamaService.embed(text);
        embeddings.push(embedding);
      } catch {
        // Use zero vector as fallback
        embeddings.push(new Array(384).fill(0));
      }
    }

    return embeddings;
  }

  private async retrieveContext(
    sessionId: string,
    query: string,
    topK = 5
  ): Promise<Citation[]> {
    const collection = this.collections.get(sessionId);
    if (!collection) {
      return [];
    }

    try {
      // Generate query embedding
      const queryEmbedding = await ollamaService.embed(query);

      // Query ChromaDB
      const results = await collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: topK,
      });

      const citations: Citation[] = [];

      if (results.documents?.[0]) {
        for (let i = 0; i < results.documents[0].length; i++) {
          const doc = results.documents[0][i];
          const metadata = results.metadatas?.[0]?.[i] as any;
          const distance = results.distances?.[0]?.[i] || 0;

          if (doc && metadata) {
            citations.push({
              documentId: metadata.documentId,
              documentName: metadata.documentName,
              content: doc,
              score: 1 - distance, // Convert distance to similarity
            });
          }
        }
      }

      return citations;
    } catch (error) {
      console.error('Error retrieving context:', error);
      return [];
    }
  }
}

export const ragService = new RAGService();
