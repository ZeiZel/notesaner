export const configuration = () => ({
  port: parseInt(process.env['PORT'] ?? '4000', 10),
  nodeEnv: process.env['NODE_ENV'] ?? 'development',

  database: {
    url: process.env['DATABASE_URL'],
  },

  redis: {
    host: process.env['REDIS_HOST'] ?? 'localhost',
    port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
    password: process.env['REDIS_PASSWORD'] ?? undefined,
    db: parseInt(process.env['REDIS_DB'] ?? '0', 10),
  },

  jwt: {
    secret: process.env['JWT_SECRET'],
    accessTokenTtl: parseInt(process.env['JWT_ACCESS_TOKEN_TTL'] ?? '900', 10),
    refreshTokenTtl: parseInt(process.env['JWT_REFRESH_TOKEN_TTL'] ?? '2592000', 10),
  },

  cors: {
    allowedOrigins: (process.env['ALLOWED_ORIGINS'] ?? 'http://localhost:3000').split(','),
  },

  storage: {
    root: process.env['STORAGE_ROOT'] ?? '/var/lib/notesaner/workspaces',
  },

  auth: {
    allowRegistration: process.env['ALLOW_REGISTRATION'] !== 'false',
    requireEmailVerification: process.env['REQUIRE_EMAIL_VERIFICATION'] !== 'false',
    totpAppName: process.env['TOTP_APP_NAME'] ?? 'Notesaner',
  },

  frontendUrl: process.env['FRONTEND_URL'] ?? 'http://localhost:3000',

  // ── Storage Quota ─────────────────────────────────────────────────────────
  quota: {
    maxStorageBytes: BigInt(
      process.env['QUOTA_MAX_STORAGE_BYTES'] ?? String(5 * 1024 * 1024 * 1024),
    ), // 5 GB
    maxNotes: parseInt(process.env['QUOTA_MAX_NOTES'] ?? '50000', 10),
    maxFileSizeBytes: BigInt(process.env['QUOTA_MAX_FILE_SIZE_BYTES'] ?? String(50 * 1024 * 1024)), // 50 MB
    warningThresholdPercent: parseInt(process.env['QUOTA_WARNING_THRESHOLD_PERCENT'] ?? '80', 10),
  },

  upload: {
    maxFileSizeMb: parseInt(process.env['UPLOAD_MAX_FILE_SIZE_MB'] ?? '50', 10),
  },

  logging: {
    level: process.env['LOG_LEVEL'] ?? 'info',
  },

  github: {
    token: process.env['GITHUB_TOKEN'] ?? undefined,
  },

  // ── Embedding / Semantic Search ────────────────────────────────────────────
  embedding: {
    provider: process.env['EMBEDDING_PROVIDER'] ?? 'openai',
    model: process.env['EMBEDDING_MODEL'] ?? 'text-embedding-3-small',
    openaiApiKey: process.env['OPENAI_API_KEY'] ?? undefined,
  },

  // ── Rate Limiting ──────────────────────────────────────────────────────────
  rateLimit: {
    global: {
      limit: parseInt(process.env['RATE_LIMIT_GLOBAL'] ?? '100', 10),
      ttlSeconds: parseInt(process.env['RATE_LIMIT_GLOBAL_TTL'] ?? '60', 10),
    },
    auth: {
      limit: parseInt(process.env['RATE_LIMIT_AUTH'] ?? '5', 10),
      ttlSeconds: parseInt(process.env['RATE_LIMIT_AUTH_TTL'] ?? '60', 10),
    },
    search: {
      limit: parseInt(process.env['RATE_LIMIT_SEARCH'] ?? '30', 10),
      ttlSeconds: parseInt(process.env['RATE_LIMIT_SEARCH_TTL'] ?? '60', 10),
    },
    upload: {
      limit: parseInt(process.env['RATE_LIMIT_UPLOAD'] ?? '10', 10),
      ttlSeconds: parseInt(process.env['RATE_LIMIT_UPLOAD_TTL'] ?? '60', 10),
    },
    wsMaxConnections: parseInt(process.env['RATE_LIMIT_WS_MAX_CONNECTIONS'] ?? '5', 10),
    accountLockout: {
      maxAttempts: parseInt(process.env['ACCOUNT_LOCKOUT_MAX_ATTEMPTS'] ?? '10', 10),
      lockoutDurationSeconds: parseInt(process.env['ACCOUNT_LOCKOUT_DURATION'] ?? '1800', 10),
      windowSeconds: parseInt(process.env['ACCOUNT_LOCKOUT_WINDOW'] ?? '3600', 10),
    },
  },

  // ── Security Headers ───────────────────────────────────────────────────────
  security: {
    csp: process.env['SECURITY_CSP'] ?? '',
    cspReportOnly: process.env['SECURITY_CSP_REPORT_ONLY'] === 'true',
    hstsMaxAge: parseInt(process.env['SECURITY_HSTS_MAX_AGE'] ?? '31536000', 10),
    permissionsPolicy: process.env['SECURITY_PERMISSIONS_POLICY'] ?? '',
    csrfEnabled: process.env['SECURITY_CSRF_ENABLED'] !== 'false',
    csrfCookieName: process.env['SECURITY_CSRF_COOKIE_NAME'] ?? '_csrf',
    csrfHeaderName: process.env['SECURITY_CSRF_HEADER_NAME'] ?? 'x-csrf-token',
  },

  valkey: {
    url:
      process.env['VALKEY_URL'] ??
      `redis://${process.env['REDIS_HOST'] ?? 'localhost'}:${process.env['REDIS_PORT'] ?? '6379'}/${process.env['REDIS_DB'] ?? '0'}`,
  },

  // ── Backup & Disaster Recovery ────────────────────────────────────────────
  backup: {
    enabled: process.env['BACKUP_ENABLED'] === 'true',
    localPath: process.env['BACKUP_LOCAL_PATH'] ?? '/var/lib/notesaner/backups',
    encryptionKey: process.env['BACKUP_ENCRYPTION_KEY'] ?? '',
    alertEmail: process.env['BACKUP_ALERT_EMAIL'] ?? undefined,
    pgDumpPath: process.env['BACKUP_PG_DUMP_PATH'] ?? 'pg_dump',
    retention: {
      dailyCount: parseInt(process.env['BACKUP_RETENTION_DAILY'] ?? '7', 10),
      weeklyCount: parseInt(process.env['BACKUP_RETENTION_WEEKLY'] ?? '4', 10),
      monthlyCount: parseInt(process.env['BACKUP_RETENTION_MONTHLY'] ?? '3', 10),
    },
    s3: {
      endpoint: process.env['BACKUP_S3_ENDPOINT'] ?? undefined,
      region: process.env['BACKUP_S3_REGION'] ?? 'us-east-1',
      bucket: process.env['BACKUP_S3_BUCKET'] ?? undefined,
      accessKeyId: process.env['BACKUP_S3_ACCESS_KEY_ID'] ?? undefined,
      secretAccessKey: process.env['BACKUP_S3_SECRET_ACCESS_KEY'] ?? undefined,
      prefix: process.env['BACKUP_S3_PREFIX'] ?? 'backups',
    },
  },
});

export type AppConfiguration = ReturnType<typeof configuration>;
