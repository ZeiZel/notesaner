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
    totpAppName: process.env['TOTP_APP_NAME'] ?? 'Notesaner',
  },

  logging: {
    level: process.env['LOG_LEVEL'] ?? 'info',
  },

  github: {
    token: process.env['GITHUB_TOKEN'] ?? undefined,
  },
});

export type AppConfiguration = ReturnType<typeof configuration>;
