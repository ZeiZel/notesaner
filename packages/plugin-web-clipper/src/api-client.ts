/**
 * Notesaner API client for the web clipper plugin.
 *
 * Provides typed wrappers around the Notesaner REST API needed for clipping:
 * - authenticate  — OAuth token exchange / validation
 * - createNote    — Create a new note with Markdown content
 * - uploadImage   — Upload an image file and get back a storage URL
 * - listFolders   — List folders available in a workspace
 * - listTags      — List existing tags in a workspace
 *
 * All methods throw an ApiError on non-2xx responses, allowing callers to
 * catch and display structured error messages.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ApiClientConfig {
  /** Base URL of the Notesaner server, e.g. https://notes.example.com */
  baseUrl: string;
  /** Bearer token obtained via OAuth flow. */
  token: string;
}

export interface NoteCreatePayload {
  /** Markdown content for the note. */
  content: string;
  /** Note title (also becomes the filename). */
  title: string;
  /** Optional folder ID to save into. When absent, saved to workspace root. */
  folderId?: string;
  /** Optional workspace ID. Defaults to user's default workspace. */
  workspaceId?: string;
  /** Optional tags to attach immediately. */
  tags?: string[];
}

export interface NoteCreateResult {
  /** ID of the newly created note. */
  id: string;
  /** Title of the note. */
  title: string;
  /** Path of the note within the workspace. */
  path: string;
  /** URL to open the note in the web app. */
  appUrl?: string;
}

export interface FolderItem {
  id: string;
  name: string;
  path: string;
  parentId: string | null;
}

export interface TagItem {
  id: string;
  name: string;
  noteCount: number;
}

export interface UploadImageResult {
  /** Publicly accessible URL of the uploaded image. */
  url: string;
  /** Filename assigned by the server. */
  filename: string;
}

export interface AuthValidateResult {
  /** Whether the token is valid. */
  valid: boolean;
  /** Display name of the authenticated user. */
  userName?: string;
  /** Email of the authenticated user. */
  userEmail?: string;
}

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function request<T>(
  config: ApiClientConfig,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${config.baseUrl.replace(/\/$/, '')}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.token}`,
    ...(options.headers as Record<string, string> | undefined),
  };

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    let message = `Request failed: ${response.status} ${response.statusText}`;
    let code: string | undefined;

    try {
      const body = (await response.json()) as { message?: string; code?: string };
      if (body.message) message = body.message;
      if (body.code) code = body.code;
    } catch {
      // Response body is not JSON — use status text
    }

    throw new ApiError(message, response.status, code);
  }

  // 204 No Content
  if (response.status === 204) {
    return undefined as unknown as T;
  }

  return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validates an auth token against the server and returns user information.
 *
 * @throws ApiError when the token is invalid or the server is unreachable.
 */
export async function authenticate(config: ApiClientConfig): Promise<AuthValidateResult> {
  const data = await request<{ id: string; name: string; email: string }>(config, '/api/auth/me');
  return {
    valid: true,
    userName: data.name,
    userEmail: data.email,
  };
}

/**
 * Creates a new note in Notesaner.
 *
 * @throws ApiError on failure.
 */
export async function createNote(
  config: ApiClientConfig,
  payload: NoteCreatePayload,
): Promise<NoteCreateResult> {
  return request<NoteCreateResult>(config, '/api/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: payload.title,
      content: payload.content,
      folderId: payload.folderId,
      workspaceId: payload.workspaceId,
      tags: payload.tags ?? [],
    }),
  });
}

/**
 * Uploads a base64-encoded image to the server's file storage.
 *
 * @param config         - API client configuration.
 * @param base64Data     - Base64-encoded image data (without data URI prefix).
 * @param mimeType       - MIME type of the image (e.g. "image/png").
 * @param filename       - Desired filename.
 * @param workspaceId    - Optional workspace to upload to.
 * @throws ApiError on failure.
 */
export async function uploadImage(
  config: ApiClientConfig,
  base64Data: string,
  mimeType: string,
  filename: string,
  workspaceId?: string,
): Promise<UploadImageResult> {
  // Convert base64 to Blob-like body for FormData
  const byteString = atob(base64Data);
  const byteArray = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) {
    byteArray[i] = byteString.charCodeAt(i);
  }
  const blob = new Blob([byteArray], { type: mimeType });

  const formData = new FormData();
  formData.append('file', blob, filename);
  if (workspaceId) formData.append('workspaceId', workspaceId);

  // Do not set Content-Type header — let the browser set multipart boundary
  const url = `${config.baseUrl.replace(/\/$/, '')}/api/files/upload`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.token}` },
    body: formData,
  });

  if (!response.ok) {
    let message = `Upload failed: ${response.status}`;
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // ignore
    }
    throw new ApiError(message, response.status);
  }

  return response.json() as Promise<UploadImageResult>;
}

/**
 * Lists all folders in a workspace.
 *
 * @throws ApiError on failure.
 */
export async function listFolders(
  config: ApiClientConfig,
  workspaceId?: string,
): Promise<FolderItem[]> {
  const qs = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : '';
  return request<FolderItem[]>(config, `/api/folders${qs}`);
}

/**
 * Lists all tags in a workspace.
 *
 * @throws ApiError on failure.
 */
export async function listTags(config: ApiClientConfig, workspaceId?: string): Promise<TagItem[]> {
  const qs = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : '';
  return request<TagItem[]>(config, `/api/tags${qs}`);
}
