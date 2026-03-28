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
import type { UserApiKeyResponseDto, CreatedApiKeyResponseDto } from './dto/list-api-keys.dto';

// ─── Constants ─────────────────────────────────────────────────────────────────

/** Key format prefix. Makes keys identifiable in logs and secret scanners. */
const KEY_PREFIX = 'nts_';

/** Length of the random portion of the key (40 characters). */
const KEY_RANDOM_LENGTH = 40;

/** Number of characters from the full key stored as the display prefix. */
const DISPLAY_PREFIX_LENGTH = 8;

/** Maximum number of active (non-revoked) API keys per user. */
const MAX_KEYS_PER_USER = 25;

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
        createdAt: true,
      },
    });

    return records.map((r) => ({
      id: r.id,
      name: r.name,
      prefix: r.prefix,
      scopes: r.scopes.map((s) => this.fromPrismaScope(s)),
      expiresAt: r.expiresAt?.toISOString() ?? null,
      lastUsedAt: r.lastUsedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
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

  // ── Validation ──────────────────────────────────────────────────────────────

  /**
   * Validate an incoming API key from the `X-API-Key` header.
   *
   * Performs lookup by SHA-256 digest. Updates `lastUsedAt` asynchronously
   * (fire-and-forget) to avoid adding latency to every request.
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

    // Fire-and-forget lastUsedAt update
    this.prisma.apiKey
      .update({
        where: { id: record.id },
        data: { lastUsedAt: new Date() },
      })
      .catch((err: unknown) =>
        this.logger.warn(`Failed to update lastUsedAt for API key ${record.id}: ${String(err)}`),
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
