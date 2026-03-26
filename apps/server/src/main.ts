import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Buffer logs until Pino logger is available
    bufferLogs: true,
  });

  // Security: HTTP headers
  app.use(
    helmet({
      // CSP is configured per-route via Next.js middleware
      contentSecurityPolicy: false,
    }),
  );

  // Cookie parser for httpOnly refresh token cookies
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
  const allowedOrigins =
    process.env['ALLOWED_ORIGINS']?.split(',') ?? ['http://localhost:3000'];
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  });

  // Global API prefix, except health checks and public vault routes
  app.setGlobalPrefix('api', {
    exclude: ['/health', '/health/(.*)', '/public/(.*)'],
  });

  const port = parseInt(process.env['PORT'] ?? '4000', 10);
  await app.listen(port, '0.0.0.0');

  // Use built-in NestJS logger for startup message
  const logger = app.get('Logger', { strict: false }) as {
    log?: (msg: string) => void;
  } | null;
  const logFn =
    logger && typeof logger.log === 'function'
      ? (msg: string) => logger.log!(msg)
      : (msg: string) => console.log(msg);

  logFn(`Notesaner server is running on port ${port}`);
}

bootstrap().catch((error: unknown) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
