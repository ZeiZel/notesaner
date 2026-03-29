import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHash, createHmac, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { JobsService } from '../jobs/jobs.service';
import { WEBHOOK_MAX_PER_WORKSPACE } from '../jobs/jobs.constants';
import { CreateWebhookDto, WebhookEvent } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';

// ─── Shapes ───────────────────────────────────────────────────────────────────

export interface WebhookDto {
  id: string;
  workspaceId: string;
  url: string;
  events: WebhookEvent[];
  isActive: boolean;
  failureCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookWithSecret extends WebhookDto {
  /** Raw secret -- only present on creation */
  secret: string;
}

export interface WebhookDeliveryDto {
  id: string;
  webhookId: string;
  event: WebhookEvent;
  payload: Record<string, unknown>;
  statusCode: number | null;
  responseTimeMs: number | null;
  success: boolean;
  attempts: number;
  deliveredAt: string | null;
  createdAt: string;
}

export interface WebhookDeliveryStatsDto {
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  lastDeliveryAt: string | null;
}

export interface WebhookWithStatsDto extends WebhookDto {
  deliveryStats: WebhookDeliveryStatsDto;
}

// ─── Raw DB row shapes ────────────────────────────────────────────────────────

interface WebhookRow {
  id: string;
  workspace_id: string;
  url: string;
  events: string[];
  secret_hash: string;
  is_active: boolean;
  failure_count: number;
  created_at: Date;
  updated_at: Date;
}

interface WebhookDeliveryRow {
  id: string;
  webhook_id: string;
  event: string;
  payload: unknown;
  status_code: number | null;
  response_time_ms: number | null;
  success: boolean;
  attempts: number;
  delivered_at: Date | null;
  created_at: Date;
}

interface WebhookDeliveryStatsRow {
  total_deliveries: bigint;
  successful_deliveries: bigint;
  failed_deliveries: bigint;
  last_delivery_at: Date | null;
}

/**
 * WebhookService -- manages webhook subscriptions, HMAC signing, and delivery
 * via the background job queue.
 *
 * Signature scheme:
 *   Body    = JSON.stringify({ event, triggeredAt, data, workspaceId })
 *   Digest  = HMAC-SHA256(body, secretHash), hex-encoded
 *   Header  = X-Webhook-Signature: sha256=<hex>
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
   * Enforces a maximum of WEBHOOK_MAX_PER_WORKSPACE active webhooks.
   * Returns the raw secret on creation -- it is hashed before storage and
   * never recoverable afterwards.
   */
  async create(workspaceId: string, dto: CreateWebhookDto): Promise<WebhookWithSecret> {
    // Enforce max webhooks per workspace
    const countRows = await this.prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count FROM webhooks
      WHERE workspace_id = ${workspaceId} AND is_active = true
    `;

    const currentCount = Number(countRows[0]?.count ?? 0);
    if (currentCount >= WEBHOOK_MAX_PER_WORKSPACE) {
      throw new BadRequestException(
        `Maximum of ${WEBHOOK_MAX_PER_WORKSPACE} active webhooks per workspace reached`,
      );
    }

    const rawSecret = dto.secret ?? randomBytes(32).toString('hex');
    const secretHash = WebhookService.hashSecret(rawSecret);

    const rows = await this.prisma.$queryRaw<WebhookRow[]>`
      INSERT INTO webhooks (id, workspace_id, url, events, secret_hash)
      VALUES (gen_random_uuid(), ${workspaceId}, ${dto.url}, ${dto.events}, ${secretHash})
      RETURNING id, workspace_id, url, events, secret_hash, is_active, failure_count, created_at, updated_at
    `;

    const record = rows[0];
    this.logger.log(`Webhook created for workspace ${workspaceId}: ${record.id} -> ${dto.url}`);

    return {
      ...this.mapRowToDto(record),
      secret: rawSecret,
    };
  }

  /** List all active webhooks for a workspace. */
  async list(workspaceId: string): Promise<WebhookDto[]> {
    const records = await this.prisma.$queryRaw<WebhookRow[]>`
      SELECT id, workspace_id, url, events, secret_hash, is_active, failure_count, created_at, updated_at
      FROM webhooks
      WHERE workspace_id = ${workspaceId} AND is_active = true
      ORDER BY created_at DESC
    `;

    return records.map((r) => this.mapRowToDto(r));
  }

  /** Get a single webhook by ID. */
  async findById(workspaceId: string, webhookId: string): Promise<WebhookDto> {
    const rows = await this.prisma.$queryRaw<WebhookRow[]>`
      SELECT id, workspace_id, url, events, secret_hash, is_active, failure_count, created_at, updated_at
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

  /**
   * Update mutable fields of a webhook subscription.
   *
   * - url: new destination URL
   * - events: replacement list of event subscriptions
   * - active: enable/disable toggle (re-enabling resets failure counter)
   *
   * Any combination of fields may be provided; unchanged fields retain
   * their current values.
   */
  async update(workspaceId: string, webhookId: string, dto: UpdateWebhookDto): Promise<WebhookDto> {
    const rows = await this.prisma.$queryRaw<WebhookRow[]>`
      SELECT id, workspace_id, url, events, secret_hash, is_active, failure_count, created_at, updated_at
      FROM webhooks
      WHERE id = ${webhookId} AND workspace_id = ${workspaceId}
    `;

    if (rows.length === 0) {
      throw new NotFoundException('Webhook not found');
    }

    const current = rows[0];
    const newUrl = dto.url ?? current.url;
    const newEvents = dto.events ?? (current.events as WebhookEvent[]);

    // When re-enabling, reset failure counter for a fresh start
    const newIsActive = dto.active !== undefined ? dto.active : current.is_active;
    const newFailureCount = dto.active === true && !current.is_active ? 0 : current.failure_count;

    const updated = await this.prisma.$queryRaw<WebhookRow[]>`
      UPDATE webhooks
      SET url            = ${newUrl},
          events         = ${newEvents},
          is_active      = ${newIsActive},
          failure_count  = ${newFailureCount},
          updated_at     = now()
      WHERE id = ${webhookId}
      RETURNING id, workspace_id, url, events, secret_hash, is_active, failure_count, created_at, updated_at
    `;

    this.logger.log(`Webhook ${webhookId} updated in workspace ${workspaceId}`);

    return this.mapRowToDto(updated[0]);
  }

  /**
   * Get a single webhook with aggregated delivery statistics.
   *
   * Delivery stats include total/successful/failed delivery counts and the
   * timestamp of the most recent delivery attempt.
   */
  async findByIdWithStats(workspaceId: string, webhookId: string): Promise<WebhookWithStatsDto> {
    const rows = await this.prisma.$queryRaw<WebhookRow[]>`
      SELECT id, workspace_id, url, events, secret_hash, is_active, failure_count, created_at, updated_at
      FROM webhooks
      WHERE id = ${webhookId} AND workspace_id = ${workspaceId}
    `;

    if (rows.length === 0) {
      throw new NotFoundException('Webhook not found');
    }

    const statsRows = await this.prisma.$queryRaw<WebhookDeliveryStatsRow[]>`
      SELECT
        COUNT(*)::bigint                               AS total_deliveries,
        COUNT(*) FILTER (WHERE success = true)::bigint  AS successful_deliveries,
        COUNT(*) FILTER (WHERE success = false)::bigint AS failed_deliveries,
        MAX(created_at)                                AS last_delivery_at
      FROM webhook_deliveries
      WHERE webhook_id = ${webhookId}
    `;

    const stats = statsRows[0];

    return {
      ...this.mapRowToDto(rows[0]),
      deliveryStats: {
        totalDeliveries: Number(stats?.total_deliveries ?? 0),
        successfulDeliveries: Number(stats?.successful_deliveries ?? 0),
        failedDeliveries: Number(stats?.failed_deliveries ?? 0),
        lastDeliveryAt: stats?.last_delivery_at?.toISOString() ?? null,
      },
    };
  }

  // ── Enable / Disable ───────────────────────────────────────────────────────

  /**
   * Toggle the enabled state of a webhook.
   * Re-enabling also resets the failure counter.
   */
  async setEnabled(workspaceId: string, webhookId: string, enabled: boolean): Promise<WebhookDto> {
    const rows = await this.prisma.$queryRaw<WebhookRow[]>`
      SELECT id, workspace_id, url, events, secret_hash, is_active, failure_count, created_at, updated_at
      FROM webhooks
      WHERE id = ${webhookId} AND workspace_id = ${workspaceId}
    `;

    if (rows.length === 0) {
      throw new NotFoundException('Webhook not found');
    }

    // When re-enabling, reset failure count so it gets a fresh start
    if (enabled) {
      await this.prisma.$executeRaw`
        UPDATE webhooks SET is_active = true, failure_count = 0 WHERE id = ${webhookId}
      `;
    } else {
      await this.prisma.$executeRaw`
        UPDATE webhooks SET is_active = false WHERE id = ${webhookId}
      `;
    }

    this.logger.log(
      `Webhook ${webhookId} ${enabled ? 'enabled' : 'disabled'} in workspace ${workspaceId}`,
    );

    // Return the updated webhook
    const updatedRows = await this.prisma.$queryRaw<WebhookRow[]>`
      SELECT id, workspace_id, url, events, secret_hash, is_active, failure_count, created_at, updated_at
      FROM webhooks
      WHERE id = ${webhookId}
    `;

    return this.mapRowToDto(updatedRows[0]);
  }

  // ── Test Delivery ──────────────────────────────────────────────────────────

  /**
   * Send a test event to a specific webhook.
   * This delivers a synthetic `test` payload to verify connectivity.
   */
  async sendTestEvent(workspaceId: string, webhookId: string): Promise<{ deliveryId: string }> {
    const webhookRows = await this.prisma.$queryRaw<WebhookRow[]>`
      SELECT id, workspace_id, url, events, secret_hash, is_active, failure_count, created_at, updated_at
      FROM webhooks
      WHERE id = ${webhookId} AND workspace_id = ${workspaceId}
    `;

    if (webhookRows.length === 0) {
      throw new NotFoundException('Webhook not found');
    }

    const webhook = webhookRows[0];
    const triggeredAt = new Date().toISOString();
    const testPayload = {
      test: true,
      message: 'This is a test webhook delivery from Notesaner',
      timestamp: triggeredAt,
    };

    const eventType = 'test' as string;
    const body = JSON.stringify({
      event: eventType,
      triggeredAt,
      data: testPayload,
      workspaceId,
    });
    const signature = WebhookService.signPayload(body, webhook.secret_hash);

    // Create a delivery record
    const payloadJson = JSON.stringify(testPayload);
    const deliveryRows = await this.prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO webhook_deliveries (id, webhook_id, event, payload)
      VALUES (gen_random_uuid(), ${webhook.id}, ${eventType}, ${payloadJson}::jsonb)
      RETURNING id
    `;

    const deliveryId = deliveryRows[0].id;

    // Enqueue via jobs service for reliable delivery
    await this.jobsService.enqueueDeliverWebhook({
      webhookId: webhook.id,
      deliveryId,
      url: webhook.url,
      event: eventType,
      body,
      signature,
    });

    this.logger.log(`Test event dispatched to webhook ${webhookId} (delivery ${deliveryId})`);

    return { deliveryId };
  }

  // ── Delivery ────────────────────────────────────────────────────────────────

  /**
   * Dispatch an event to all active webhook subscriptions in the workspace
   * that are subscribed to this event type.
   *
   * Enqueues a background job for each matching webhook. Delivery failures
   * are retried with exponential back-off (up to 3 times).
   */
  async dispatchEvent(
    workspaceId: string,
    event: WebhookEvent,
    payload: Record<string, unknown>,
  ): Promise<void> {
    // PostgreSQL array containment: events @> ARRAY[event]
    const eventParam = event as string;
    const records = await this.prisma.$queryRaw<WebhookRow[]>`
      SELECT id, workspace_id, url, events, secret_hash, is_active, failure_count, created_at, updated_at
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
        const body = JSON.stringify({
          event,
          triggeredAt,
          data: payload,
          workspaceId,
        });
        const signature = WebhookService.signPayload(body, webhook.secret_hash);

        // Create a delivery record
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
          deliveryId,
          url: webhook.url,
          event,
          body,
          signature,
        });

