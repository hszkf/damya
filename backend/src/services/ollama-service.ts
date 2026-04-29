const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'qwen3';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatResponse {
  model: string;
  message: ChatMessage;
  done: boolean;
  total_duration?: number;
  eval_count?: number;
}

export interface GenerateOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  system?: string;
}

class OllamaService {
  // Check Ollama health
  async healthCheck(): Promise<{ status: string; models: string[] }> {
    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);

      if (!response.ok) {
        throw new Error('Ollama not available');
      }

      const data = await response.json();
      const models = data.models?.map((m: any) => m.name) || [];

      return {
        status: 'healthy',
        models,
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        models: [],
      };
    }
  }

  // List available models
  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);

      if (!response.ok) {
        throw new Error('Failed to list models');
      }

      const data = await response.json();
      return data.models?.map((m: any) => m.name) || [];
    } catch (error) {
      console.error('Error listing models:', error);
      return [];
    }
  }

  // Non-streaming chat
  async chat(
    messages: ChatMessage[],
    options: GenerateOptions = {}
  ): Promise<ChatResponse> {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options.model || DEFAULT_MODEL,
        messages,
        stream: false,
        options: {
          temperature: options.temperature ?? 0.7,
          num_predict: options.max_tokens,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama chat error: ${error}`);
    }

    return await response.json();
  }

  // Streaming chat
  async *chatStream(
    messages: ChatMessage[],
    options: GenerateOptions = {}
  ): AsyncGenerator<string, void, unknown> {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options.model || DEFAULT_MODEL,
        messages,
        stream: true,
        options: {
          temperature: options.temperature ?? 0.7,
          num_predict: options.max_tokens,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama chat error: ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete JSON lines
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          try {
            const data = JSON.parse(line);
            if (data.message?.content) {
              yield data.message.content;
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }
  }

  // Generate completion (simple prompt -> response)
  async generate(
    prompt: string,
    options: GenerateOptions = {}
  ): Promise<string> {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options.model || DEFAULT_MODEL,
        prompt,
        system: options.system,
        stream: false,
        options: {
          temperature: options.temperature ?? 0.7,
          num_predict: options.max_tokens,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama generate error: ${error}`);
    }

    const data = await response.json();
    return data.response || '';
  }

  // Generate embeddings
  async embed(text: string, model = 'nomic-embed-text'): Promise<number[]> {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt: text,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama embed error: ${error}`);
    }

    const data = await response.json();
    return data.embedding || [];
  }
}

export const ollamaService = new OllamaService();
