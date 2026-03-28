import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request, Response } from 'express';
import { MetricsService } from '../metrics/metrics.service';

/**
 * Interceptor that records HTTP request duration and error metrics
 * via Prometheus counters/histograms.
 *
 * The route label is derived from the Express route pattern (e.g. `/api/notes/:id`)
 * rather than the actual URL to avoid high-cardinality label explosion.
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // Only handle HTTP requests, skip WebSocket / RPC
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const startTime = process.hrtime.bigint();

    return next.handle().pipe(
      tap({
        next: () => {
          this.recordMetrics(request, response, startTime);
        },
        error: () => {
          this.recordMetrics(request, response, startTime);
        },
      }),
    );
  }

  private recordMetrics(request: Request, response: Response, startTime: bigint): void {
    const durationNs = Number(process.hrtime.bigint() - startTime);
    const durationSeconds = durationNs / 1e9;

    // Use the route pattern to avoid cardinality explosion
    // Express stores the matched route pattern in req.route?.path
    const route =
      (request.route as { path?: string } | undefined)?.path ?? request.path ?? 'unknown';

    this.metrics.recordHttpDuration(request.method, route, response.statusCode, durationSeconds);
  }
}
