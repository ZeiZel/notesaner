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
  TOTP_APP_NAME: z.string().default('Notesaner'),

  // Logging
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  // GitHub
  GITHUB_TOKEN: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateConfig(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const errors = result.error.errors
      .map((e) => `  - ${e.path.join('.')}: ${e.message}`)
      .join('\n');

    throw new Error(`Configuration validation failed:\n${errors}`);
  }

  return result.data;
}
