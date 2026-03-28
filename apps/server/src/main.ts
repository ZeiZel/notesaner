// OpenTelemetry MUST be imported before any other module so that
// auto-instrumentations can monkey-patch Node.js built-ins early.
import './common/tracing/tracing';

import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Buffer logs until Pino logger is available
    bufferLogs: true,
  });

  // Replace default NestJS logger with pino structured logger
  app.useLogger(app.get(Logger));

  // Trust proxy — required for correct IP extraction behind reverse proxies.
  // This enables req.ips and req.ip to reflect the real client IP.
  app.set('trust proxy', true);

  // Security: HTTP headers via helmet.
  // CSP is managed by SecurityHeadersMiddleware (runtime-configurable),
  // so we disable helmet's built-in CSP to avoid conflicts.
  app.use(
    helmet({
      contentSecurityPolicy: false, // Handled by SecurityHeadersMiddleware
      crossOriginEmbedderPolicy: false, // Allow embedding plugin iframes
      hsts: false, // Handled by SecurityHeadersMiddleware (conditional on NODE_ENV)
    }),
  );

  // Cookie parser for httpOnly refresh token cookies and CSRF double-submit cookies.
  // Cookies are configured with: HttpOnly (for auth), Secure (in production), SameSite=Strict.
  app.use(cookieParser());

  // Input validation — strip unknown properties, transform types
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // CORS — frontend origins configurable via env
  const allowedOrigins = process.env['ALLOWED_ORIGINS']?.split(',') ?? ['http://localhost:3000'];
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Cookie',
      'X-Request-ID',
      'X-CSRF-Token',
      'X-API-Key',
    ],
    exposedHeaders: [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'Retry-After',
    ],
  });

  // Global API prefix, except health checks, metrics, and public vault routes
  app.setGlobalPrefix('api', {
    exclude: ['/health', '/health/(.*)', '/metrics', '/public/(.*)'],
  });

  // ── Swagger / OpenAPI documentation ────────────────────────────────────────
  const isProduction = process.env['NODE_ENV'] === 'production';

  if (!isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Notesaner API')
      .setDescription(
        'Web-first note-taking platform API.\n\n' +
          '## Authentication\n' +
          'Most endpoints require a Bearer JWT token obtained from `POST /api/auth/login`.\n' +
          'Public endpoints (health checks, public vault routes, OIDC callbacks) do not require authentication.\n\n' +
          '## API Keys\n' +
          'The `/api/v1/*` endpoints use API key authentication via the `X-API-Key` header.\n\n' +
          '## Rate Limiting\n' +
          'Rate limiting is applied globally via the NestJS ThrottlerGuard. ' +
          'Public endpoints have stricter limits.\n\n' +
          '## Pagination\n' +
          'List endpoints use cursor-based pagination. The response includes a `nextCursor` field ' +
          'that should be passed as the `cursor` query parameter to fetch the next page.',
      )
      .setVersion('1.0.0')
      .setContact('Notesaner Team', 'https://notesaner.io', 'api@notesaner.io')
      .setLicense('AGPL-3.0', 'https://www.gnu.org/licenses/agpl-3.0.html')
      .addServer('http://localhost:4000', 'Local development')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT access token obtained from POST /api/auth/login',
        },
        'bearer',
      )
      .addApiKey(
        {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API key for programmatic access (v1 API)',
        },
        'api-key',
      )
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);

    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'none',
        filter: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
      customSiteTitle: 'Notesaner API Documentation',
    });
  }

  const port = parseInt(process.env['PORT'] ?? '4000', 10);
  await app.listen(port, '0.0.0.0');

  const logger = app.get(Logger);
  logger.log(`Notesaner server is running on port ${port}`);
  if (!isProduction) {
    logger.log(`Swagger documentation available at http://localhost:${port}/api/docs`);
    logger.log(`Prometheus metrics available at http://localhost:${port}/metrics`);
  }
}

bootstrap().catch((error: unknown) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
