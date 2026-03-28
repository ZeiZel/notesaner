/**
 * ai-provider — Provider abstraction for LLM backends.
 *
 * Defines a common interface for all supported LLM providers and supplies
 * concrete implementations for OpenAI, Anthropic, and Ollama. Each provider
 * uses raw fetch — no third-party SDK dependencies.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Configuration schema
// ---------------------------------------------------------------------------

export const providerConfigSchema = z.object({
  /** Which LLM backend to use */
  provider: z.enum(['openai', 'anthropic', 'ollama']).default('openai'),
  /** API key (not required for Ollama) */
  apiKey: z.string().default(''),
  /** Model identifier */
  model: z.string().default('gpt-4o-mini'),
  /** Sampling temperature (0–2) */
  temperature: z.number().min(0).max(2).default(0.7),
  /** Maximum tokens to generate */
  maxTokens: z.number().int().min(1).max(32768).default(1024),
  /**
   * Custom base URL. When empty, the provider's default endpoint is used.
   * For Ollama defaults to http://localhost:11434.
   */
  customEndpoint: z.string().default(''),
});

export type ProviderConfig = z.infer<typeof providerConfigSchema>;

// ---------------------------------------------------------------------------
// Core interface
// ---------------------------------------------------------------------------

/** A single chunk of text yielded by a streaming response */
export interface StreamChunk {
  /** Incremental text delta */
  text: string;
  /** Whether this is the final chunk */
  done: boolean;
}

/** Result of a non-streaming completion */
export interface CompletionResult {
  text: string;
  /** Token usage reported by the provider (may be absent) */
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

/** Vector embedding result */
export interface EmbeddingResult {
  /** Embedding vector */
  embedding: number[];
  /** Dimensionality of the vector */
  dimensions: number;
}

export interface CompletionOptions {
  /** System / instruction prompt */
  system?: string;
  /** User message */
  prompt: string;
  /** Override default temperature */
  temperature?: number;
  /** Override default max tokens */
  maxTokens?: number;
}

/**
 * The provider interface every LLM backend must implement.
 */
export interface AIProvider {
  /** Provider identifier */
  readonly id: 'openai' | 'anthropic' | 'ollama';

  /**
   * Send a single completion request and return the full response text.
   */
  complete(options: CompletionOptions): Promise<CompletionResult>;

  /**
   * Stream a completion response, yielding incremental chunks.
   * The caller should iterate the AsyncGenerator until `done === true`.
   */
  stream(options: CompletionOptions): AsyncGenerator<StreamChunk, void, unknown>;

  /**
   * Generate a semantic embedding vector for the given text.
   * Not all providers support this — Ollama requires a dedicated embedding
   * model; OpenAI supports it via text-embedding-* models.
   */
  embed(text: string): Promise<EmbeddingResult>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildHeaders(apiKey: string, extra?: Record<string, string>): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extra,
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  return headers;
}

/**
 * Parse an SSE stream from a fetch Response and yield individual data lines.
 * Handles both `data: {...}` and `data: [DONE]` sentinel.
 */
async function* parseSseStream(response: Response): AsyncGenerator<string, void, unknown> {
  if (!response.body) {
    throw new Error('Response body is null — streaming not supported');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      // Keep the last (potentially incomplete) line in the buffer
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          const data = trimmed.slice(6);
          if (data === '[DONE]') return;
          yield data;
        }
      }
    }

    // Flush any remaining buffer
    if (buffer.trim().startsWith('data: ')) {
      const data = buffer.trim().slice(6);
      if (data !== '[DONE]') yield data;
    }
  } finally {
    reader.releaseLock();
  }
}

// ---------------------------------------------------------------------------
// OpenAI provider
// ---------------------------------------------------------------------------

const OPENAI_DEFAULT_BASE = 'https://api.openai.com/v1';

export class OpenAIProvider implements AIProvider {
  readonly id = 'openai' as const;

