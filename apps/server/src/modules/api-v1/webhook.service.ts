import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHash, createHmac, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { JobsService } from '../jobs/jobs.service';
import { CreateWebhookDto, WebhookEvent } from './dto/create-webhook.dto';

// ─── Shapes ───────────────────────────────────────────────────────────────────

export interface WebhookDto {
  id: string;
  workspaceId: string;
  url: string;
  events: WebhookEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface WebhookWithSecret extends WebhookDto {
  /** Raw secret — only present on creation */
  secret: string;
}

export interface WebhookDeliveryDto {
  id: string;
  webhookId: string;
  event: WebhookEvent;
  payload: Record<string, unknown>;
  statusCode: number | null;
  success: boolean;
  attempts: number;
  deliveredAt: string | null;
  createdAt: string;
}

// ─── Raw DB row shapes ────────────────────────────────────────────────────────

interface WebhookRow {
  id: string;
  workspace_id: string;
  url: string;
  events: string[];
  secret_hash: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

interface WebhookDeliveryRow {
  id: string;
  webhook_id: string;
  event: string;
  payload: unknown;
  status_code: number | null;
  success: boolean;
  attempts: number;
  delivered_at: Date | null;
  created_at: Date;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum number of delivery attempts before permanently failing. */
export const WEBHOOK_MAX_ATTEMPTS = 3;

/**
 * Exponential back-off delays in milliseconds for retry scheduling.
 * Attempt 1: immediate, Attempt 2: 60s, Attempt 3: 300s
 */
export const WEBHOOK_BACKOFF_DELAYS_MS = [0, 60_000, 300_000];

/**
 * WebhookService — manages webhook subscriptions, HMAC signing, and delivery
 * via the background job queue.
 *
 * Signature scheme:
 *   Body    = JSON.stringify({ event, triggeredAt, data })
 *   Digest  = HMAC-SHA256(body, secretHash), hex-encoded
 *   Header  = X-Notesaner-Signature: sha256=<hex>
 *
 * The secretHash stored in the database is used as the HMAC key.
 * This means:
 *   - The raw secret is never stored.
 *   - The HMAC key is the SHA-256 of the raw secret.
 *   - Callers who know the raw secret can compute the HMAC by re-hashing it.
 *
 * Database: uses raw SQL since webhook tables are migration-only (not in schema.prisma).
 */
@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobsService: JobsService,
  ) {}

  // ── CRUD ────────────────────────────────────────────────────────────────────

  /**
   * Create a webhook subscription for the workspace.
   * Returns the raw secret on creation — it is hashed before storage and
   * never recoverable afterwards.
   */
  async create(workspaceId: string, dto: CreateWebhookDto): Promise<WebhookWithSecret> {
    const rawSecret = dto.secret ?? randomBytes(32).toString('hex');
    const secretHash = WebhookService.hashSecret(rawSecret);

    const rows = await this.prisma.$queryRaw<WebhookRow[]>`
      INSERT INTO webhooks (id, workspace_id, url, events, secret_hash)
      VALUES (gen_random_uuid(), ${workspaceId}, ${dto.url}, ${dto.events}, ${secretHash})
      RETURNING id, workspace_id, url, events, secret_hash, is_active, created_at, updated_at
    `;

    const record = rows[0];
    this.logger.log(`Webhook created for workspace ${workspaceId}: ${record.id} → ${dto.url}`);

    return {
      ...this.mapRowToDto(record),
      secret: rawSecret,
    };
  }

  /** List all active webhooks for a workspace. */
  async list(workspaceId: string): Promise<WebhookDto[]> {
    const records = await this.prisma.$queryRaw<WebhookRow[]>`
      SELECT id, workspace_id, url, events, secret_hash, is_active, created_at, updated_at
      FROM webhooks
      WHERE workspace_id = ${workspaceId} AND is_active = true
      ORDER BY created_at DESC
    `;

    return records.map((r) => this.mapRowToDto(r));
  }

  /** Get a single webhook by ID. */
  async findById(workspaceId: string, webhookId: string): Promise<WebhookDto> {
    const rows = await this.prisma.$queryRaw<WebhookRow[]>`
      SELECT id, workspace_id, url, events, secret_hash, is_active, created_at, updated_at
      FROM webhooks
      WHERE id = ${webhookId} AND workspace_id = ${workspaceId}
    `;

    if (rows.length === 0) {
      throw new NotFoundException('Webhook not found');
    }

    return this.mapRowToDto(rows[0]);
  }

  /**
   * Soft-delete (deactivate) a webhook.
   * Existing deliveries are preserved for audit.
   */
  async delete(workspaceId: string, webhookId: string): Promise<void> {
    const rows = await this.prisma.$queryRaw<WebhookRow[]>`
      SELECT id FROM webhooks WHERE id = ${webhookId} AND workspace_id = ${workspaceId}
    `;

    if (rows.length === 0) {
      throw new NotFoundException('Webhook not found');
    }

    await this.prisma.$executeRaw`
      UPDATE webhooks SET is_active = false WHERE id = ${webhookId}
    `;

    this.logger.log(`Webhook ${webhookId} deactivated in workspace ${workspaceId}`);
  }

  // ── Delivery ────────────────────────────────────────────────────────────────

