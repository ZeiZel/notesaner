/**
 * Application metrics names — use these constants to inject counters/histograms.
 */
export const METRICS = {
  /** HTTP request duration in seconds, labeled by method, route, status_code. */
  HTTP_DURATION: 'http_request_duration_seconds',

  /** Active WebSocket connections gauge. */
  WS_CONNECTIONS: 'ws_connections_active',

  /** Note CRUD operation counter, labeled by operation (create|read|update|delete). */
  NOTE_OPERATIONS: 'note_operations_total',

  /** BullMQ job duration in seconds, labeled by queue, job_name, status. */
  JOB_DURATION: 'job_duration_seconds',

  /** HTTP error counter, labeled by method, route, status_code. */
  HTTP_ERRORS: 'http_errors_total',
} as const;
