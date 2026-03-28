/**
 * HTTP API client for the Notesaner backend.
 *
 * Public API surface (unchanged):
 * - ApiError class for structured error handling
 * - apiClient with get(), post(), put(), patch(), delete() methods
 *
 * Internally uses a pre-configured axios instance (see axios-instance.ts)
 * with automatic auth token injection, error normalisation, and dev logging.
 */

import axiosInstance from './axios-instance';

// ---------------------------------------------------------------------------
// Error class — re-exported for backward compatibility
// ---------------------------------------------------------------------------

export { ApiError } from './api-error';

// ---------------------------------------------------------------------------
// Request options — preserved for backward compatibility
// ---------------------------------------------------------------------------

interface RequestOptions {
  /** Optional per-request auth token (overrides interceptor). */
  token?: string;
  /** Extra headers merged onto the request. */
  headers?: Record<string, string>;
  /** AbortController signal for request cancellation. */
  signal?: AbortSignal;
}

// ---------------------------------------------------------------------------
// Internal request helper
// ---------------------------------------------------------------------------

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers ?? {}),
  };

  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }

  const response = await axiosInstance.request<T>({
    method,
    url: path,
    data: body,
    headers,
    signal: options.signal,
  });

  // axios returns { data, status, ... }; we only expose the data payload
  // to keep the public API identical to the original fetch-based client.
  return response.data;
}

// ---------------------------------------------------------------------------
// Public API — same signature as the original fetch-based client
// ---------------------------------------------------------------------------

export const apiClient = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'body'>) =>
    request<T>('GET', path, undefined, options),

  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('POST', path, body, options),

  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PUT', path, body, options),

  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PATCH', path, body, options),

  delete: <T>(path: string, options?: Omit<RequestOptions, 'body'>) =>
    request<T>('DELETE', path, undefined, options),
};
