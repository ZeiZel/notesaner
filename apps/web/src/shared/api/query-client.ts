import { QueryClient, type QueryClientConfig } from '@tanstack/react-query';
import { ApiError } from './client';

const queryClientConfig: QueryClientConfig = {
  defaultOptions: {
    queries: {
      // 30 seconds stale time for most data
      staleTime: 30 * 1000,
      // 5 minutes before removing from cache
      gcTime: 5 * 60 * 1000,
      retry: (failureCount, error) => {
        // Do not retry on 404 or 401 — these are expected client errors
        if (error instanceof ApiError) {
          if (error.status === 404 || error.status === 401) return false;
        }
        return failureCount < 2;
      },
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
};

/**
 * Creates a new QueryClient instance with default configuration.
 * Called once per server render and once on the client.
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient(queryClientConfig);
}

// Browser-side singleton — reused across navigations
let browserQueryClient: QueryClient | undefined;

export function getQueryClient(): QueryClient {
  if (typeof window === 'undefined') {
    // Server: always create a new QueryClient so that data
    // is not shared between requests
    return makeQueryClient();
  }

  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }

  return browserQueryClient;
}
