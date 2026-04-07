import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

/**
 * Creates a new PrismaClient instance with the PostgreSQL driver adapter.
 *
 * Prisma 7+ requires a driver adapter for database connections.
 * This factory ensures all PrismaClient instances are properly configured.
 *
 * @param connectionString - Optional DATABASE_URL override. Defaults to process.env.DATABASE_URL.
 */
export function createPrismaClient(connectionString?: string): PrismaClient {
  const pool = new pg.Pool({
    connectionString: connectionString ?? process.env.DATABASE_URL,
  });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({ adapter });
}
