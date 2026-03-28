/**
 * Tests for the comments API client.
 *
 * Validates that the commentsApi module constructs correct URLs and payloads.
 * Uses vi.mock to intercept the apiClient.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the API client before importing the module
vi.mock('@/shared/api/client', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue([]),
    post: vi.fn().mockResolvedValue({}),
    patch: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue(undefined),
  },
}));

import { commentsApi } from '../api/comments';
import { apiClient } from '@/shared/api/client';

const mockedClient = vi.mocked(apiClient);

describe('commentsApi', () => {
  const token = 'test-token';
  const workspaceId = 'ws-123';
  const noteId = 'note-456';
  const commentId = 'comment-789';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('list() calls GET /api/workspaces/:wid/notes/:nid/comments', async () => {
    await commentsApi.list(token, workspaceId, noteId);

    expect(mockedClient.get).toHaveBeenCalledWith(
      `/api/workspaces/${workspaceId}/notes/${noteId}/comments`,
      { token },
    );
  });

  it('create() calls POST with content and position', async () => {
    const payload = { content: 'Test comment', position: { from: 10, to: 20 } };

    await commentsApi.create(token, workspaceId, noteId, payload);

    expect(mockedClient.post).toHaveBeenCalledWith(
      `/api/workspaces/${workspaceId}/notes/${noteId}/comments`,
      payload,
      { token },
    );
  });

  it('reply() calls POST /api/comments/:id/replies', async () => {
    const payload = { content: 'Reply text' };

    await commentsApi.reply(token, commentId, payload);

    expect(mockedClient.post).toHaveBeenCalledWith(`/api/comments/${commentId}/replies`, payload, {
      token,
    });
  });

  it('update() calls PATCH /api/comments/:id', async () => {
    const payload = { content: 'Updated content' };

    await commentsApi.update(token, commentId, payload);

    expect(mockedClient.patch).toHaveBeenCalledWith(`/api/comments/${commentId}`, payload, {
      token,
    });
  });

  it('delete() calls DELETE /api/comments/:id', async () => {
    await commentsApi.delete(token, commentId);

    expect(mockedClient.delete).toHaveBeenCalledWith(`/api/comments/${commentId}`, { token });
  });

  it('resolve() calls PATCH /api/comments/:id/resolve', async () => {
    await commentsApi.resolve(token, commentId);

    expect(mockedClient.patch).toHaveBeenCalledWith(
      `/api/comments/${commentId}/resolve`,
      undefined,
      { token },
    );
  });
});
