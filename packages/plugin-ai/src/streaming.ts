/**
 * streaming — SSE/fetch streaming parser utilities.
 *
 * Provides framework-agnostic helpers for consuming streaming responses from
 * OpenAI-compatible and Anthropic APIs. Handles chunked responses, partial
 * JSON lines, and the [DONE] sentinel.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single parsed event from an SSE stream */
export interface SseEvent {
  /** Event type (from `event:` line) — defaults to "message" */
  type: string;
  /** Raw data string (from `data:` line) */
  data: string;
  /** Event ID (from `id:` line) — may be empty */
  id: string;
  /** Retry interval hint in ms (from `retry:` line) — 0 means not set */
  retry: number;
}

/** Result of extracting a text delta from a provider-specific JSON chunk */
export interface TextDelta {
  text: string;
  done: boolean;
}

// ---------------------------------------------------------------------------
// Low-level SSE parser
// ---------------------------------------------------------------------------

/**
 * Parse a raw SSE line buffer into discrete SseEvent objects.
 *
 * Implements the W3C SSE spec at the line level:
 * - Lines starting with `data:` accumulate into the event's data field.
 * - An empty line dispatches the current event.
 * - Lines starting with `:` are comments and are ignored.
 */
export function parseSseLines(raw: string): SseEvent[] {
  const events: SseEvent[] = [];
  const lines = raw.split(/\r?\n/);

  let currentEvent: Partial<SseEvent> = {};
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line === '') {
      // Empty line dispatches the event
      if (dataLines.length > 0 || currentEvent.type) {
        events.push({
          type: currentEvent.type ?? 'message',
          data: dataLines.join('\n'),
          id: currentEvent.id ?? '',
          retry: currentEvent.retry ?? 0,
        });
        dataLines.length = 0;
        currentEvent = {};
      }
      continue;
    }

    if (line.startsWith(':')) {
      // Comment line — ignore
      continue;
    }

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) {
      // Field with no value
      currentEvent[line as keyof SseEvent] = '' as never;
      continue;
    }

    const field = line.slice(0, colonIdx);
    // Per spec: if the colon is immediately followed by a space, strip it
    const value = line.slice(colonIdx + 1).replace(/^ /, '');

    switch (field) {
      case 'event':
        currentEvent.type = value;
        break;
      case 'data':
        dataLines.push(value);
        break;
      case 'id':
        currentEvent.id = value;
        break;
      case 'retry': {
        const ms = parseInt(value, 10);
        if (!isNaN(ms)) currentEvent.retry = ms;
        break;
      }
      // Unknown fields are ignored per spec
    }
  }

  // Dispatch a final event if the buffer ended without a blank line
  if (dataLines.length > 0 || currentEvent.type) {
    events.push({
      type: currentEvent.type ?? 'message',
      data: dataLines.join('\n'),
      id: currentEvent.id ?? '',
      retry: currentEvent.retry ?? 0,
    });
  }

  return events;
}

// ---------------------------------------------------------------------------
// OpenAI-compatible delta extraction
// ---------------------------------------------------------------------------

/**
 * Extract a text delta from an OpenAI-compatible streaming JSON chunk.
 *
 * OpenAI chat completions format:
 * ```json
 * { "choices": [{ "delta": { "content": "Hello" }, "finish_reason": null }] }
 * ```
 */
export function extractOpenAIDelta(jsonData: string): TextDelta | null {
  if (jsonData === '[DONE]') {
    return { text: '', done: true };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonData);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) return null;

  const obj = parsed as Record<string, unknown>;
  const choices = obj['choices'];

  if (!Array.isArray(choices) || choices.length === 0) {
    // Some providers send usage chunks with no choices
    return null;
  }

  const choice = choices[0] as Record<string, unknown>;
  const delta = choice['delta'] as Record<string, unknown> | undefined;
  const finishReason = choice['finish_reason'];

  const text = typeof delta?.['content'] === 'string' ? delta['content'] : '';
  const done = finishReason === 'stop' || finishReason === 'length';

  return { text, done };
}

// ---------------------------------------------------------------------------
// Anthropic delta extraction
// ---------------------------------------------------------------------------

/**
 * Extract a text delta from an Anthropic streaming JSON chunk.
 *
 * Anthropic format:
 * ```json
 * { "type": "content_block_delta", "delta": { "type": "text_delta", "text": "Hello" } }
 * ```
 * Terminal event:
 * ```json
 * { "type": "message_stop" }
 * ```
 */
export function extractAnthropicDelta(jsonData: string): TextDelta | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonData);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) return null;

  const obj = parsed as Record<string, unknown>;
  const eventType = obj['type'];

  if (eventType === 'message_stop') {
    return { text: '', done: true };
  }

  if (eventType === 'content_block_delta') {
    const delta = obj['delta'] as Record<string, unknown> | undefined;
    if (delta?.['type'] === 'text_delta' && typeof delta['text'] === 'string') {
      return { text: delta['text'], done: false };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Ollama delta extraction
// ---------------------------------------------------------------------------

/**
 * Extract a text delta from an Ollama streaming JSON line.
 *
 * Ollama format (newline-delimited JSON, not SSE):
 * ```json
 * { "response": "Hello", "done": false }
 * ```
 */
export function extractOllamaDelta(jsonLine: string): TextDelta | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonLine);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) return null;

  const obj = parsed as Record<string, unknown>;
  const text = typeof obj['response'] === 'string' ? obj['response'] : '';
  const done = obj['done'] === true;

  return { text, done };
}

// ---------------------------------------------------------------------------
// Stream reader utilities
// ---------------------------------------------------------------------------

/**
 * Read a ReadableStream and yield complete lines, buffering across chunks.
 * Used internally by provider implementations.
 */
export async function* readLines(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<string, void, unknown> {
  const reader = stream.getReader();
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
        yield line;
      }
    }

    // Flush remaining buffer
    if (buffer) {
      yield buffer;
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Consume a streaming fetch response and collect the full text.
 * Provider type determines the delta extraction strategy.
 */
export async function collectStreamText(
  response: Response,
  provider: 'openai' | 'anthropic' | 'ollama',
): Promise<string> {
  if (!response.body) {
    throw new Error('Response body is null — cannot collect stream text');
  }

  let fullText = '';

  for await (const line of readLines(response.body)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let delta: TextDelta | null = null;

    if (provider === 'openai') {
      const data = trimmed.startsWith('data: ') ? trimmed.slice(6) : trimmed;
      delta = extractOpenAIDelta(data);
    } else if (provider === 'anthropic') {
      const data = trimmed.startsWith('data: ') ? trimmed.slice(6) : trimmed;
      delta = extractAnthropicDelta(data);
    } else {
      delta = extractOllamaDelta(trimmed);
    }

    if (delta) {
      fullText += delta.text;
      if (delta.done) break;
    }
  }

  return fullText;
}

// ---------------------------------------------------------------------------
// Chunk accumulator
// ---------------------------------------------------------------------------

/**
 * Accumulate streaming chunks with an optional onChunk callback.
 *
 * Useful for driving reactive UI updates without losing partial state.
 * Returns the fully accumulated text.
 */
export async function accumulateStream(
  generator: AsyncGenerator<{ text: string; done: boolean }, void, unknown>,
  onChunk?: (text: string, accumulated: string) => void,
): Promise<string> {
  let accumulated = '';

  for await (const chunk of generator) {
    if (chunk.text) {
      accumulated += chunk.text;
      onChunk?.(chunk.text, accumulated);
    }
    if (chunk.done) break;
  }

  return accumulated;
}