        this.logger.debug(
          `Dispatched event ${event} to webhook ${webhook.id} (delivery ${deliveryId})`,
        );
      }),
    );
  }

  /**
   * List delivery records for a specific webhook.
   * Returns the last 100 deliveries sorted by most recent first.
   */
  async listDeliveries(
    workspaceId: string,
    webhookId: string,
    limit = 100,
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
      SELECT id, webhook_id, event, payload, status_code, response_time_ms, success, attempts, delivered_at, created_at
      FROM webhook_deliveries
      WHERE webhook_id = ${webhookId}
      ORDER BY created_at DESC
      LIMIT ${safeLimit}
    `;

    return records.map((r) => this.mapDeliveryRowToDto(r));
  }

  // ── HMAC helpers ────────────────────────────────────────────────────────────

  /**
   * Compute HMAC-SHA256 signature of the serialized payload body.
   *
   * The signature header value follows the GitHub webhook convention:
   *   X-Webhook-Signature: sha256=<hex>
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
      isActive: row.is_active,
      failureCount: row.failure_count,
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
      responseTimeMs: row.response_time_ms,
      success: row.success,
      attempts: row.attempts,
      deliveredAt: row.delivered_at?.toISOString() ?? null,
      createdAt: row.created_at.toISOString(),
    };
  }
}
