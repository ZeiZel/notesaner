import { Injectable } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Gauge, Histogram } from 'prom-client';
import { METRICS } from './metrics.constants';

/**
 * Centralised facade for recording application metrics.
 *
 * Inject this service in controllers, gateways, processors, etc.
 * rather than injecting individual metrics directly.
 */
@Injectable()
export class MetricsService {
  constructor(
    @InjectMetric(METRICS.HTTP_DURATION)
    private readonly httpDuration: Histogram<string>,

    @InjectMetric(METRICS.WS_CONNECTIONS)
    private readonly wsConnections: Gauge<string>,

    @InjectMetric(METRICS.NOTE_OPERATIONS)
    private readonly noteOperations: Counter<string>,

    @InjectMetric(METRICS.JOB_DURATION)
    private readonly jobDuration: Histogram<string>,

    @InjectMetric(METRICS.HTTP_ERRORS)
    private readonly httpErrors: Counter<string>,
  ) {}

  // ── HTTP ──────────────────────────────────────────────────────────────────

  /**
   * Record an HTTP request duration.
   * Called from the metrics interceptor.
   */
  recordHttpDuration(
    method: string,
    route: string,
    statusCode: number,
    durationSeconds: number,
  ): void {
    this.httpDuration.labels(method, route, String(statusCode)).observe(durationSeconds);

    if (statusCode >= 400) {
      this.httpErrors.labels(method, route, String(statusCode)).inc();
    }
  }

  // ── WebSocket ─────────────────────────────────────────────────────────────

  /** Increment active WebSocket connections. */
  wsConnectionOpened(): void {
    this.wsConnections.inc();
  }

  /** Decrement active WebSocket connections. */
  wsConnectionClosed(): void {
    this.wsConnections.dec();
  }

  // ── Notes ─────────────────────────────────────────────────────────────────

  /** Record a note CRUD operation. */
  recordNoteOperation(operation: 'create' | 'read' | 'update' | 'delete'): void {
    this.noteOperations.labels(operation).inc();
  }

  // ── Jobs ──────────────────────────────────────────────────────────────────

  /**
   * Record a background job execution duration.
   * @param queue — BullMQ queue name
   * @param jobName — Job type/name
   * @param status — 'completed' | 'failed'
   * @param durationSeconds — Execution time in seconds
   */
  recordJobDuration(
    queue: string,
    jobName: string,
    status: 'completed' | 'failed',
    durationSeconds: number,
  ): void {
    this.jobDuration.labels(queue, jobName, status).observe(durationSeconds);
  }
}