  /**
   * Dispatch an event to all active webhook subscriptions in the workspace
   * that are subscribed to this event type.
   *
   * Enqueues a background job for each matching webhook. Delivery failures
   * are retried with exponential back-off (up to WEBHOOK_MAX_ATTEMPTS times).
   */
  async dispatchEvent(
    workspaceId: string,
    event: WebhookEvent,
    payload: Record<string, unknown>,
  ): Promise<void> {
    // PostgreSQL array containment: events @> ARRAY[event]
    const eventParam = event as string;
    const records = await this.prisma.$queryRaw<WebhookRow[]>`
      SELECT id, workspace_id, url, events, secret_hash, is_active, created_at, updated_at
      FROM webhooks
      WHERE workspace_id = ${workspaceId}
        AND is_active = true
        AND events @> ARRAY[${eventParam}]::text[]
    `;

    if (records.length === 0) {
      return;
    }

    const triggeredAt = new Date().toISOString();

    await Promise.all(
      records.map(async (webhook) => {
        const body = JSON.stringify({ event, triggeredAt, data: payload });
        const signature = WebhookService.signPayload(body, webhook.secret_hash);

        // Create a delivery record
        // Prisma $queryRaw requires Prisma.sql for non-primitive values.
        // Serialize to string and cast via ::jsonb for safe JSON insertion.
        const payloadJson = JSON.stringify(payload);
        const deliveryRows = await this.prisma.$queryRaw<{ id: string }[]>`
          INSERT INTO webhook_deliveries (id, webhook_id, event, payload)
          VALUES (gen_random_uuid(), ${webhook.id}, ${eventParam}, ${payloadJson}::jsonb)
          RETURNING id
        `;

        const deliveryId = deliveryRows[0].id;

        // Enqueue via jobs service for reliable retry semantics
        await this.jobsService.enqueueDeliverWebhook({
          webhookId: webhook.id,
          url: webhook.url,
          event,
          payload: {
            ...payload,
            _deliveryId: deliveryId,
            _signature: signature,
          },
          triggeredAt,
        });

        this.logger.debug(
          `Dispatched event ${event} to webhook ${webhook.id} (delivery ${deliveryId})`,
        );
      }),
    );
  }

  /**
   * List delivery records for a specific webhook.
   * Sorted by most recent first.
   */
  async listDeliveries(
    workspaceId: string,
    webhookId: string,
    limit = 50,
  ): Promise<WebhookDeliveryDto[]> {
    // Verify the webhook belongs to this workspace
    const webhookRows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM webhooks WHERE id = ${webhookId} AND workspace_id = ${workspaceId}
    `;

    if (webhookRows.length === 0) {
      throw new NotFoundException('Webhook not found');
    }

    const safeLimit = Math.min(limit, 200);
    const records = await this.prisma.$queryRaw<WebhookDeliveryRow[]>`
      SELECT id, webhook_id, event, payload, status_code, success, attempts, delivered_at, created_at
      FROM webhook_deliveries
      WHERE webhook_id = ${webhookId}
      ORDER BY created_at DESC
      LIMIT ${safeLimit}
    `;

    return records.map((r) => this.mapDeliveryRowToDto(r));
  }

  /**
   * Record the outcome of a delivery attempt.
   * Called by the WebhookDeliveryProcessor after each attempt.
   */
  async recordDeliveryAttempt(
    deliveryId: string,
    statusCode: number | null,
    success: boolean,
  ): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE webhook_deliveries
      SET status_code   = ${statusCode},
          success       = ${success},
          attempts      = attempts + 1,
          delivered_at  = CASE WHEN ${success} THEN now() ELSE NULL END
      WHERE id = ${deliveryId}
    `;
  }

  // ── HMAC helpers ────────────────────────────────────────────────────────────

  /**
   * Compute HMAC-SHA256 signature of the serialized payload body.
   *
   * The signature header value follows the GitHub webhook convention:
   *   X-Notesaner-Signature: sha256=<hex>
   *
   * The `secret` parameter is the stored secretHash (SHA-256 of the raw secret),
   * used as the HMAC key.
   */
  static signPayload(body: string, secret: string): string {
    const hmac = createHmac('sha256', secret);
    hmac.update(body, 'utf8');
    return `sha256=${hmac.digest('hex')}`;
  }

  /**
   * Verify an incoming payload against its signature.
   * Uses a constant-time comparison loop to prevent timing attacks.
   */
  static verifySignature(body: string, secret: string, signature: string): boolean {
    const expected = WebhookService.signPayload(body, secret);
    if (expected.length !== signature.length) {
      return false;
    }
    let mismatch = 0;
    for (let i = 0; i < expected.length; i++) {
      mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
    }
    return mismatch === 0;
  }

  /** SHA-256 hex digest of the webhook secret. Used for storage. */
  static hashSecret(rawSecret: string): string {
    return createHash('sha256').update(rawSecret).digest('hex');
  }

  // ── Mappers ─────────────────────────────────────────────────────────────────

  private mapRowToDto(row: WebhookRow): WebhookDto {
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      url: row.url,
      events: row.events as WebhookEvent[],
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  private mapDeliveryRowToDto(row: WebhookDeliveryRow): WebhookDeliveryDto {
    return {
      id: row.id,
      webhookId: row.webhook_id,
      event: row.event as WebhookEvent,
      payload: (row.payload ?? {}) as Record<string, unknown>,
      statusCode: row.status_code,
      success: row.success,
      attempts: row.attempts,
      deliveredAt: row.delivered_at?.toISOString() ?? null,
      createdAt: row.created_at.toISOString(),
    };
  }
}
