/**
 * Runtime environment configuration.
 *
 * Validates and exports environment variables with proper types.
 * Uses a lightweight validation approach without adding a Zod dependency
 * to this module (Zod is used at API boundaries in the server layer).
 *
 * All NEXT_PUBLIC_* variables are available on the client.
 * Non-prefixed variables are server-only.
 */

function requireEnv(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optionalEnv(key: string, fallback = ''): string {
  return process.env[key] ?? fallback;
}

/**
 * Client-safe environment variables (NEXT_PUBLIC_*).
 * These are inlined at build time by Next.js.
 */
export const clientEnv = {
  appUrl: optionalEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000'),
  apiUrl: optionalEnv('NEXT_PUBLIC_API_URL', 'http://localhost:3001'),
  wsUrl: optionalEnv('NEXT_PUBLIC_WS_URL', 'ws://localhost:3001'),
  appEnv: optionalEnv('NEXT_PUBLIC_APP_ENV', 'development'),
} as const;

/**
 * Server-only environment variables.
 * Never accessed from Client Components.
 */
export function getServerEnv() {
  return {
    nodeEnv: requireEnv('NODE_ENV', 'development'),
    databaseUrl: optionalEnv('DATABASE_URL'),
    jwtSecret: optionalEnv('JWT_SECRET'),
    nextAuthSecret: optionalEnv('NEXTAUTH_SECRET'),
  } as const;
}

export const isDevelopment = clientEnv.appEnv === 'development';
export const isProduction = clientEnv.appEnv === 'production';
