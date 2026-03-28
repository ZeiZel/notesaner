import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { NOTIFICATION_DIGEST_QUEUE } from '../notifications.constants';
import { NotificationsService } from '../notifications.service';
import type { DigestJobData, DigestJobResult } from '../notifications.types';

/**
 * DigestProcessor — BullMQ worker that processes notification digest email jobs.
 *
 * Registered for the NOTIFICATION_DIGEST_QUEUE. Handles both daily and weekly
 * digest jobs by delegating to NotificationsService.processDigest().
 */
@Processor(NOTIFICATION_DIGEST_QUEUE)
export class DigestProcessor extends WorkerHost {
  private readonly logger = new Logger(DigestProcessor.name);

  constructor(private readonly notificationsService: NotificationsService) {
    super();
  }

  async process(job: Job<DigestJobData>): Promise<DigestJobResult> {
    const startMs = Date.now();
    const { frequency } = job.data;

    this.logger.log(`Processing ${frequency} digest job ${job.id}`);

    try {
      const result = await this.notificationsService.processDigest(frequency);

      const durationMs = Date.now() - startMs;

      this.logger.log(
        `${frequency} digest completed: ${result.usersProcessed} users processed, ${result.emailsSent} emails sent (${durationMs}ms)`,
      );

      return {
        usersProcessed: result.usersProcessed,
        emailsSent: result.emailsSent,
        durationMs,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`${frequency} digest job ${job.id} failed: ${message}`);
      throw err;
    }
  }
}
