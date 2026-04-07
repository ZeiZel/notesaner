import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ServiceHealth } from '../health.types';

@Injectable()
export class DatabaseHealthIndicator {
  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      // Use $queryRawUnsafe with a simple SELECT to verify DB connectivity.
      // This is safe because the query is a hardcoded constant, not user input.
      await this.prisma.$queryRawUnsafe('SELECT 1');
      return { status: 'alive', latency_ms: Date.now() - start };
    } catch (error) {
      return {
        status: 'error',
        latency_ms: Date.now() - start,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
