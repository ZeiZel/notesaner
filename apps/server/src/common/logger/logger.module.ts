import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CORRELATION_ID_HEADER } from '../middleware/correlation-id.middleware';
import type { IncomingMessage } from 'node:http';

/**
 * Structured JSON logging via pino + nestjs-pino.
 *
 * Features:
 *   - Structured JSON in production, pretty-printed in development
 *   - Configurable log level via LOG_LEVEL env var
 *   - Automatic correlation ID injection (from X-Request-ID header)
 *   - Request/response logging with duration
 *   - Sensitive header redaction (authorization, cookie)
 */
@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: ((config: ConfigService) => {
        const nodeEnv = config.get<string>('nodeEnv', 'development');
        const logLevel = config.get<string>('logging.level', 'info');
        const isProduction = nodeEnv === 'production';

        return {
          pinoHttp: {
            level: logLevel,

            // Use the correlation ID from the request
            genReqId: (req: IncomingMessage): string => {
              return String((req as IncomingMessage & { id?: string | number }).id ?? 'unknown');
            },

            // Redact sensitive data
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'req.headers["x-api-key"]',
              ],
              censor: '[REDACTED]',
            },

            // Custom serializers for cleaner log output
            serializers: {
              req(req: {
                id?: string;
                method?: string;
                url?: string;
                headers?: Record<string, string>;
                remoteAddress?: string;
              }) {
                return {
                  id: req.id,
                  method: req.method,
                  url: req.url,
                  remoteAddress: req.remoteAddress,
                  // Only include correlation ID header, not all headers
                  correlationId: req.headers?.[CORRELATION_ID_HEADER] ?? req.id,
                };
              },
              res(res: { statusCode?: number }) {
                return {
                  statusCode: res.statusCode,
                };
              },
            },

            // Custom log level based on status code
            customLogLevel: (
              _req: IncomingMessage,
              res: { statusCode: number },
              err?: Error,
            ): string => {
              if (err || res.statusCode >= 500) return 'error';
              if (res.statusCode >= 400) return 'warn';
              return 'info';
            },

            // Custom success message format
            customSuccessMessage: (
              req: IncomingMessage & { method?: string; url?: string },
              res: { statusCode: number },
              responseTime: number,
            ): string => {
              return `${req.method} ${req.url} ${res.statusCode} ${Math.round(responseTime)}ms`;
            },

            // Custom error message format
            customErrorMessage: (
              req: IncomingMessage & { method?: string; url?: string },
              res: { statusCode: number },
              err: Error,
            ): string => {
              return `${req.method} ${req.url} ${res.statusCode} — ${err.message}`;
            },

            // Quiet health/metrics/docs endpoints in logs
            autoLogging: {
              ignore: (req: IncomingMessage): boolean => {
                const url = req.url ?? '';
                return (
                  url.startsWith('/health') || url === '/metrics' || url.startsWith('/api/docs')
                );
              },
            },

            // Pretty-print in development, JSON in production
            transport: isProduction
              ? undefined
              : {
                  target: 'pino-pretty',
                  options: {
                    colorize: true,
                    singleLine: false,
                    translateTime: 'HH:MM:ss.l',
                    ignore: 'pid,hostname',
                  },
                },
          },
        };
      }) as unknown,
    }),
  ],
})
export class AppLoggerModule {}
