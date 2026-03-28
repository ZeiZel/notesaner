import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  DELIVER_WEBHOOK_JOB,
  WEBHOOK_AUTO_DISABLE_THRESHOLD,
  WEBHOOK_DELIVERY_CONCURRENCY,
  WEBHOOK_DELIVERY_QUEUE,
  WEBHOOK_DELIVERY_TIMEOUT_MS,
} from '../jobs.constants';
import type { DeliverWebhookJobData, DeliverWebhookJobResult } from '../jobs.types';

/**
 * BullMQ processor for delivering webhook HTTP payloads.
 *
 * For each job:
 *   1. POST the pre-serialized JSON body to the webhook URL.
 *   2. Include X-Webhook-Signature header with HMAC-SHA256 signature.
 *   3. Record the delivery outcome (status code, response time, success).
 *   4. Track consecutive failures on the webhook record.
 *   5. Auto-disable the webhook after WEBHOOK_AUTO_DISABLE_THRESHOLD consecutive failures.
 *
 * Uses native `fetch()` (Node 22+) with an AbortController for timeouts.
 * BullMQ handles retry scheduling with exponential back-off (1s, 10s, ~60s).
 */
@Processor(WEBHOOK_DELIVERY_QUEUE, {
  concurrency: WEBHOOK_DELIVERY_CONCURRENCY,
})
export class WebhookDeliveryProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookDeliveryProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<DeliverWebhookJobData>): Promise<DeliverWebhookJobResult> {
    if (job.name !== DELIVER_WEBHOOK_JOB) {
      throw new Error(`Unknown job name: ${job.name}`);
    }

    return this.deliverWebhook(job);
  }

  private async deliverWebhook(job: Job<DeliverWebhookJobData>): Promise<DeliverWebhookJobResult> {
    const { webhookId, deliveryId, url, body, signature } = job.data;
    const start = Date.now();

    this.logger.debug(`Delivering webhook ${webhookId} (delivery ${deliveryId}) to ${url}`);

    let statusCode: number | null = null;
    let success = false;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), WEBHOOK_DELIVERY_TIMEOUT_MS);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': signature,
            'User-Agent': 'Notesaner-Webhook/1.0',
          },
          body,
          signal: controller.signal,
        });

        statusCode = response.status;
        // Consider 2xx as success
        success = statusCode >= 200 && statusCode < 300;
      } finally {
        clearTimeout(timeout);
      }
    } catch (error: unknown) {
      // Network error, timeout, DNS failure, etc.
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Webhook delivery ${deliveryId} failed for ${url}: ${message}`);
      statusCode = null;
      success = false;
    }

    const responseTimeMs = Date.now() - start;

    // Record the delivery attempt in the database
    await this.recordDeliveryAttempt(deliveryId, statusCode, success, responseTimeMs);

    // Track consecutive failures on the webhook
    await this.updateFailureTracking(webhookId, success);

    if (!success) {
      const attemptNumber = (job.attemptsMade ?? 0) + 1;
      this.logger.warn(
        `Webhook delivery ${deliveryId} attempt ${attemptNumber} failed ` +
          `(status: ${statusCode ?? 'network_error'}, ${responseTimeMs}ms)`,
      );
      // Throw to trigger BullMQ retry (if attempts remain)
      throw new Error(`Webhook delivery failed: status=${statusCode ?? 'network_error'}`);
    }

    this.logger.debug(
      `Webhook delivery ${deliveryId} succeeded (status: ${statusCode}, ${responseTimeMs}ms)`,
    );

    return { deliveryId, statusCode, success, responseTimeMs };
  }

  /**
   * Record the outcome of a delivery attempt in the webhook_deliveries table.
   */
  private async recordDeliveryAttempt(
    deliveryId: string,
    statusCode: number | null,
    success: boolean,
    responseTimeMs: number,
  ): Promise<void> {
    try {
      await this.prisma.$executeRaw`
        UPDATE webhook_deliveries
        SET status_code      = ${statusCode},
            success          = ${success},
            attempts         = attempts + 1,
            response_time_ms = ${responseTimeMs},
            delivered_at     = CASE WHEN ${success} THEN now() ELSE delivered_at END
        WHERE id = ${deliveryId}
      `;
    } catch (error) {
      this.logger.error(`Failed to record delivery attempt for ${deliveryId}: ${String(error)}`);
    }
  }

  /**
   * Update the consecutive failure counter on the webhook.
   * On success, reset failure_count to 0.
   * On failure, increment failure_count and auto-disable if threshold reached.
   */
  private async updateFailureTracking(webhookId: string, success: boolean): Promise<void> {
    try {
      if (success) {
        // Reset failure count on successful delivery
        await this.prisma.$executeRaw`
          UPDATE webhooks SET failure_count = 0 WHERE id = ${webhookId}
        `;
      } else {
        // Increment failure count
        await this.prisma.$executeRaw`
          UPDATE webhooks
          SET failure_count = failure_count + 1
          WHERE id = ${webhookId}
        `;

        // Check if we need to auto-disable
        const rows = await this.prisma.$queryRaw<{ failure_count: number }[]>`
          SELECT failure_count FROM webhooks WHERE id = ${webhookId}
        `;

        if (rows.length > 0 && rows[0].failure_count >= WEBHOOK_AUTO_DISABLE_THRESHOLD) {
          await this.prisma.$executeRaw`
            UPDATE webhooks SET is_active = false WHERE id = ${webhookId}
          `;
          this.logger.warn(
            `Webhook ${webhookId} auto-disabled after ${WEBHOOK_AUTO_DISABLE_THRESHOLD} consecutive failures`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to update failure tracking for webhook ${webhookId}: ${String(error)}`,
      );
    }
  }
}
