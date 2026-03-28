/**
 * Structured API error class.
 *
 * Used across the API layer (axios interceptors, client methods, query-client
 * retry logic) to represent non-OK HTTP responses in a uniform way.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
