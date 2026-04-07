import { Module } from '@nestjs/common';
import {
  PrometheusModule,
  makeCounterProvider,
  makeHistogramProvider,
  makeGaugeProvider,
} from '@willsoto/nestjs-prometheus';
import { MetricsService } from './metrics.service';
import { METRICS } from './metrics.constants';

@Module({
  imports: [
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: {
        enabled: true,
      },
    }),
  ],
  providers: [
    // HTTP request duration histogram
    makeHistogramProvider({
      name: METRICS.HTTP_DURATION,
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
    }),

    // WebSocket active connections gauge
    makeGaugeProvider({
      name: METRICS.WS_CONNECTIONS,
      help: 'Number of active WebSocket connections',
    }),

    // Note CRUD operations counter
    makeCounterProvider({
      name: METRICS.NOTE_OPERATIONS,
      help: 'Total number of note CRUD operations',
      labelNames: ['operation'],
    }),

    // BullMQ job duration histogram
    makeHistogramProvider({
      name: METRICS.JOB_DURATION,
      help: 'Duration of background job processing in seconds',
      labelNames: ['queue', 'job_name', 'status'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120],
    }),

    // HTTP error counter
    makeCounterProvider({
      name: METRICS.HTTP_ERRORS,
      help: 'Total number of HTTP errors (4xx and 5xx)',
      labelNames: ['method', 'route', 'status_code'],
    }),

    MetricsService,
  ],
  exports: [MetricsService],
})
export class MetricsModule {}
