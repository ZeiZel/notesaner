/**
 * Injection token for the raw ioredis client.
 * Use this to inject the Redis/ValKey connection into services.
 *
 * @example
 * constructor(@Inject(VALKEY_CLIENT) private readonly redis: Redis) {}
 */
export const VALKEY_CLIENT = 'VALKEY_CLIENT' as const;

/**
 * Injection token for BullMQ connection options.
 * Shared across all queues so they reuse a single ioredis connection.
 *
 * @example
 * BullModule.registerQueue({ name: 'my-queue', connection: bullmqConnection })
 */
export const BULLMQ_CONNECTION = 'BULLMQ_CONNECTION' as const;
