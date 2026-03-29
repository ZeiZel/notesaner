/**
 * OpenTelemetry tracing bootstrap — MUST be loaded before NestJS app.
 *
 * This file is imported at the very top of main.ts (before any NestJS code)
 * so that all auto-instrumentations can hook into Node.js modules early.
 *
 * Exports the initialized NodeSDK instance for graceful shutdown.
 */
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
} from '@opentelemetry/semantic-conventions';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';

const OTEL_ENABLED = process.env['OTEL_ENABLED'] !== 'false';
const OTEL_EXPORTER_ENDPOINT =
  process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] ?? 'http://localhost:4318';
const SERVICE_NAME = process.env['OTEL_SERVICE_NAME'] ?? 'notesaner-server';
const SERVICE_VERSION = process.env['npm_package_version'] ?? '0.0.1';
const NODE_ENV = process.env['NODE_ENV'] ?? 'development';

let sdk: NodeSDK | undefined;

if (OTEL_ENABLED) {
  const traceExporter = new OTLPTraceExporter({
    url: `${OTEL_EXPORTER_ENDPOINT}/v1/traces`,
  });

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: SERVICE_NAME,
    [ATTR_SERVICE_VERSION]: SERVICE_VERSION,
    [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: NODE_ENV,
  });

  sdk = new NodeSDK({
    resource,
    spanProcessors: [new BatchSpanProcessor(traceExporter)],
    instrumentations: [
      new HttpInstrumentation({
        // Ignore health check and metrics endpoints to reduce noise
        ignoreIncomingRequestHook: (req) => {
          const url = req.url ?? '';
          return url.startsWith('/health') || url === '/metrics' || url.startsWith('/api/docs');
        },
      }),
      new ExpressInstrumentation(),
      new NestInstrumentation(),
      new PgInstrumentation({
        enhancedDatabaseReporting: NODE_ENV !== 'production',
      }),
      new IORedisInstrumentation(),
    ],
  });

  sdk.start();

  // Graceful shutdown — flush pending spans before process exit
  const shutdown = async (): Promise<void> => {
    try {
      await sdk?.shutdown();
    } catch {
      // Swallow errors during shutdown
    }
  };

  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());
}

export { sdk as otelSdk };
