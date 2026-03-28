/**
 * Core type definitions for @notesaner/query-factory.
 *
 * These types enable full TypeScript inference so that:
 * - Return types from axios calls flow through to hook return types
 * - Query keys are type-safe and derived from the definition
 * - Mutations carry correct variable and data types
 */

import type { UseQueryOptions, UseMutationOptions, QueryKey } from '@tanstack/react-query';
import type { AxiosInstance, AxiosResponse } from 'axios';

// ---------------------------------------------------------------------------
// Query Definition
// ---------------------------------------------------------------------------

/**
 * A query definition describes a GET-style request that maps to a `useQuery` hook.
 *
 * @template TParams - The parameter type for the query (e.g. `{ workspaceId: string }`)
 * @template TData   - The response data type (unwrapped from AxiosResponse)
 */
export interface QueryDefinition<TParams, TData> {
  /** Function that returns a stable query key given the parameters. */
  queryKey: (params: TParams) => QueryKey;

  /**
   * Function that performs the actual HTTP request.
   * Should return a Promise<AxiosResponse<TData>> (i.e. `axios.get<TData>(...)`)
   * The factory will auto-unwrap `response.data`.
   */
  request: (params: TParams, instance: AxiosInstance) => Promise<AxiosResponse<TData>>;

  /**
   * Default staleTime override for this specific query.
   * Falls back to the QueryClient default if not specified.
   */
  staleTime?: number;

  /**
   * Default gcTime (garbage collection time) override for this specific query.
   * Falls back to the QueryClient default if not specified.
   */
  gcTime?: number;
}

// ---------------------------------------------------------------------------
// Mutation Definition
// ---------------------------------------------------------------------------

/**
 * A mutation definition describes a POST/PUT/DELETE-style request
 * that maps to a `useMutation` hook.
 *
 * @template TVariables - The input type for the mutation (e.g. `CreateNoteDto`)
 * @template TData      - The response data type (unwrapped from AxiosResponse)
 */
export interface MutationDefinition<TVariables, TData> {
  /**
   * Function that performs the mutation HTTP request.
   * Should return a Promise<AxiosResponse<TData>>.
   * The factory will auto-unwrap `response.data`.
   */
  request: (variables: TVariables, instance: AxiosInstance) => Promise<AxiosResponse<TData>>;

  /**
   * Query keys to invalidate on successful mutation.
   * Receives the response data and the original variables so that
   * invalidation can be context-aware.
   *
   * Return an array of query key prefixes. Each prefix will be used with
   * `queryClient.invalidateQueries({ queryKey: prefix })`.
   */
  invalidates?: (data: TData, variables: TVariables) => QueryKey[];
}

// ---------------------------------------------------------------------------
// Endpoint Definitions Map
// ---------------------------------------------------------------------------

/**
 * A single endpoint definition -- either a query or a mutation.
 * Discriminated by the presence of `queryKey` (query) vs its absence (mutation).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EndpointDefinition = QueryDefinition<any, any> | MutationDefinition<any, any>;

/** A map of endpoint names to their definitions. */
export type EndpointDefinitions = Record<string, EndpointDefinition>;

// ---------------------------------------------------------------------------
// Type Guards
// ---------------------------------------------------------------------------

export function isQueryDefinition(
  def: EndpointDefinition,
): def is QueryDefinition<unknown, unknown> {
  return 'queryKey' in def;
}

export function isMutationDefinition(
  def: EndpointDefinition,
): def is MutationDefinition<unknown, unknown> {
  return !('queryKey' in def);
}

// ---------------------------------------------------------------------------
// Inferred hook types
// ---------------------------------------------------------------------------

/**
 * Options passthrough for generated query hooks.
 * Allows the consumer to override `enabled`, `staleTime`, `gcTime`,
 * and other TanStack Query options.
 */
export type QueryHookOptions<TData> = Omit<
  UseQueryOptions<TData, Error, TData, QueryKey>,
  'queryKey' | 'queryFn'
>;

/**
 * Options passthrough for generated mutation hooks.
 */
export type MutationHookOptions<TData, TVariables> = Omit<
  UseMutationOptions<TData, Error, TVariables>,
  'mutationFn'
>;

// ---------------------------------------------------------------------------
// Generated API surface types
// ---------------------------------------------------------------------------

/** Extract the params type from a QueryDefinition. */
type QueryParams<T> = T extends QueryDefinition<infer P, unknown> ? P : never;

/** Extract the data type from a QueryDefinition. */
type QueryData<T> = T extends QueryDefinition<unknown, infer D> ? D : never;

/** Extract the variables type from a MutationDefinition. */
type MutationVariables<T> = T extends MutationDefinition<infer V, unknown> ? V : never;

/** Extract the data type from a MutationDefinition. */
type MutationData<T> = T extends MutationDefinition<unknown, infer D> ? D : never;

/**
 * For a single query definition named `getX`, generates:
 * - `useGetX(params, options?)` — React hook
 * - `getXQueryOptions(params)` — for prefetching / SSR
 * - `getXQueryKey(params)` — for manual cache operations
 */
type QueryEndpointHooks<TName extends string, TDef> = {
  [K in `use${Capitalize<TName>}`]: (
    params: QueryParams<TDef>,
    options?: QueryHookOptions<QueryData<TDef>>,
  ) => import('@tanstack/react-query').UseQueryResult<QueryData<TDef>, Error>;
} & {
  [K in `${TName}QueryOptions`]: (params: QueryParams<TDef>) => {
    queryKey: QueryKey;
    queryFn: () => Promise<QueryData<TDef>>;
    staleTime?: number;
    gcTime?: number;
  };
} & {
  [K in `${TName}QueryKey`]: (params: QueryParams<TDef>) => QueryKey;
};

/**
 * For a single mutation definition named `createX`, generates:
 * - `useCreateX(options?)` — React hook
 */
type MutationEndpointHooks<TName extends string, TDef> = {
  [K in `use${Capitalize<TName>}`]: (
    options?: MutationHookOptions<MutationData<TDef>, MutationVariables<TDef>>,
  ) => import('@tanstack/react-query').UseMutationResult<
    MutationData<TDef>,
    Error,
    MutationVariables<TDef>
  >;
};

/**
 * Generates the correct hook shape for a single endpoint
 * based on whether it is a query or mutation definition.
 */
type EndpointHooks<TName extends string, TDef> =
  TDef extends QueryDefinition<infer _P, infer _D>
    ? QueryEndpointHooks<TName, TDef>
    : TDef extends MutationDefinition<infer _V, infer _D2>
      ? MutationEndpointHooks<TName, TDef>
      : never;

/**
 * The full generated API object type.
 * Merges all endpoint hooks into a single flat object.
 */
export type QueryFactoryApi<TDefs extends EndpointDefinitions> = {
  [K in keyof TDefs & string]: never;
} extends infer _
  ? UnionToIntersection<
      {
        [K in keyof TDefs & string]: EndpointHooks<K, TDefs[K]>;
      }[keyof TDefs & string]
    >
  : never;

/**
 * Utility: Converts a union type to an intersection type.
 * `A | B | C` -> `A & B & C`
 */
type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (
  k: infer I,
) => void
  ? I
  : never;
