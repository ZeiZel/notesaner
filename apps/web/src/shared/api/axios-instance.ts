/**
 * Pre-configured axios instance for the Notesaner backend.
 *
 * Features:
 * - Base URL from environment (NEXT_PUBLIC_API_URL or fallback)
 * - Default headers: Content-Type and Accept as application/json
 * - Request interceptor: injects Bearer token from auth store
 * - Response interceptor: normalizes errors to ApiError format
 * - Dev mode request/response logging
 */

import axios from 'axios';
import type { AxiosError, InternalAxiosRequestConfig } from 'axios';

import { ApiError } from './api-error';

// ---------------------------------------------------------------------------
// Instance
// ---------------------------------------------------------------------------

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// ---------------------------------------------------------------------------
// Request interceptor — inject Bearer token from Zustand auth store
// ---------------------------------------------------------------------------

axiosInstance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  // Only inject token on the client side where localStorage is available.
  // The token can also be passed explicitly per-request via the
  // `Authorization` header — in that case we do not overwrite it.
  if (typeof window !== 'undefined' && !config.headers.get('Authorization')) {
    try {
      const raw = localStorage.getItem('notesaner-auth');
      if (raw) {
        const persisted = JSON.parse(raw) as {
          state?: { accessToken?: string | null };
        };
        const token = persisted?.state?.accessToken;
        if (token) {
          config.headers.set('Authorization', `Bearer ${token}`);
        }
      }
    } catch {
      // localStorage may be unavailable (SSR, incognito quota exceeded, etc.)
    }
  }

  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.debug(`[axios] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
  }

  return config;
});

// ---------------------------------------------------------------------------
// Response interceptor — normalize errors to ApiError
// ---------------------------------------------------------------------------

axiosInstance.interceptors.response.use(
  (response) => {
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.debug(
        `[axios] ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`,
      );
    }
    return response;
  },
  (error: AxiosError<{ code?: string; message?: string; details?: unknown }>) => {
    if (error.response) {
      const { status, data } = error.response;
      throw new ApiError(
        status,
        data?.code ?? 'UNKNOWN_ERROR',
        data?.message ?? `HTTP ${status}`,
        data?.details,
      );
    }

    // Network error or request cancelled
    throw new ApiError(0, 'NETWORK_ERROR', error.message || 'Network error');
  },
);

export default axiosInstance;
