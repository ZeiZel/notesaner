import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { ValkeyService } from '../../valkey/valkey.service';
import { CreateUserApiKeyDto, UserApiKeyScope } from './dto/create-api-key.dto';
import type {
  CreatedApiKeyResponseDto,
  RotatedApiKeyResponseDto,
  UserApiKeyResponseDto,
} from './dto/list-api-keys.dto';

// ─── Constants ─────────────────────────────────────────────────────────────────

/** Key format prefix. Makes keys identifiable in logs and secret scanners. */
const KEY_PREFIX = 'nts_';

/** Length of the random portion of the key (40 characters). */
const KEY_RANDOM_LENGTH = 40;

/** Number of characters from the full key stored as the display prefix. */
const DISPLAY_PREFIX_LENGTH = 8;

/** Maximum number of active (non-revoked) API keys per user. */
const MAX_KEYS_PER_USER = 10;

/** ValKey key prefix for per-key rate limiting. */
const RATE_LIMIT_KEY_PREFIX = 'rate:apikey:';

/** Default rate limit: 120 requests per minute per API key. */
const RATE_LIMIT_PER_KEY = 120;

/** Rate limit window: 60 seconds. */
const RATE_LIMIT_WINDOW_S = 60;

// ─── Interfaces ────────────────────────────────────────────────────────────────

export interface ValidatedUserApiKey {
  id: string;
  userId: string;
  scopes: UserApiKeyScope[];
}

// ─── Service ───────────────────────────────────────────────────────────────────

/**
 * UserApiKeyService -- manages user-scoped API keys for programmatic access.
 *
 * Key design decisions:
 * - Keys are user-scoped (not workspace-scoped). Workspace access is derived
 *   from the user's workspace memberships, the same as JWT auth.
 * - Only the SHA-256 hash of the key is stored. The raw key is returned
 *   exactly once at creation time.
 * - Key format: `nts_<40 random chars>` (48 chars total).
 * - The `prefix` field stores the first 8 chars for user-friendly identification
 *   in the UI (e.g., "nts_a1b2...").
 * - Per-key rate limiting is enforced via ValKey counters.
 * - requestCount is incremented atomically on every successful validation.
 * - Key rotation creates a new key with the same name/scopes and revokes the
 *   old one in a single DB transaction. The old key's rotatedToId links to the
 *   new key for audit trail purposes.
 */
@Injectable()
export class UserApiKeyService {
  private readonly logger = new Logger(UserApiKeyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly valkey: ValkeyService,
  ) {}

  // ── CRUD ────────────────────────────────────────────────────────────────────

  /**
   * Generate and persist a new API key for the authenticated user.
   *
   * The raw key is returned in the response -- this is the ONLY time it is
   * exposed. The caller must present it to the end user immediately.
   */
  async create(userId: string, dto: CreateUserApiKeyDto): Promise<CreatedApiKeyResponseDto> {
    // Enforce per-user key limit
    const activeCount = await this.prisma.apiKey.count({
      where: { userId, revokedAt: null },
    });

    if (activeCount >= MAX_KEYS_PER_USER) {
      throw new BadRequestException(
        `Maximum of ${MAX_KEYS_PER_USER} active API keys per user reached. Revoke an existing key first.`,
      );
    }

    // Validate expiration date if provided
    let expiresAt: Date | null = null;
    if (dto.expiresAt) {
      expiresAt = new Date(dto.expiresAt);
      if (expiresAt <= new Date()) {
        throw new BadRequestException('expiresAt must be a future date');
      }
    }

    // Generate a cryptographically secure random key
    const rawKey =
      KEY_PREFIX +
      randomBytes(KEY_RANDOM_LENGTH).toString('base64url').substring(0, KEY_RANDOM_LENGTH);
    const keyHash = UserApiKeyService.hashKey(rawKey);
    const prefix = rawKey.substring(0, DISPLAY_PREFIX_LENGTH);
    const scopes = dto.scopes ?? [UserApiKeyScope.READ];

    // Map DTO scope strings to Prisma enum values
    const prismaScopes = scopes.map((s) => this.toPrismaScope(s));

    const record = await this.prisma.apiKey.create({
      data: {
        userId,
        name: dto.name,
        keyHash,
        prefix,
        scopes: prismaScopes,
        expiresAt,
      },
    });

    this.logger.log(`API key "${dto.name}" (${prefix}...) created for userId=${userId}`);

    return {
      id: record.id,
      name: record.name,
      prefix: record.prefix,
      scopes: record.scopes.map((s) => this.fromPrismaScope(s)),
      expiresAt: record.expiresAt?.toISOString() ?? null,
      lastUsedAt: null,
      requestCount: 0,
      createdAt: record.createdAt.toISOString(),
      key: rawKey,
    };
  }