  private readonly config: ProviderConfig;
  private readonly baseUrl: string;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.baseUrl = config.customEndpoint || OPENAI_DEFAULT_BASE;
  }

  async complete(options: CompletionOptions): Promise<CompletionResult> {
    const body = this.buildRequestBody(options, false);

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: buildHeaders(this.config.apiKey),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    };

    const text = data.choices[0]?.message?.content ?? '';
    return {
      text,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
    };
  }

  async *stream(options: CompletionOptions): AsyncGenerator<StreamChunk, void, unknown> {
    const body = this.buildRequestBody(options, true);

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: buildHeaders(this.config.apiKey),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI stream error ${response.status}: ${errorText}`);
    }

    for await (const line of parseSseStream(response)) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        continue;
      }

      const chunk = parsed as {
        choices: Array<{ delta: { content?: string }; finish_reason?: string | null }>;
      };
      const delta = chunk.choices[0]?.delta?.content ?? '';
      const finishReason = chunk.choices[0]?.finish_reason;

      if (delta) {
        yield { text: delta, done: false };
      }

      if (finishReason === 'stop' || finishReason === 'length') {
        yield { text: '', done: true };
        return;
      }
    }

    yield { text: '', done: true };
  }

  async embed(text: string): Promise<EmbeddingResult> {
    // Use the standard embedding model unless the config specifies one
    const model = this.config.model.startsWith('text-embedding')
      ? this.config.model
      : 'text-embedding-3-small';

    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: buildHeaders(this.config.apiKey),
      body: JSON.stringify({ model, input: text }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI embeddings error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as {
      data: Array<{ embedding: number[] }>;
    };

    const embedding = data.data[0]?.embedding ?? [];
    return { embedding, dimensions: embedding.length };
  }

  private buildRequestBody(
    options: CompletionOptions,
    streaming: boolean,
  ): Record<string, unknown> {
    const messages: Array<{ role: string; content: string }> = [];
    if (options.system) {
      messages.push({ role: 'system', content: options.system });
    }
    messages.push({ role: 'user', content: options.prompt });

    return {
      model: this.config.model,
      messages,
      temperature: options.temperature ?? this.config.temperature,
      max_tokens: options.maxTokens ?? this.config.maxTokens,
      stream: streaming,
    };
  }
}

// ---------------------------------------------------------------------------
// Anthropic provider
// ---------------------------------------------------------------------------

const ANTHROPIC_DEFAULT_BASE = 'https://api.anthropic.com/v1';
const ANTHROPIC_VERSION = '2023-06-01';

export class AnthropicProvider implements AIProvider {
  readonly id = 'anthropic' as const;

  private readonly config: ProviderConfig;
  private readonly baseUrl: string;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.baseUrl = config.customEndpoint || ANTHROPIC_DEFAULT_BASE;
  }

  async complete(options: CompletionOptions): Promise<CompletionResult> {
    const body = this.buildRequestBody(options, false);

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: buildHeaders(this.config.apiKey, {
        'x-api-key': this.config.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      }),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as {
      content: Array<{ type: string; text?: string }>;
      usage?: { input_tokens: number; output_tokens: number };
    };

    const text = data.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text ?? '')
      .join('');

    return {
      text,
      usage: data.usage
        ? {
            promptTokens: data.usage.input_tokens,
            completionTokens: data.usage.output_tokens,
            totalTokens: data.usage.input_tokens + data.usage.output_tokens,
          }
        : undefined,
    };
  }

  async *stream(options: CompletionOptions): AsyncGenerator<StreamChunk, void, unknown> {
    const body = this.buildRequestBody(options, true);

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: buildHeaders(this.config.apiKey, {
        'x-api-key': this.config.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      }),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic stream error ${response.status}: ${errorText}`);
    }

    for await (const line of parseSseStream(response)) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        continue;
      }

      const event = parsed as {
        type: string;
        delta?: { type?: string; text?: string };
      };

      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        const text = event.delta.text ?? '';
        if (text) {
          yield { text, done: false };
        }
      } else if (event.type === 'message_stop') {
        yield { text: '', done: true };
        return;
      }
    }

    yield { text: '', done: true };
  }

  async embed(_text: string): Promise<EmbeddingResult> {
    // Anthropic does not have a public embeddings endpoint as of 2025.
    // Return a stub that callers can check and route to a fallback.
    throw new Error(
      'Anthropic does not support embeddings. Switch to the OpenAI provider for embedding-based features.',
    );
  }

  private buildRequestBody(
    options: CompletionOptions,
    streaming: boolean,
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: this.config.model,
      max_tokens: options.maxTokens ?? this.config.maxTokens,
      temperature: options.temperature ?? this.config.temperature,
      messages: [{ role: 'user', content: options.prompt }],
      stream: streaming,
    };

    if (options.system) {
      body['system'] = options.system;
    }

    return body;
  }
}

// ---------------------------------------------------------------------------
// Ollama provider
// ---------------------------------------------------------------------------

const OLLAMA_DEFAULT_BASE = 'http://localhost:11434';

export class OllamaProvider implements AIProvider {
  readonly id = 'ollama' as const;

  private readonly config: ProviderConfig;
  private readonly baseUrl: string;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.baseUrl = config.customEndpoint || OLLAMA_DEFAULT_BASE;
  }

  async complete(options: CompletionOptions): Promise<CompletionResult> {
    const prompt = options.system ? `${options.system}\n\n${options.prompt}` : options.prompt;

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.model,
        prompt,
        stream: false,
        options: {
          temperature: options.temperature ?? this.config.temperature,
          num_predict: options.maxTokens ?? this.config.maxTokens,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as { response: string };
    return { text: data.response };
  }

  async *stream(options: CompletionOptions): AsyncGenerator<StreamChunk, void, unknown> {
    const prompt = options.system ? `${options.system}\n\n${options.prompt}` : options.prompt;

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.model,
        prompt,
        stream: true,
        options: {
          temperature: options.temperature ?? this.config.temperature,
          num_predict: options.maxTokens ?? this.config.maxTokens,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama stream error ${response.status}: ${errorText}`);
    }

    if (!response.body) {
      throw new Error('Ollama stream response has no body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          let parsed: unknown;
          try {
            parsed = JSON.parse(trimmed);
          } catch {
            continue;
          }

          const chunk = parsed as { response: string; done: boolean };
          if (chunk.response) {
            yield { text: chunk.response, done: false };
          }
          if (chunk.done) {
            yield { text: '', done: true };
            return;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield { text: '', done: true };
  }

  async embed(text: string): Promise<EmbeddingResult> {
    const response = await fetch(`${this.baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.config.model, prompt: text }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama embeddings error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as { embedding: number[] };
    return { embedding: data.embedding, dimensions: data.embedding.length };
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create an AIProvider instance from a validated config.
 */
export function createProvider(config: ProviderConfig): AIProvider {
  switch (config.provider) {
    case 'openai':
      return new OpenAIProvider(config);
    case 'anthropic':
      return new AnthropicProvider(config);
    case 'ollama':
      return new OllamaProvider(config);
  }
}
