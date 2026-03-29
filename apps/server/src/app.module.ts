import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerStorage } from '@nestjs/throttler';
import { configuration } from './config/configuration';
import { validateConfig } from './config/validation';
import { ApiKeyOrJwtGuard } from './modules/auth/api-keys/api-key-or-jwt.guard';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { MetricsInterceptor } from './common/interceptors/metrics.interceptor';
import { RateLimitHeadersInterceptor } from './common/interceptors/rate-limit-headers.interceptor';
import { CacheControlInterceptor } from './common/interceptors/cache-control.interceptor';
import { ETagInterceptor } from './common/interceptors/etag.interceptor';
import { PageCacheInterceptor } from './common/interceptors/page-cache.interceptor';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { SecurityHeadersMiddleware } from './common/middleware/security-headers.middleware';
import { CsrfMiddleware } from './common/middleware/csrf.middleware';
import { CacheControlMiddleware } from './common/middleware/cache-control.middleware';
import { CompressionMiddleware } from './common/middleware/compression.middleware';
import { ThrottlerBehindProxyGuard } from './common/throttler/throttler-behind-proxy.guard';
import { ValkeyThrottlerStorage } from './common/throttler/valkey-throttler-storage.service';
import { AccountLockoutService } from './common/services/account-lockout.service';
import { PageCacheService } from './common/services/page-cache.service';
import { WsConnectionLimitGuard } from './common/guards/ws-connection-limit.guard';
import { AppLoggerModule } from './common/logger';
import { MetricsModule } from './common/metrics';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { WorkspacesModule } from './modules/workspaces/workspaces.module';
import { NotesModule } from './modules/notes/notes.module';
import { FilesModule } from './modules/files/files.module';
import { SearchModule } from './modules/search/search.module';
import { SyncModule } from './modules/sync/sync.module';
import { PluginsModule } from './modules/plugins/plugins.module';
import { PublishModule } from './modules/publish/publish.module';
import { HealthModule } from './modules/health/health.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { AdminModule } from './modules/admin/admin.module';
import { BackupModule } from './modules/backup/backup.module';
import { PreferencesModule } from './modules/preferences/preferences.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ActivityModule } from './modules/activity/activity.module';
import { ApiV1Module } from './modules/api-v1/api-v1.module';
import { ComponentOverridesModule } from './modules/component-overrides/component-overrides.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateConfig,
      envFilePath: ['.env.local', '.env'],
    }),

    // ── Rate Limiting (ThrottlerModule) ────────────────────────────────────
    // Global default: 100 requests per minute per user/IP.
    // Route-specific limits are applied via @RateLimit() / @Throttle() decorators.
    // Storage is overridden by the ThrottlerStorage provider below to use ValKey.
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: config.get<number>('rateLimit.global.ttlSeconds', 60) * 1000,
            limit: config.get<number>('rateLimit.global.limit', 100),
          },
        ],
      }),
    }),

    // Structured JSON logging via pino
    AppLoggerModule,
    // Prometheus metrics at /metrics
    MetricsModule,
    // Global Prisma client — available everywhere via DI
    PrismaModule,
    // Jobs module registers BullMQ queues and processors
    JobsModule,
    AuthModule,
    UsersModule,
    WorkspacesModule,
    NotesModule,
    FilesModule,
    SearchModule,
    SyncModule,
    PluginsModule.forRoot(),
    PublishModule,
    HealthModule,
    AdminModule,
    BackupModule,
    PreferencesModule,
    NotificationsModule,
    ActivityModule,
    ComponentOverridesModule,
    // Public REST API v1 — API key + JWT webhook management
    ApiV1Module,
  ],
  providers: [
    // ── Throttler storage backed by ValKey ────────────────────────────────
    // Override the default in-memory storage with ValKey-backed storage
    // for multi-instance rate-limit consistency.
    ValkeyThrottlerStorage,
    {
      provide: ThrottlerStorage,
      useExisting: ValkeyThrottlerStorage,
    },

    // ── Global guards ────────────────────────────────────────────────────
    {
      provide: APP_GUARD,
      useClass: ThrottlerBehindProxyGuard,
    },
    // Combined API key + JWT guard: tries API key auth first (Bearer nts_xxx
    // or X-API-Key header), then falls back to JWT. Routes marked @Public()
    // bypass authentication entirely.
    {
      provide: APP_GUARD,
      useClass: ApiKeyOrJwtGuard,
    },

    // ── Global filters ───────────────────────────────────────────────────
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },

    // ── Global interceptors ──────────────────────────────────────────────
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RateLimitHeadersInterceptor,
    },

    // ── Cache & ETag interceptors ───────────────────────────────────────
    // PageCacheInterceptor — ValKey page cache for published note pages.
    // Must run BEFORE CacheControl and ETag interceptors so that cached
    // responses still get proper cache headers computed downstream.
    {
      provide: APP_INTERCEPTOR,
      useClass: PageCacheInterceptor,
    },
    // CacheControlInterceptor sets Cache-Control headers based on @CachePolicy()
    // and @CacheControl() decorator metadata, complementing the
    // CacheControlMiddleware (which uses route pattern matching from cache-policy.ts).
    {
      provide: APP_INTERCEPTOR,
      useClass: CacheControlInterceptor,
    },
    // ETagInterceptor computes weak ETags for GET responses, enabling
    // conditional requests (If-None-Match → 304 Not Modified).
    // Supports updatedAt-based ETags and If-Modified-Since.
    {
      provide: APP_INTERCEPTOR,
      useClass: ETagInterceptor,
    },

    // ── Shared services ──────────────────────────────────────────────────
    AccountLockoutService,
    // PageCacheService — centralised cache invalidation for page-level caches.
    // Injected by services that mutate published content (publish, unpublish, note update).
    PageCacheService,
    WsConnectionLimitGuard,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Correlation ID must run before everything else so pino-http picks it up
    consumer.apply(CorrelationIdMiddleware).forRoutes({ path: '*', method: RequestMethod.ALL });

    // Security headers (CSP, HSTS, Permissions-Policy, etc.)
    consumer.apply(SecurityHeadersMiddleware).forRoutes({ path: '*', method: RequestMethod.ALL });

    // CSRF protection for state-changing endpoints
    consumer.apply(CsrfMiddleware).forRoutes({ path: '*', method: RequestMethod.ALL });

    // Cache-Control headers based on route pattern matching (cache-policy.ts)
    consumer.apply(CacheControlMiddleware).forRoutes({ path: '*', method: RequestMethod.ALL });

    // Compression — gzip, brotli, deflate for text responses.
    // Applied last in the middleware chain so it compresses the final response.
    // Note: In production behind nginx, nginx handles compression. This middleware
    // serves as a fallback for direct NestJS access (dev, health checks, etc.)
    consumer.apply(CompressionMiddleware).forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