  /**
   * List all non-revoked API keys for a user.
   * Raw keys are never returned in list results.
   */
  async list(userId: string): Promise<UserApiKeyResponseDto[]> {
    const records = await this.prisma.apiKey.findMany({
      where: { userId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        prefix: true,
        scopes: true,
        expiresAt: true,
        lastUsedAt: true,
        requestCount: true,
        createdAt: true,
      },
    });

    return records.map((r) => this.toResponseDto(r));
  }

  /**
   * Retrieve a single API key by ID.
   * The key must belong to the authenticated user and must not be revoked.
   * Raw key is never returned.
   *
   * @throws NotFoundException when the key does not exist or is revoked.
   */
  async getById(userId: string, apiKeyId: string): Promise<UserApiKeyResponseDto> {
    const record = await this.prisma.apiKey.findFirst({
      where: { id: apiKeyId, userId, revokedAt: null },
      select: {
        id: true,
        name: true,
        prefix: true,
        scopes: true,
        expiresAt: true,
        lastUsedAt: true,
        requestCount: true,
        createdAt: true,
      },
    });

    if (!record) {
      throw new NotFoundException('API key not found or already revoked');
    }

    return this.toResponseDto(record);
  }

  /**
   * Revoke (soft-delete) an API key by ID.
   * The key must belong to the authenticated user.
   */
  async revoke(userId: string, apiKeyId: string): Promise<void> {
    const key = await this.prisma.apiKey.findFirst({
      where: { id: apiKeyId, userId, revokedAt: null },
      select: { id: true },
    });

    if (!key) {
      throw new NotFoundException('API key not found or already revoked');
    }

    await this.prisma.apiKey.update({
      where: { id: apiKeyId },
      data: { revokedAt: new Date() },
    });

    this.logger.log(`API key ${apiKeyId} revoked by userId=${userId}`);
  }

  /**
   * Rotate an API key: generate a new replacement key with the same name and
   * scopes as the old key, then immediately revoke the old key in a transaction.
   *
   * The old key's `rotatedToId` is set to the new key's ID, creating an audit
   * trail linking old and new keys.
   *
   * The new key does NOT inherit expiresAt -- it starts with no expiry so the
   * caller can explicitly set one if needed.
   *
   * The new key's raw value is returned exactly once -- the caller must store it.
   *
   * @throws NotFoundException when the key does not exist or belongs to another user.
   */
  async rotate(userId: string, apiKeyId: string): Promise<RotatedApiKeyResponseDto> {
    // Fetch the key to be rotated (must belong to the user and not already be revoked)
    const oldKey = await this.prisma.apiKey.findFirst({
      where: { id: apiKeyId, userId, revokedAt: null },
      select: {
        id: true,
        name: true,
        scopes: true,
      },
    });

    if (!oldKey) {
      throw new NotFoundException('API key not found or already revoked');
    }

    const rawKey =
      KEY_PREFIX +
      randomBytes(KEY_RANDOM_LENGTH).toString('base64url').substring(0, KEY_RANDOM_LENGTH);
    const keyHash = UserApiKeyService.hashKey(rawKey);
    const prefix = rawKey.substring(0, DISPLAY_PREFIX_LENGTH);
    const now = new Date();

    // Use a transaction: atomically create the new key and revoke the old one.
    const { newRecord } = await this.prisma.$transaction(async (tx) => {
      const created = await tx.apiKey.create({
        data: {
          userId,
          name: oldKey.name,
          keyHash,
          prefix,
          scopes: oldKey.scopes,
          // Intentionally omit expiresAt -- new key starts without an expiry date.
        },
      });

      await tx.apiKey.update({
        where: { id: oldKey.id },
        data: {
          revokedAt: now,
          rotatedToId: created.id,
        },
      });

      return { newRecord: created };
    });

    this.logger.log(`API key ${oldKey.id} rotated to ${newRecord.id} for userId=${userId}`);

    return {
      revokedKeyId: oldKey.id,
      newKey: {
        id: newRecord.id,
        name: newRecord.name,
        prefix: newRecord.prefix,
        scopes: newRecord.scopes.map((s) => this.fromPrismaScope(s)),
        expiresAt: newRecord.expiresAt?.toISOString() ?? null,
        lastUsedAt: null,
        requestCount: 0,
        createdAt: newRecord.createdAt.toISOString(),
        key: rawKey,
      },
    };
  }

  // ── Validation ──────────────────────────────────────────────────────────────

