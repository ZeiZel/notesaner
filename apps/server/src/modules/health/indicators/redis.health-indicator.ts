import { Injectable } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { ServiceHealth } from '../health.types';

@Injectable()
export class RedisHealthIndicator {
  constructor(private readonly redisService: RedisService) {}

  async check(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      const ok = await this.redisService.ping();
      const latency_ms = Date.now() - start;
      return ok
        ? { status: 'alive', latency_ms }
        : { status: 'pending', latency_ms, error: 'PONG not received' };
    } catch (error) {
      return {
        status: 'error',
        latency_ms: Date.now() - start,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
