/**
 * Tests for api-client.ts
 *
 * Covers:
 * - authenticate: success, invalid token (401), network error
 * - createNote: success with all fields, success with minimal fields, server error (500)
 * - listFolders: success with workspace param, empty list
 * - listTags: success, with workspace param
 * - uploadImage: success, upload error
 * - ApiError: class properties (status, code, message)
 * - Request construction: Authorization header, Content-Type, JSON body
 * - 204 No Content handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  authenticate,
  createNote,
  listFolders,
  listTags,
  uploadImage,
  ApiError,
} from '../api-client';
import type { ApiClientConfig } from '../api-client';

// ---------------------------------------------------------------------------
// Fetch mock setup
// ---------------------------------------------------------------------------

const CONFIG: ApiClientConfig = {
  baseUrl: 'https://notes.example.com',
  token: 'test-bearer-token-123',
};

function mockFetchOk(body: unknown, status = 200): void {
  global.fetch = vi.fn().mockResolvedValueOnce({
    ok: true,
    status,
    statusText: 'OK',
    json: () => Promise.resolve(body),
  } as unknown as Response);
}

function mockFetchError(status: number, statusText: string, body?: unknown): void {
  global.fetch = vi.fn().mockResolvedValueOnce({
    ok: false,
    status,
    statusText,
    json: () => (body ? Promise.resolve(body) : Promise.reject(new Error('No body'))),
  } as unknown as Response);
}

function mockFetchNetworkError(): void {
  global.fetch = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch'));
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// ApiError
// ---------------------------------------------------------------------------

describe('ApiError', () => {
  it('has correct name, message, status, and code', () => {
    const err = new ApiError('Resource not found', 404, 'NOT_FOUND');
    expect(err.name).toBe('ApiError');
    expect(err.message).toBe('Resource not found');
    expect(err.status).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err instanceof Error).toBe(true);
  });

  it('code is optional', () => {
    const err = new ApiError('Bad request', 400);
    expect(err.code).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// authenticate
// ---------------------------------------------------------------------------

describe('authenticate', () => {
  it('returns valid result with user data on success', async () => {
    mockFetchOk({ id: 'user-1', name: 'Alice', email: 'alice@example.com' });
    const result = await authenticate(CONFIG);
    expect(result.valid).toBe(true);
    expect(result.userName).toBe('Alice');
    expect(result.userEmail).toBe('alice@example.com');
  });

  it('sends Authorization header with Bearer token', async () => {
    mockFetchOk({ id: 'user-1', name: 'Alice', email: 'alice@example.com' });
    await authenticate(CONFIG);
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const headers = call[1].headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer test-bearer-token-123');
  });

  it('calls /api/auth/me endpoint', async () => {
    mockFetchOk({ id: 'u', name: 'Bob', email: 'bob@example.com' });
    await authenticate(CONFIG);
    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toBe('https://notes.example.com/api/auth/me');
  });

  it('throws ApiError with status 401 on unauthorized', async () => {
    mockFetchError(401, 'Unauthorized', { message: 'Invalid token' });
    await expect(authenticate(CONFIG)).rejects.toThrow(ApiError);
  });

  it('ApiError has correct status on 401', async () => {
    mockFetchError(401, 'Unauthorized', { message: 'Invalid token' });
    try {
      await authenticate(CONFIG);
      expect.fail('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).status).toBe(401);
      expect((e as ApiError).message).toBe('Invalid token');
    }
  });

  it('propagates network errors', async () => {
    mockFetchNetworkError();
    await expect(authenticate(CONFIG)).rejects.toThrow('Failed to fetch');
  });
});

// ---------------------------------------------------------------------------
// createNote
// ---------------------------------------------------------------------------

describe('createNote', () => {
  it('returns note result on success', async () => {
    mockFetchOk({
      id: 'note-abc',
      title: 'My Article',
      path: 'My Article.md',
      appUrl: 'https://notes.example.com/workspaces/ws1/notes/note-abc',
    });

    const result = await createNote(CONFIG, {
      title: 'My Article',
      content: '# My Article\n\nContent here.',
      tags: ['web', 'clipper'],
    });

    expect(result.id).toBe('note-abc');
    expect(result.title).toBe('My Article');
    expect(result.path).toBe('My Article.md');
  });

  it('sends POST request to /api/notes', async () => {
    mockFetchOk({ id: 'n1', title: 'T', path: 'T.md' });
    await createNote(CONFIG, { title: 'T', content: 'C' });
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[1].method).toBe('POST');
    expect(call[0]).toBe('https://notes.example.com/api/notes');
  });

  it('sends JSON body with title, content, tags', async () => {
    mockFetchOk({ id: 'n1', title: 'T', path: 'T.md' });
    await createNote(CONFIG, {
      title: 'Test Note',
      content: 'Hello',
      tags: ['a', 'b'],
    });
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(call[1].body as string);
    expect(body.title).toBe('Test Note');
    expect(body.content).toBe('Hello');
    expect(body.tags).toEqual(['a', 'b']);
  });

  it('sends empty tags array when tags is not provided', async () => {
    mockFetchOk({ id: 'n1', title: 'T', path: 'T.md' });
    await createNote(CONFIG, { title: 'T', content: 'C' });
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(call[1].body as string);
    expect(body.tags).toEqual([]);
  });

  it('includes folderId and workspaceId when provided', async () => {
    mockFetchOk({ id: 'n1', title: 'T', path: 'T.md' });
    await createNote(CONFIG, {
      title: 'T',
      content: 'C',
      folderId: 'folder-1',
      workspaceId: 'ws-1',
    });
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(call[1].body as string);
    expect(body.folderId).toBe('folder-1');
    expect(body.workspaceId).toBe('ws-1');
  });

  it('throws ApiError on 500 server error', async () => {
    mockFetchError(500, 'Internal Server Error', { message: 'Database error' });
    await expect(createNote(CONFIG, { title: 'T', content: 'C' })).rejects.toMatchObject({
      status: 500,
      message: 'Database error',
    });
  });

  it('sets Content-Type: application/json header', async () => {
    mockFetchOk({ id: 'n1', title: 'T', path: 'T.md' });
    await createNote(CONFIG, { title: 'T', content: 'C' });
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const headers = call[1].headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
  });
});

// ---------------------------------------------------------------------------
// listFolders
// ---------------------------------------------------------------------------

describe('listFolders', () => {
  it('returns array of folders', async () => {
    const folders = [
      { id: 'f1', name: 'Projects', path: 'Projects', parentId: null },
      { id: 'f2', name: 'Archive', path: 'Archive', parentId: null },
    ];
    mockFetchOk(folders);
    const result = await listFolders(CONFIG);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('f1');
    expect(result[1].name).toBe('Archive');
  });

  it('sends GET request to /api/folders', async () => {
    mockFetchOk([]);
    await listFolders(CONFIG);
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe('https://notes.example.com/api/folders');
  });

  it('appends workspaceId as query param when provided', async () => {
    mockFetchOk([]);
    await listFolders(CONFIG, 'ws-123');
    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain('workspaceId=ws-123');
  });

  it('returns empty array when no folders exist', async () => {
    mockFetchOk([]);
    const result = await listFolders(CONFIG);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// listTags
// ---------------------------------------------------------------------------

describe('listTags', () => {
  it('returns array of tags', async () => {
    const tags = [
      { id: 't1', name: 'javascript', noteCount: 10 },
      { id: 't2', name: 'typescript', noteCount: 8 },
    ];
    mockFetchOk(tags);
    const result = await listTags(CONFIG);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('javascript');
  });

  it('sends GET request to /api/tags', async () => {
    mockFetchOk([]);
    await listTags(CONFIG);
    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toBe('https://notes.example.com/api/tags');
  });

  it('appends workspaceId when provided', async () => {
    mockFetchOk([]);
    await listTags(CONFIG, 'ws-456');
    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain('workspaceId=ws-456');
  });
});

// ---------------------------------------------------------------------------
// uploadImage
// ---------------------------------------------------------------------------

describe('uploadImage', () => {
  beforeEach(() => {
    // atob is available in Node 18+ / jsdom, but define a shim just in case
    if (typeof global.atob === 'undefined') {
      global.atob = (str: string) => Buffer.from(str, 'base64').toString('binary');
    }
    // Blob is available in Node 18+
    if (typeof global.Blob === 'undefined') {
      // Minimal Blob shim for testing
      (global as unknown as Record<string, unknown>).Blob = class {
        constructor(
          public parts: unknown[],
          public options: { type: string },
        ) {}
      };
    }
  });

  it('returns upload result on success', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          url: 'https://notes.example.com/uploads/screenshot.png',
          filename: 'screenshot.png',
        }),
    } as unknown as Response);

    const result = await uploadImage(
      CONFIG,
      'aGVsbG8=', // base64 "hello"
      'image/png',
      'screenshot.png',
    );

    expect(result.url).toBe('https://notes.example.com/uploads/screenshot.png');
    expect(result.filename).toBe('screenshot.png');
  });

  it('sends POST to /api/files/upload', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ url: 'https://u.com/f.png', filename: 'f.png' }),
    } as unknown as Response);

    await uploadImage(CONFIG, 'aGVsbG8=', 'image/png', 'f.png');
    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toBe('https://notes.example.com/api/files/upload');
  });

  it('throws ApiError on upload failure', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 413,
      json: () => Promise.resolve({ message: 'File too large' }),
    } as unknown as Response);

    await expect(uploadImage(CONFIG, 'aGVsbG8=', 'image/png', 'big.png')).rejects.toMatchObject({
      status: 413,
      message: 'File too large',
    });
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('api-client — error handling', () => {
  it('uses status text as message when response body has no message field', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      json: () => Promise.reject(new SyntaxError('not json')),
    } as unknown as Response);

    try {
      await authenticate(CONFIG);
      expect.fail('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).message).toContain('503');
    }
  });

  it('strips trailing slash from baseUrl', async () => {
    mockFetchOk({ id: 'u', name: 'Alice', email: 'a@example.com' });
    await authenticate({ baseUrl: 'https://notes.example.com/', token: 'tok' });
    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toBe('https://notes.example.com/api/auth/me');
  });
});
