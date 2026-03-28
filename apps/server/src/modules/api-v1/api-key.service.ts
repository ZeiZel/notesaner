import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiKeyPermission, CreateApiKeyDto } from './dto/create-api-key.dto';

// ─── Shapes ───────────────────────────────────────────────────────────────────

export interface ApiKeyDto {
  id: string;
  name: string;
  workspaceId: string;
  userId: string;
  permissions: ApiKeyPermission[];
  lastUsedAt: string | null;
  createdAt: string;
  /** Raw key — only present on creation, never stored or returned again. */
  key?: string;
}

export interface ValidatedApiKey {
  id: string;
  workspaceId: string;
  userId: string;
  permissions: ApiKeyPermission[];
}

// ─── Raw DB row shape ─────────────────────────────────────────────────────────

interface ApiKeyRow {
  id: string;
  name: string;
  workspace_id: string;
  user_id: string;
  permissions: string[];
  last_used_at: Date | null;
  created_at: Date;
  is_revoked: boolean;
  key_hash: string;
}

/**
 * ApiKeyService — manages creation, validation, and revocation of API keys.
 *
 * Storage model:
 *   - The raw key is shown to the user exactly once at creation time.
 *   - Only a SHA-256 digest of the key is persisted in the `api_keys` table.
 *   - Lookup by incoming X-API-Key header: hash the header value, query by digest.
 *
 * Key format: `nsk_<32 random bytes as hex>` — 68 characters total.
 * The `nsk_` prefix ("Notesaner Secret Key") makes keys identifiable in logs.
 *
 * Database: uses raw SQL since api_keys is a migration-only table not modelled
 * in schema.prisma (respecting the "do not modify prisma schema" constraint).
 */
@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);

  /** Prefix for all generated API keys. Makes them recognisable in logs/dumps. */
  static readonly KEY_PREFIX = 'nsk_';

  constructor(private readonly prisma: PrismaService) {}

  // ── CRUD ────────────────────────────────────────────────────────────────────

  /**
   * Generate and persist a new API key for the given workspace member.
   *
   * The raw key is returned in the `key` field of the response — this is the
   * ONLY time the key is exposed. The caller must present it to the user
   * immediately; it cannot be recovered later.
   */
  async create(
    workspaceId: string,
    userId: string,
    dto: CreateApiKeyDto,
  ): Promise<ApiKeyDto & { key: string }> {
    const rawKey = ApiKeyService.KEY_PREFIX + randomBytes(32).toString('hex');
    const keyHash = ApiKeyService.hashKey(rawKey);
    const permissions: ApiKeyPermission[] = dto.permissions ?? [
      ApiKeyPermission.NOTES_READ,
      ApiKeyPermission.NOTES_WRITE,
      ApiKeyPermission.NOTES_DELETE,
    ];

    const rows = await this.prisma.$queryRaw<ApiKeyRow[]>`
      INSERT INTO api_keys (id, name, key_hash, workspace_id, user_id, permissions)
      VALUES (gen_random_uuid(), ${dto.name}, ${keyHash}, ${workspaceId}, ${userId}, ${permissions})
      RETURNING id, name, key_hash, workspace_id, user_id, permissions, last_used_at, created_at, is_revoked
    `;

    const record = rows[0];
    this.logger.log(`API key "${dto.name}" created for workspace ${workspaceId} by user ${userId}`);

    return {
      id: record.id,
      name: record.name,
      workspaceId: record.workspace_id,
      userId: record.user_id,
      permissions: record.permissions as ApiKeyPermission[],
      lastUsedAt: record.last_used_at?.toISOString() ?? null,
      createdAt: record.created_at.toISOString(),
      key: rawKey,
    };
  }

  /**
   * List all non-revoked API keys for a given workspace.
   * Raw keys are never returned in list results.
   */
  async list(workspaceId: string): Promise<ApiKeyDto[]> {
    const records = await this.prisma.$queryRaw<ApiKeyRow[]>`
      SELECT id, name, key_hash, workspace_id, user_id, permissions, last_used_at, created_at, is_revoked
      FROM api_keys
      WHERE workspace_id = ${workspaceId} AND is_revoked = false
      ORDER BY created_at DESC
    `;

    return records.map((r) => this.mapRowToDto(r));
  }

  /**
   * Revoke (soft-delete) an API key by ID.
   * Throws NotFoundException if the key does not belong to the workspace.
   */
  async revoke(workspaceId: string, apiKeyId: string): Promise<void> {
    const rows = await this.prisma.$queryRaw<ApiKeyRow[]>`
      SELECT id FROM api_keys
      WHERE id = ${apiKeyId} AND workspace_id = ${workspaceId} AND is_revoked = false
    `;

    if (rows.length === 0) {
      throw new NotFoundException('API key not found');
    }

    await this.prisma.$executeRaw`
      UPDATE api_keys SET is_revoked = true WHERE id = ${apiKeyId}
    `;

    this.logger.log(`API key ${apiKeyId} revoked in workspace ${workspaceId}`);
  }

  // ── Validation ──────────────────────────────────────────────────────────────

  /**
   * Validate an incoming API key value from the X-API-Key header.
   *
   * Performs a constant-time-equivalent lookup by SHA-256 digest.
   * Updates lastUsedAt on success.
   *
   * @throws UnauthorizedException when key is missing, invalid, or revoked.
   */
  async validate(rawKey: string): Promise<ValidatedApiKey> {
    if (!rawKey || !rawKey.startsWith(ApiKeyService.KEY_PREFIX)) {
      throw new UnauthorizedException('Invalid API key format');
    }

    const keyHash = ApiKeyService.hashKey(rawKey);

    const rows = await this.prisma.$queryRaw<ApiKeyRow[]>`
      SELECT id, workspace_id, user_id, permissions, is_revoked
      FROM api_keys
      WHERE key_hash = ${keyHash}
    `;

    if (rows.length === 0 || rows[0].is_revoked) {
      throw new UnauthorizedException('Invalid or revoked API key');
    }

    const record = rows[0];

    // Fire-and-forget lastUsedAt update — never let this fail a request
    this.prisma.$executeRaw`
      UPDATE api_keys SET last_used_at = now() WHERE id = ${record.id}
    `.catch((err) =>
      this.logger.warn(`Failed to update last_used_at for API key ${record.id}: ${err}`),
    );

    return {
      id: record.id,
      workspaceId: record.workspace_id,
      userId: record.user_id,
      permissions: record.permissions as ApiKeyPermission[],
    };
  }

  /**
   * Assert that a validated API key includes the required permission.
   * @throws ForbiddenException when permission is absent.
   */
  assertPermission(apiKey: ValidatedApiKey, permission: ApiKeyPermission): void {
    if (!apiKey.permissions.includes(permission)) {
      throw new ForbiddenException(`API key does not have permission: ${permission}`);
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  /** SHA-256 hex digest of a raw API key string. */
  static hashKey(rawKey: string): string {
    return createHash('sha256').update(rawKey).digest('hex');
  }

  private mapRowToDto(row: ApiKeyRow): ApiKeyDto {
    return {
      id: row.id,
      name: row.name,
      workspaceId: row.workspace_id,
      userId: row.user_id,
      permissions: row.permissions as ApiKeyPermission[],
      lastUsedAt: row.last_used_at?.toISOString() ?? null,
      createdAt: row.created_at.toISOString(),
    };
  }
}
