/**
 * createQueryFactory — generates typed TanStack Query hooks from endpoint definitions.
 *
 * Similar to RTK Query's `createApi` but built for TanStack Query + axios.
 *
 * Usage:
 * ```ts
 * const api = createQueryFactory(axiosInstance, {
 *   getNotes: {
 *     queryKey: (p) => ['notes', p.workspaceId],
 *     request: (p, ax) => ax.get<Note[]>(`/workspaces/${p.workspaceId}/notes`),
 *   },
 *   createNote: {
 *     request: (data, ax) => ax.post<Note>('/notes', data),
 *     invalidates: () => [['notes']],
 *   },
 * });
 *
 * // api.useGetNotes({ workspaceId: '...' })
 * // api.useCreateNote()
 * // api.getNotesQueryOptions({ workspaceId: '...' })
 * // api.getNotesQueryKey({ workspaceId: '...' })
 * ```
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { AxiosInstance } from 'axios';

import type {
  EndpointDefinitions,
  QueryFactoryApi,
  QueryHookOptions,
  MutationHookOptions,
} from './types';
import { isQueryDefinition } from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Capitalize the first character of a string at runtime. */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a typed API object with generated TanStack Query hooks.
 *
 * @param instance - Axios instance to use for all requests
 * @param definitions - Map of endpoint names to their query/mutation definitions
 * @returns An object with generated hooks, query options, and query key helpers
 */
export function createQueryFactory<TDefs extends EndpointDefinitions>(
  instance: AxiosInstance,
  definitions: TDefs,
): QueryFactoryApi<TDefs> {
  const api: Record<string, unknown> = {};

  for (const [name, definition] of Object.entries(definitions)) {
    if (isQueryDefinition(definition)) {
      // -----------------------------------------------------------------------
      // Query endpoint: generates useXxx, xxxQueryOptions, xxxQueryKey
      // -----------------------------------------------------------------------

      const hookName = `use${capitalize(name)}`;
      const queryOptionsName = `${name}QueryOptions`;
      const queryKeyName = `${name}QueryKey`;

      // xxxQueryKey(params) -> QueryKey
      const getQueryKey = (params: unknown) => definition.queryKey(params);

      // xxxQueryOptions(params) -> { queryKey, queryFn, staleTime?, gcTime? }
      const getQueryOptions = (params: unknown) => ({
        queryKey: definition.queryKey(params),
        queryFn: async () => {
          const response = await definition.request(params, instance);
          return response.data;
        },
        ...(definition.staleTime !== undefined && { staleTime: definition.staleTime }),
        ...(definition.gcTime !== undefined && { gcTime: definition.gcTime }),
      });

      // useXxx(params, options?) -> UseQueryResult
      const useHook = (params: unknown, options?: QueryHookOptions<unknown>) => {
        const queryOptions = getQueryOptions(params);
        return useQuery({
          ...queryOptions,
          ...options,
        });
      };

      api[hookName] = useHook;
      api[queryOptionsName] = getQueryOptions;
      api[queryKeyName] = getQueryKey;
    } else {
      // -----------------------------------------------------------------------
      // Mutation endpoint: generates useXxx
      // -----------------------------------------------------------------------

      const hookName = `use${capitalize(name)}`;

      // useXxx(options?) -> UseMutationResult
      const useHook = (options?: MutationHookOptions<unknown, unknown>) => {
        const queryClient = useQueryClient();

        return useMutation({
          mutationFn: async (variables: unknown) => {
            const response = await definition.request(variables, instance);
            return response.data;
          },
          onSuccess: (data, variables, onMutateResult, mutationContext) => {
            // Auto-invalidate configured query keys
            if (definition.invalidates) {
              const keysToInvalidate = definition.invalidates(data, variables);
              for (const key of keysToInvalidate) {
                void queryClient.invalidateQueries({ queryKey: key });
              }
            }

            // Call user-provided onSuccess after invalidation
            options?.onSuccess?.(data, variables, onMutateResult, mutationContext);
          },
          onError: options?.onError,
          onSettled: options?.onSettled,
          // Spread remaining options (retry, etc.), excluding callbacks we handle
          ...(options?.retry !== undefined && { retry: options.retry }),
          ...(options?.retryDelay !== undefined && { retryDelay: options.retryDelay }),
          ...(options?.networkMode !== undefined && { networkMode: options.networkMode }),
          ...(options?.gcTime !== undefined && { gcTime: options.gcTime }),
          ...(options?.mutationKey !== undefined && { mutationKey: options.mutationKey }),
          ...(options?.meta !== undefined && { meta: options.meta }),
        });
      };

      api[hookName] = useHook;
    }
  }

  return api as QueryFactoryApi<TDefs>;
}
