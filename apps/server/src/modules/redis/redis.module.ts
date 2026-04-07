import { Global, Module, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { BullModule } from '@nestjs/bullmq';
import Redis from 'ioredis';
import { RedisService } from './redis.service';
import { REDIS_CLIENT, BULLMQ_CONNECTION } from './redis.constants';

const logger = new Logger('RedisModule');

/**
 * Factory that builds a connected ioredis client from REDIS_URL.
 * The connection is lazy — ioredis will automatically reconnect on failure.
 */
const redisClientFactory = {
  provide: REDIS_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService): Redis => {
    const url = config.get<string>('redis.url', 'redis://localhost:6379');

    const client = new Redis(url, {
      // Retry with exponential back-off, capped at 10 s
      retryStrategy: (times: number) => Math.min(times * 200, 10_000),
      maxRetriesPerRequest: null, // required by BullMQ when sharing the client
      enableReadyCheck: false, // required by BullMQ when sharing the client
      lazyConnect: false,
    });

    client.on('connect', () => logger.log(`Redis connected (${url})`));
    client.on('ready', () => logger.log('Redis ready'));
    client.on('error', (err: Error) => logger.error('Redis error', err.message));
    client.on('close', () => logger.warn('Redis connection closed'));
    client.on('reconnecting', () => logger.warn('Redis reconnecting...'));

    return client;
  },
};

/**
 * Provider that surfaces BullMQ-compatible connection options.
 * BullMQ requires maxRetriesPerRequest=null and enableReadyCheck=false.
 * We expose the raw ioredis instance, which already has those options set.
 */
const bullmqConnectionFactory = {
  provide: BULLMQ_CONNECTION,
  inject: [REDIS_CLIENT],
  useFactory: (client: Redis) => client,
};

/**
 * RedisModule — global NestJS module providing:
 *   - REDIS_CLIENT     (ioredis Redis instance)
 *   - BULLMQ_CONNECTION (ioredis instance pre-configured for BullMQ)
 *   - RedisService      (high-level helper methods + health check)
 *   - CacheModule       (NestJS cache with in-memory store by default;
 *                        swap to @keyv/redis when that package is added)
 *   - BullModule        (shared connection for all queues)
 *
 * Mark @Global() so every module can inject RedisService / REDIS_CLIENT
 * without importing RedisModule individually.
 */
@Global()
@Module({
  imports: [
    ConfigModule,

    /**
     * CacheModule uses the default in-memory Keyv store.
     *
     * To back the cache with Redis once @keyv/redis is installed, replace this
     * with CacheModule.registerAsync and add:
     *
     *   import { Keyv } from 'keyv';
     *   import KeyvRedis from '@keyv/redis';
     *   stores: [new Keyv({ store: new KeyvRedis(config.get('redis.url')) })]
     */
    CacheModule.register({
      isGlobal: true,
      ttl: 60_000, // default TTL: 60 seconds (in milliseconds for cache-manager v7)
    }),

    /**
     * BullModule shared connection.
     * Individual queues register via BullModule.registerQueueAsync()
     * using the BULLMQ_CONNECTION token so they all share one ioredis socket.
     */
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('redis.url', 'redis://localhost:6379');
        // Parse the REDIS_URL into connection options that BullMQ accepts.
        // BullMQ accepts either a connection string or an object; use object
        // form so we can set the BullMQ-required flags explicitly.
        const parsed = new URL(url);
        return {
          connection: {
            host: parsed.hostname,
            port: Number(parsed.port) || 6379,
            password: parsed.password || undefined,
            db: Number(parsed.pathname?.slice(1)) || 0,
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
          },
        };
      },
    }),
  ],
  providers: [redisClientFactory, bullmqConnectionFactory, RedisService],
  exports: [REDIS_CLIENT, BULLMQ_CONNECTION, RedisService, CacheModule, BullModule],
})
export class RedisModule {}
