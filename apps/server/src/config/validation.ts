import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  // Database
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid connection string'),

  // Redis / ValKey
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().int().min(0).default(0),

  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_ACCESS_TOKEN_TTL: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TOKEN_TTL: z.coerce.number().int().positive().default(2592000),

  // CORS
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),

  // Storage
  STORAGE_ROOT: z.string().default('/var/lib/notesaner/workspaces'),

  // Auth
  ALLOW_REGISTRATION: z.string().default('true'),
  REQUIRE_EMAIL_VERIFICATION: z.string().default('true'),
  TOTP_APP_NAME: z.string().default('Notesaner'),

  // Frontend URL (for email links)
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),

  // Logging
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  // GitHub
  GITHUB_TOKEN: z.string().optional(),

  // ── Embedding / Semantic Search ────────────────────────────────────────────
  EMBEDDING_PROVIDER: z.enum(['openai']).default('openai'),
  EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
  OPENAI_API_KEY: z.string().optional(),

  // OpenTelemetry
  OTEL_ENABLED: z.enum(['true', 'false']).default('true'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().default('http://localhost:4318'),
  OTEL_SERVICE_NAME: z.string().default('notesaner-server'),

  // ── Rate Limiting ──────────────────────────────────────────────────────────
  RATE_LIMIT_GLOBAL: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_GLOBAL_TTL: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_AUTH: z.coerce.number().int().positive().default(5),
  RATE_LIMIT_AUTH_TTL: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_SEARCH: z.coerce.number().int().positive().default(30),
  RATE_LIMIT_SEARCH_TTL: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_UPLOAD: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_UPLOAD_TTL: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_WS_MAX_CONNECTIONS: z.coerce.number().int().positive().default(5),
  ACCOUNT_LOCKOUT_MAX_ATTEMPTS: z.coerce.number().int().positive().default(10),
  ACCOUNT_LOCKOUT_DURATION: z.coerce.number().int().positive().default(1800),
  ACCOUNT_LOCKOUT_WINDOW: z.coerce.number().int().positive().default(3600),

  // ── Security Headers ───────────────────────────────────────────────────────
  SECURITY_CSP: z.string().default(''),
  SECURITY_CSP_REPORT_ONLY: z.string().default('false'),
  SECURITY_HSTS_MAX_AGE: z.coerce.number().int().min(0).default(31536000),
  SECURITY_PERMISSIONS_POLICY: z.string().default(''),
  SECURITY_CSRF_ENABLED: z.string().default('true'),
  SECURITY_CSRF_COOKIE_NAME: z.string().default('_csrf'),
  SECURITY_CSRF_HEADER_NAME: z.string().default('x-csrf-token'),

  // ValKey URL
  VALKEY_URL: z.string().optional(),

  // ── Backup & Disaster Recovery ────────────────────────────────────────────
  BACKUP_ENABLED: z.enum(['true', 'false']).default('false'),
  BACKUP_LOCAL_PATH: z.string().default('/var/lib/notesaner/backups'),
  BACKUP_ENCRYPTION_KEY: z
    .string()
    .default('')
    .refine(
      (val) => val === '' || /^[0-9a-fA-F]{64}$/.test(val),
      'BACKUP_ENCRYPTION_KEY must be a 64-character hex string (256-bit key)',
    ),
  BACKUP_ALERT_EMAIL: z.string().email().optional().or(z.literal('')),
  BACKUP_PG_DUMP_PATH: z.string().default('pg_dump'),
  BACKUP_RETENTION_DAILY: z.coerce.number().int().positive().default(7),
  BACKUP_RETENTION_WEEKLY: z.coerce.number().int().positive().default(4),
  BACKUP_RETENTION_MONTHLY: z.coerce.number().int().positive().default(3),

  // ── Storage Quota ──────────────────────────────────────────────────────────
  QUOTA_MAX_STORAGE_BYTES: z.coerce
    .bigint()
    .positive()
    .default(BigInt(5 * 1024 * 1024 * 1024)),
  QUOTA_MAX_NOTES: z.coerce.number().int().positive().default(50000),
  QUOTA_MAX_FILE_SIZE_BYTES: z.coerce
    .bigint()
    .positive()
    .default(BigInt(50 * 1024 * 1024)),
  QUOTA_WARNING_THRESHOLD_PERCENT: z.coerce.number().int().min(1).max(100).default(80),

  // ── Upload ────────────────────────────────────────────────────────────────
  UPLOAD_MAX_FILE_SIZE_MB: z.coerce.number().int().positive().default(50),

  // S3-compatible storage (optional — omit all to use local-only)
  BACKUP_S3_ENDPOINT: z.string().url().optional().or(z.literal('')),
  BACKUP_S3_REGION: z.string().default('us-east-1'),
  BACKUP_S3_BUCKET: z.string().optional().or(z.literal('')),
  BACKUP_S3_ACCESS_KEY_ID: z.string().optional().or(z.literal('')),
  BACKUP_S3_SECRET_ACCESS_KEY: z.string().optional().or(z.literal('')),
  BACKUP_S3_PREFIX: z.string().default('backups'),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateConfig(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const errors = result.error.issues
      .map(
        (e: { path: PropertyKey[]; message: string }) =>
          `  - ${String(e.path.join('.'))}: ${e.message}`,
      )
      .join('\n');

    throw new Error(`Configuration validation failed:\n${errors}`);
  }

  return result.data;
}
