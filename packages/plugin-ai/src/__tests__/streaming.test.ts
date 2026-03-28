/**
 * Tests for streaming — SSE parser, delta extraction, and stream utilities.
 *
 * Covers:
 * - parseSseLines: W3C compliant SSE line parsing
 * - extractOpenAIDelta: OpenAI chunk handling including [DONE]
 * - extractAnthropicDelta: Anthropic event handling
 * - extractOllamaDelta: Ollama NDJSON handling
 * - readLines: async line-by-line streaming
 * - collectStreamText: full stream collection
 * - accumulateStream: generator accumulator with callback
 */

import { describe, it, expect } from 'vitest';
import {
  parseSseLines,
  extractOpenAIDelta,
  extractAnthropicDelta,
  extractOllamaDelta,
  readLines,
  collectStreamText,
  accumulateStream,
} from '../streaming';

// ---------------------------------------------------------------------------
// parseSseLines
// ---------------------------------------------------------------------------

describe('parseSseLines', () => {
  it('parses a simple data event', () => {
    const raw = 'data: hello\n\n';
    const events = parseSseLines(raw);
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('message');
    expect(events[0]!.data).toBe('hello');
  });

  it('parses multiple events separated by blank lines', () => {
    const raw = 'data: first\n\ndata: second\n\n';
    const events = parseSseLines(raw);
    expect(events).toHaveLength(2);
    expect(events[0]!.data).toBe('first');
    expect(events[1]!.data).toBe('second');
  });

  it('parses a named event type', () => {
    const raw = 'event: message_stop\ndata: {}\n\n';
    const events = parseSseLines(raw);
    expect(events[0]!.type).toBe('message_stop');
  });

  it('strips leading space from data value', () => {
    const raw = 'data: hello\n\n';
    const events = parseSseLines(raw);
    expect(events[0]!.data).toBe('hello');
  });

  it('ignores comment lines starting with :', () => {
    const raw = ': this is a comment\ndata: real\n\n';
    const events = parseSseLines(raw);
    expect(events).toHaveLength(1);
    expect(events[0]!.data).toBe('real');
  });

  it('parses id and retry fields', () => {
    const raw = 'id: 42\nretry: 3000\ndata: event\n\n';
    const events = parseSseLines(raw);
    expect(events[0]!.id).toBe('42');
    expect(events[0]!.retry).toBe(3000);
  });

  it('dispatches without trailing blank line', () => {
    const raw = 'data: no-blank-line-at-end';
    const events = parseSseLines(raw);
    expect(events).toHaveLength(1);
    expect(events[0]!.data).toBe('no-blank-line-at-end');
  });

  it('handles multi-line data (multiple data: lines)', () => {
    const raw = 'data: line one\ndata: line two\n\n';
    const events = parseSseLines(raw);
    expect(events[0]!.data).toBe('line one\nline two');
  });

  it('returns empty array for an empty string', () => {
    expect(parseSseLines('')).toHaveLength(0);
  });

  it('ignores events with no data', () => {
    // A blank line without preceding data does not produce an event
    const raw = '\n\n';
    const events = parseSseLines(raw);
    expect(events).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// extractOpenAIDelta
// ---------------------------------------------------------------------------

describe('extractOpenAIDelta', () => {
  it('extracts text from a valid delta chunk', () => {
    const json = JSON.stringify({
      choices: [{ delta: { content: 'Hello' }, finish_reason: null }],
    });
    const result = extractOpenAIDelta(json);
    expect(result).toEqual({ text: 'Hello', done: false });
  });

  it('returns done=true when finish_reason is "stop"', () => {
    const json = JSON.stringify({
      choices: [{ delta: { content: '' }, finish_reason: 'stop' }],
    });
    const result = extractOpenAIDelta(json);
    expect(result?.done).toBe(true);
  });

  it('returns done=true when finish_reason is "length"', () => {
    const json = JSON.stringify({
      choices: [{ delta: {}, finish_reason: 'length' }],
    });
    const result = extractOpenAIDelta(json);
    expect(result?.done).toBe(true);
  });

  it('returns done=true for [DONE] sentinel', () => {
    const result = extractOpenAIDelta('[DONE]');
    expect(result).toEqual({ text: '', done: true });
  });

  it('returns null for invalid JSON', () => {
    expect(extractOpenAIDelta('{broken')).toBeNull();
  });

  it('returns null for a usage chunk with no choices', () => {
    const json = JSON.stringify({ usage: { prompt_tokens: 10 } });
    expect(extractOpenAIDelta(json)).toBeNull();
  });

  it('handles empty delta content gracefully', () => {
    const json = JSON.stringify({
      choices: [{ delta: {}, finish_reason: null }],
    });
    const result = extractOpenAIDelta(json);
    expect(result?.text).toBe('');
    expect(result?.done).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// extractAnthropicDelta
// ---------------------------------------------------------------------------

describe('extractAnthropicDelta', () => {
  it('extracts text from content_block_delta / text_delta', () => {
    const json = JSON.stringify({
      type: 'content_block_delta',
      delta: { type: 'text_delta', text: 'World' },
    });
    const result = extractAnthropicDelta(json);
    expect(result).toEqual({ text: 'World', done: false });
  });

  it('returns done=true for message_stop event', () => {
    const json = JSON.stringify({ type: 'message_stop' });
    const result = extractAnthropicDelta(json);
    expect(result).toEqual({ text: '', done: true });
  });

  it('returns null for unhandled event types', () => {
    const json = JSON.stringify({ type: 'message_start', message: {} });
    expect(extractAnthropicDelta(json)).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    expect(extractAnthropicDelta('not-json')).toBeNull();
  });

  it('returns null for content_block_start events', () => {
    const json = JSON.stringify({
      type: 'content_block_start',
      index: 0,
      content_block: { type: 'text', text: '' },
    });
    expect(extractAnthropicDelta(json)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// extractOllamaDelta
// ---------------------------------------------------------------------------

describe('extractOllamaDelta', () => {
  it('extracts text from a streaming response chunk', () => {
    const json = JSON.stringify({ response: 'Hi there', done: false });
    const result = extractOllamaDelta(json);
    expect(result).toEqual({ text: 'Hi there', done: false });
  });

  it('returns done=true when done field is true', () => {
    const json = JSON.stringify({ response: '', done: true });
    const result = extractOllamaDelta(json);
    expect(result?.done).toBe(true);
  });

  it('returns null for invalid JSON', () => {
    expect(extractOllamaDelta('{bad')).toBeNull();
  });

  it('returns empty text when response is absent', () => {
    const json = JSON.stringify({ done: false });
    const result = extractOllamaDelta(json);
    expect(result?.text).toBe('');
  });
});

// ---------------------------------------------------------------------------
// readLines
// ---------------------------------------------------------------------------

describe('readLines', () => {
  function makeStream(chunks: string[]): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    return new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    });
  }

  it('yields each complete line', async () => {
    const stream = makeStream(['line1\nline2\n', 'line3\n']);
    const lines: string[] = [];
    for await (const line of readLines(stream)) {
      lines.push(line);
    }
    expect(lines).toEqual(['line1', 'line2', 'line3']);
  });

  it('handles lines split across chunks', async () => {
    const stream = makeStream(['hel', 'lo\n', 'wor', 'ld\n']);
    const lines: string[] = [];
    for await (const line of readLines(stream)) {
      lines.push(line);
    }
    expect(lines).toEqual(['hello', 'world']);
  });

  it('yields the last line even without a trailing newline', async () => {
    const stream = makeStream(['last-line-no-newline']);
    const lines: string[] = [];
    for await (const line of readLines(stream)) {
      lines.push(line);
    }
    expect(lines).toContain('last-line-no-newline');
  });

  it('yields nothing for an empty stream', async () => {
    const stream = makeStream([]);
    const lines: string[] = [];
    for await (const line of readLines(stream)) {
      lines.push(line);
    }
    expect(lines).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// collectStreamText
// ---------------------------------------------------------------------------

describe('collectStreamText', () => {
  function makeResponse(chunks: string[], status = 200): Response {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const c of chunks) controller.enqueue(encoder.encode(c));
        controller.close();
      },
    });
    return new Response(stream, { status });
  }

  it('collects openai SSE stream into full text', async () => {
    const chunks = [
      'data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}\n\n',
      'data: {"choices":[{"delta":{"content":" world"},"finish_reason":"stop"}]}\n\n',
    ];
    const resp = makeResponse(chunks);
    const text = await collectStreamText(resp, 'openai');
    expect(text).toBe('Hello world');
  });

  it('collects anthropic SSE stream into full text', async () => {
    const chunks = [
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi"}}\n\n',
      'data: {"type":"message_stop"}\n\n',
    ];
    const resp = makeResponse(chunks);
    const text = await collectStreamText(resp, 'anthropic');
    expect(text).toBe('Hi');
  });

  it('collects ollama NDJSON stream into full text', async () => {
    const chunks = ['{"response":"foo","done":false}\n', '{"response":"bar","done":true}\n'];
    const resp = makeResponse(chunks);
    const text = await collectStreamText(resp, 'ollama');
    expect(text).toBe('foobar');
  });

  it('throws when response body is null', async () => {
    const resp = { body: null, ok: true } as unknown as Response;
    await expect(collectStreamText(resp, 'openai')).rejects.toThrow('null');
  });
});

// ---------------------------------------------------------------------------
// accumulateStream
// ---------------------------------------------------------------------------

describe('accumulateStream', () => {
  async function* makeGen(
    items: Array<{ text: string; done: boolean }>,
  ): AsyncGenerator<{ text: string; done: boolean }, void, unknown> {
    for (const item of items) {
      yield item;
    }
  }

  it('returns the accumulated text', async () => {
    const gen = makeGen([
      { text: 'Hello', done: false },
      { text: ' world', done: false },
      { text: '', done: true },
    ]);
    const result = await accumulateStream(gen);
    expect(result).toBe('Hello world');
  });

  it('calls onChunk for each text delta', async () => {
    const chunks: string[] = [];
    const accumulated: string[] = [];

    const gen = makeGen([
      { text: 'a', done: false },
      { text: 'b', done: false },
      { text: '', done: true },
    ]);

    await accumulateStream(gen, (text, acc) => {
      chunks.push(text);
      accumulated.push(acc);
    });

    expect(chunks).toEqual(['a', 'b']);
    expect(accumulated).toEqual(['a', 'ab']);
  });

  it('stops at the first done=true chunk', async () => {
    const afterDone: string[] = [];

    const gen = (async function* () {
      yield { text: 'first', done: false };
      yield { text: '', done: true };
      afterDone.push('should-not-reach');
      yield { text: 'after-done', done: false };
    })();

    const result = await accumulateStream(gen);
    expect(result).toBe('first');
    expect(afterDone).toHaveLength(0);
  });

  it('returns empty string for a generator that immediately yields done=true', async () => {
    const gen = makeGen([{ text: '', done: true }]);
    const result = await accumulateStream(gen);
    expect(result).toBe('');
  });
});
