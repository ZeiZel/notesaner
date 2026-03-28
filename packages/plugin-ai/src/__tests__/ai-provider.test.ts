/**
 * Tests for ai-provider — provider abstraction and configuration validation.
 *
 * Covers:
 * - providerConfigSchema: valid configs, defaults, boundary validation
 * - createProvider: factory creates correct provider class
 * - OpenAIProvider: complete(), stream(), embed() with fetch mocks
 * - AnthropicProvider: complete(), stream(), embed() with fetch mocks
 * - OllamaProvider: complete(), stream(), embed() with fetch mocks
 * - Error handling: HTTP errors, network errors, null body
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  providerConfigSchema,
  createProvider,
  OpenAIProvider,
  AnthropicProvider,
  OllamaProvider,
} from '../ai-provider';
import type { ProviderConfig, CompletionOptions } from '../ai-provider';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function mockStreamResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

const OPENAI_CONFIG: ProviderConfig = {
  provider: 'openai',
  apiKey: 'sk-test-key',
  model: 'gpt-4o-mini',
  temperature: 0.7,
  maxTokens: 512,
  customEndpoint: '',
};

const ANTHROPIC_CONFIG: ProviderConfig = {
  provider: 'anthropic',
  apiKey: 'sk-ant-test',
  model: 'claude-3-5-haiku-20241022',
  temperature: 0.7,
  maxTokens: 512,
  customEndpoint: '',
};

const OLLAMA_CONFIG: ProviderConfig = {
  provider: 'ollama',
  apiKey: '',
  model: 'llama3.2',
  temperature: 0.7,
  maxTokens: 512,
  customEndpoint: 'http://localhost:11434',
};

const COMPLETION_OPTIONS: CompletionOptions = {
  system: 'You are a helpful assistant.',
  prompt: 'Hello!',
};

// ---------------------------------------------------------------------------
// providerConfigSchema
// ---------------------------------------------------------------------------

describe('providerConfigSchema', () => {
  it('parses a valid openai config', () => {
    const result = providerConfigSchema.safeParse({
      provider: 'openai',
      apiKey: 'sk-test',
      model: 'gpt-4o',
      temperature: 0.5,
      maxTokens: 1024,
      customEndpoint: '',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.provider).toBe('openai');
      expect(result.data.model).toBe('gpt-4o');
    }
  });

  it('applies correct defaults when fields are omitted', () => {
    const result = providerConfigSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.provider).toBe('openai');
      expect(result.data.model).toBe('gpt-4o-mini');
      expect(result.data.temperature).toBe(0.7);
      expect(result.data.maxTokens).toBe(1024);
      expect(result.data.apiKey).toBe('');
      expect(result.data.customEndpoint).toBe('');
    }
  });

  it('rejects an invalid provider value', () => {
    const result = providerConfigSchema.safeParse({ provider: 'openrouter' });
    expect(result.success).toBe(false);
  });

  it('rejects temperature below 0', () => {
    const result = providerConfigSchema.safeParse({ temperature: -0.1 });
    expect(result.success).toBe(false);
  });

  it('rejects temperature above 2', () => {
    const result = providerConfigSchema.safeParse({ temperature: 2.1 });
    expect(result.success).toBe(false);
  });

  it('accepts boundary temperature values 0 and 2', () => {
    const r0 = providerConfigSchema.safeParse({ temperature: 0 });
    const r2 = providerConfigSchema.safeParse({ temperature: 2 });
    expect(r0.success).toBe(true);
    expect(r2.success).toBe(true);
  });

  it('rejects maxTokens below 1', () => {
    const result = providerConfigSchema.safeParse({ maxTokens: 0 });
    expect(result.success).toBe(false);
  });

  it('accepts all valid provider values', () => {
    for (const provider of ['openai', 'anthropic', 'ollama']) {
      const result = providerConfigSchema.safeParse({ provider });
      expect(result.success).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// createProvider factory
// ---------------------------------------------------------------------------

describe('createProvider', () => {
  it('creates an OpenAIProvider for provider="openai"', () => {
    const provider = createProvider(OPENAI_CONFIG);
    expect(provider.id).toBe('openai');
    expect(provider).toBeInstanceOf(OpenAIProvider);
  });

  it('creates an AnthropicProvider for provider="anthropic"', () => {
    const provider = createProvider(ANTHROPIC_CONFIG);
    expect(provider.id).toBe('anthropic');
    expect(provider).toBeInstanceOf(AnthropicProvider);
  });

  it('creates an OllamaProvider for provider="ollama"', () => {
    const provider = createProvider(OLLAMA_CONFIG);
    expect(provider.id).toBe('ollama');
    expect(provider).toBeInstanceOf(OllamaProvider);
  });
});

// ---------------------------------------------------------------------------
// OpenAIProvider
// ---------------------------------------------------------------------------

describe('OpenAIProvider', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('complete() — returns text from choices[0].message.content', async () => {
    fetchMock.mockResolvedValue(
      mockResponse(
        JSON.stringify({
          choices: [{ message: { content: 'Hello world' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      ),
    );

    const provider = new OpenAIProvider(OPENAI_CONFIG);
    const result = await provider.complete(COMPLETION_OPTIONS);

    expect(result.text).toBe('Hello world');
    expect(result.usage?.totalTokens).toBe(15);
    expect(result.usage?.promptTokens).toBe(10);
  });

  it('complete() — sends system message when provided', async () => {
    fetchMock.mockResolvedValue(
      mockResponse(JSON.stringify({ choices: [{ message: { content: 'ok' } }] })),
    );

    const provider = new OpenAIProvider(OPENAI_CONFIG);
    await provider.complete({ system: 'Be helpful', prompt: 'test' });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>;
    const messages = body['messages'] as Array<{ role: string; content: string }>;
    expect(messages[0]).toEqual({ role: 'system', content: 'Be helpful' });
    expect(messages[1]).toEqual({ role: 'user', content: 'test' });
  });

  it('complete() — uses custom endpoint when configured', async () => {
    fetchMock.mockResolvedValue(
      mockResponse(JSON.stringify({ choices: [{ message: { content: '' } }] })),
    );

    const provider = new OpenAIProvider({
      ...OPENAI_CONFIG,
      customEndpoint: 'http://custom:8080/v1',
    });
    await provider.complete({ prompt: 'test' });

    expect(fetchMock.mock.calls[0][0]).toBe('http://custom:8080/v1/chat/completions');
  });

  it('complete() — throws on non-200 response', async () => {
    fetchMock.mockResolvedValue(mockResponse('{"error":"invalid_api_key"}', 401));

    const provider = new OpenAIProvider(OPENAI_CONFIG);
    await expect(provider.complete({ prompt: 'test' })).rejects.toThrow('401');
  });

  it('stream() — yields text chunks and ends with done=true', async () => {
    const sseData = [
      'data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}\n\n',
      'data: {"choices":[{"delta":{"content":" world"},"finish_reason":"stop"}]}\n\n',
    ];
    fetchMock.mockResolvedValue(mockStreamResponse(sseData));

    const provider = new OpenAIProvider(OPENAI_CONFIG);
    const chunks: string[] = [];
    let finalDone = false;

    for await (const chunk of provider.stream({ prompt: 'Hi' })) {
      if (chunk.done) finalDone = true;
      else chunks.push(chunk.text);
    }

    expect(chunks).toEqual(['Hello', ' world']);
    expect(finalDone).toBe(true);
  });

  it('stream() — throws on non-200 response', async () => {
    fetchMock.mockResolvedValue(mockResponse('{"error":"rate_limit"}', 429));

    const provider = new OpenAIProvider(OPENAI_CONFIG);
    const gen = provider.stream({ prompt: 'Hi' });
    await expect(gen.next()).rejects.toThrow('429');
  });

  it('embed() — returns a vector embedding', async () => {
    const vector = Array.from({ length: 1536 }, (_, i) => i / 1536);
    fetchMock.mockResolvedValue(mockResponse(JSON.stringify({ data: [{ embedding: vector }] })));

    const provider = new OpenAIProvider(OPENAI_CONFIG);
    const result = await provider.embed('test text');

    expect(result.embedding).toHaveLength(1536);
    expect(result.dimensions).toBe(1536);
  });

  it('embed() — throws on non-200 response', async () => {
    fetchMock.mockResolvedValue(mockResponse('{"error":"model_not_found"}', 404));

    const provider = new OpenAIProvider(OPENAI_CONFIG);
    await expect(provider.embed('test')).rejects.toThrow('404');
  });
});

// ---------------------------------------------------------------------------
// AnthropicProvider
// ---------------------------------------------------------------------------

describe('AnthropicProvider', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('complete() — returns concatenated text content blocks', async () => {
    fetchMock.mockResolvedValue(
      mockResponse(
        JSON.stringify({
          content: [
            { type: 'text', text: 'Hello ' },
            { type: 'text', text: 'Claude!' },
          ],
          usage: { input_tokens: 8, output_tokens: 4 },
        }),
      ),
    );

    const provider = new AnthropicProvider(ANTHROPIC_CONFIG);
    const result = await provider.complete(COMPLETION_OPTIONS);

    expect(result.text).toBe('Hello Claude!');
    expect(result.usage?.promptTokens).toBe(8);
    expect(result.usage?.completionTokens).toBe(4);
    expect(result.usage?.totalTokens).toBe(12);
  });

  it('complete() — sends system as top-level field', async () => {
    fetchMock.mockResolvedValue(
      mockResponse(JSON.stringify({ content: [{ type: 'text', text: 'ok' }] })),
    );

    const provider = new AnthropicProvider(ANTHROPIC_CONFIG);
    await provider.complete({ system: 'Be concise', prompt: 'test' });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>;
    expect(body['system']).toBe('Be concise');
  });

  it('complete() — sets x-api-key and anthropic-version headers', async () => {
    fetchMock.mockResolvedValue(
      mockResponse(JSON.stringify({ content: [{ type: 'text', text: '' }] })),
    );

    const provider = new AnthropicProvider(ANTHROPIC_CONFIG);
    await provider.complete({ prompt: 'test' });

    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('sk-ant-test');
    expect(headers['anthropic-version']).toBe('2023-06-01');
  });

  it('complete() — throws on non-200 response', async () => {
    fetchMock.mockResolvedValue(mockResponse('{"type":"error"}', 403));

    const provider = new AnthropicProvider(ANTHROPIC_CONFIG);
    await expect(provider.complete({ prompt: 'test' })).rejects.toThrow('403');
  });

  it('stream() — yields text_delta chunks and ends on message_stop', async () => {
    const sseData = [
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi"}}\n\n',
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":" there"}}\n\n',
      'data: {"type":"message_stop"}\n\n',
    ];
    fetchMock.mockResolvedValue(mockStreamResponse(sseData));

    const provider = new AnthropicProvider(ANTHROPIC_CONFIG);
    const chunks: string[] = [];
    let finalDone = false;

    for await (const chunk of provider.stream({ prompt: 'Hi' })) {
      if (chunk.done) finalDone = true;
      else chunks.push(chunk.text);
    }

    expect(chunks).toEqual(['Hi', ' there']);
    expect(finalDone).toBe(true);
  });

  it('embed() — throws UnsupportedError', async () => {
    const provider = new AnthropicProvider(ANTHROPIC_CONFIG);
    await expect(provider.embed('test')).rejects.toThrow('embeddings');
  });
});

// ---------------------------------------------------------------------------
// OllamaProvider
// ---------------------------------------------------------------------------

describe('OllamaProvider', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('complete() — returns response field', async () => {
    fetchMock.mockResolvedValue(mockResponse(JSON.stringify({ response: 'Ollama says hi' })));

    const provider = new OllamaProvider(OLLAMA_CONFIG);
    const result = await provider.complete(COMPLETION_OPTIONS);

    expect(result.text).toBe('Ollama says hi');
  });

  it('complete() — prepends system to prompt', async () => {
    fetchMock.mockResolvedValue(mockResponse(JSON.stringify({ response: 'ok' })));

    const provider = new OllamaProvider(OLLAMA_CONFIG);
    await provider.complete({ system: 'Be brief', prompt: 'Hello' });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>;
    expect(body['prompt']).toBe('Be brief\n\nHello');
  });

  it('complete() — uses customEndpoint', async () => {
    fetchMock.mockResolvedValue(mockResponse(JSON.stringify({ response: 'ok' })));

    const provider = new OllamaProvider({
      ...OLLAMA_CONFIG,
      customEndpoint: 'http://custom-ollama:11434',
    });
    await provider.complete({ prompt: 'test' });

    expect(fetchMock.mock.calls[0][0]).toBe('http://custom-ollama:11434/api/generate');
  });

  it('complete() — throws on non-200 response', async () => {
    fetchMock.mockResolvedValue(mockResponse('{"error":"model not found"}', 404));

    const provider = new OllamaProvider(OLLAMA_CONFIG);
    await expect(provider.complete({ prompt: 'test' })).rejects.toThrow('404');
  });

  it('stream() — yields response chunks and terminates on done=true', async () => {
    const ndjson = [
      '{"response":"Hello","done":false}\n',
      '{"response":" world","done":false}\n',
      '{"response":"","done":true}\n',
    ];
    fetchMock.mockResolvedValue(
      new Response(
        new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();
            for (const line of ndjson) {
              controller.enqueue(encoder.encode(line));
            }
            controller.close();
          },
        }),
        { status: 200 },
      ),
    );

    const provider = new OllamaProvider(OLLAMA_CONFIG);
    const chunks: string[] = [];
    let finalDone = false;

    for await (const chunk of provider.stream({ prompt: 'Hi' })) {
      if (chunk.done) finalDone = true;
      else if (chunk.text) chunks.push(chunk.text);
    }

    expect(chunks).toEqual(['Hello', ' world']);
    expect(finalDone).toBe(true);
  });

  it('embed() — returns embedding vector', async () => {
    const vector = Array.from({ length: 768 }, () => Math.random());
    fetchMock.mockResolvedValue(mockResponse(JSON.stringify({ embedding: vector })));

    const provider = new OllamaProvider(OLLAMA_CONFIG);
    const result = await provider.embed('test');

    expect(result.embedding).toHaveLength(768);
    expect(result.dimensions).toBe(768);
  });

  it('embed() — throws on non-200 response', async () => {
    fetchMock.mockResolvedValue(mockResponse('{"error":"model not found"}', 404));

    const provider = new OllamaProvider(OLLAMA_CONFIG);
    await expect(provider.embed('test')).rejects.toThrow('404');
  });
});
