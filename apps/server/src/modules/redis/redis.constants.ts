/**
 * Injection token for the raw ioredis client.
 * Use this to inject the Redis connection into services.
 *
 * @example
 * constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}
 */
export const REDIS_CLIENT = 'REDIS_CLIENT' as const;

/**
 * Injection token for BullMQ connection options.
 * Shared across all queues so they reuse a single ioredis connection.
 *
 * @example
 * BullModule.registerQueue({ name: 'my-queue', connection: bullmqConnection })
 */
export const BULLMQ_CONNECTION = 'BULLMQ_CONNECTION' as const;