  /**
   * Validate an incoming API key from the `X-API-Key` header.
   *
   * Performs lookup by SHA-256 digest. Updates `lastUsedAt` and increments
   * `requestCount` asynchronously (fire-and-forget) to avoid adding latency
   * to every request. requestCount uses a Prisma atomic increment to prevent
   * lost updates under concurrent requests.
   *
   * @throws UnauthorizedException when key is missing, invalid, expired, or revoked.
   */
  async validate(rawKey: string): Promise<ValidatedUserApiKey> {
    if (!rawKey || !rawKey.startsWith(KEY_PREFIX)) {
      throw new UnauthorizedException('Invalid API key format');
    }

    const keyHash = UserApiKeyService.hashKey(rawKey);

    const record = await this.prisma.apiKey.findUnique({
      where: { keyHash },
      select: {
        id: true,
        userId: true,
        scopes: true,
        expiresAt: true,
        revokedAt: true,
      },
    });

    if (!record || record.revokedAt !== null) {
      throw new UnauthorizedException('Invalid or revoked API key');
    }

    if (record.expiresAt && record.expiresAt < new Date()) {
      throw new UnauthorizedException('API key has expired');
    }

    // Fire-and-forget: update lastUsedAt and increment requestCount atomically.
    this.prisma.apiKey
      .update({
        where: { id: record.id },
        data: {
          lastUsedAt: new Date(),
          requestCount: { increment: 1 },
        },
      })
      .catch((err: unknown) =>
        this.logger.warn(`Failed to update usage stats for API key ${record.id}: ${String(err)}`),
      );

    return {
      id: record.id,
      userId: record.userId,
      scopes: record.scopes.map((s) => this.fromPrismaScope(s)),
    };
  }

  /**
   * Assert that a validated API key includes the required scope.
   * @throws ForbiddenException when the scope is absent.
   */
  assertScope(apiKey: ValidatedUserApiKey, requiredScope: UserApiKeyScope): void {
    // ADMIN scope implies all other scopes
    if (apiKey.scopes.includes(UserApiKeyScope.ADMIN)) {
      return;
    }

    // WRITE scope implies READ
    if (requiredScope === UserApiKeyScope.READ && apiKey.scopes.includes(UserApiKeyScope.WRITE)) {
      return;
    }

    if (!apiKey.scopes.includes(requiredScope)) {
      throw new ForbiddenException(`API key does not have the required scope: ${requiredScope}`);
    }
  }

  // ── Rate Limiting ──────────────────────────────────────────────────────────

  /**
   * Check and increment the rate limit counter for a specific API key.
   * Returns true if the request is allowed, false if rate limited.
   */
  async checkRateLimit(apiKeyId: string): Promise<boolean> {
    const key = `${RATE_LIMIT_KEY_PREFIX}${apiKeyId}`;

    try {
      const client = this.valkey.getClient();
      const current = await client.incr(key);

      // Set expiry on first increment
      if (current === 1) {
        await client.expire(key, RATE_LIMIT_WINDOW_S);
      }

      return current <= RATE_LIMIT_PER_KEY;
    } catch (error) {
      // Fail open: if ValKey is unavailable, allow the request
      this.logger.error('API key rate limit check failed', error);
      return true;
    }
  }

  // ── Static Helpers ─────────────────────────────────────────────────────────

  /** SHA-256 hex digest of a raw API key string. */
  static hashKey(rawKey: string): string {
    return createHash('sha256').update(rawKey).digest('hex');
  }

  // ── Private Helpers ────────────────────────────────────────────────────────

  /**
   * Map a Prisma ApiKey select result to a UserApiKeyResponseDto.
   * Centralises the mapping logic to avoid duplication across list/getById.
   */
  private toResponseDto(r: {
    id: string;
    name: string;
    prefix: string;
    scopes: string[];
    expiresAt: Date | null;
    lastUsedAt: Date | null;
    requestCount: number;
    createdAt: Date;
  }): UserApiKeyResponseDto {
    return {
      id: r.id,
      name: r.name,
      prefix: r.prefix,
      scopes: r.scopes.map((s) => this.fromPrismaScope(s)),
      expiresAt: r.expiresAt?.toISOString() ?? null,
      lastUsedAt: r.lastUsedAt?.toISOString() ?? null,
      requestCount: r.requestCount,
      createdAt: r.createdAt.toISOString(),
    };
  }

  /**
   * Map a DTO scope string to the Prisma ApiKeyScope enum value.
   * Prisma generates the enum with uppercase values (READ, WRITE, ADMIN).
   */
  private toPrismaScope(scope: UserApiKeyScope): 'READ' | 'WRITE' | 'ADMIN' {
    switch (scope) {
      case UserApiKeyScope.READ:
        return 'READ';
      case UserApiKeyScope.WRITE:
        return 'WRITE';
      case UserApiKeyScope.ADMIN:
        return 'ADMIN';
    }
  }

  /**
   * Map a Prisma ApiKeyScope enum value back to the DTO scope string.
   */
  private fromPrismaScope(scope: string): UserApiKeyScope {
    switch (scope) {
      case 'READ':
        return UserApiKeyScope.READ;
      case 'WRITE':
        return UserApiKeyScope.WRITE;
      case 'ADMIN':
        return UserApiKeyScope.ADMIN;
      default:
        return UserApiKeyScope.READ;
    }
  }
}
