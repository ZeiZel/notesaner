import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Job } from 'bullmq';
import { WebhookDeliveryProcessor } from '../processors/webhook-delivery.processor';
import { DELIVER_WEBHOOK_JOB, WEBHOOK_AUTO_DISABLE_THRESHOLD } from '../jobs.constants';
import type { DeliverWebhookJobData } from '../jobs.types';
import type { PrismaService } from '../../../prisma/prisma.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeJobData(overrides: Partial<DeliverWebhookJobData> = {}): DeliverWebhookJobData {
  return {
    webhookId: 'wh-1',
    deliveryId: 'del-1',
    url: 'https://example.com/webhook',
    event: 'note.created',
    body: '{"event":"note.created","triggeredAt":"2025-01-01T00:00:00Z","data":{"noteId":"n1"},"workspaceId":"ws-1"}',
    signature: 'sha256=abc123',
    ...overrides,
  };
}

function makeJob(
  data: DeliverWebhookJobData,
  overrides: Record<string, unknown> = {},
): Job<DeliverWebhookJobData> {
  return {
    name: DELIVER_WEBHOOK_JOB,
    data,
    attemptsMade: 0,
    ...overrides,
  } as unknown as Job<DeliverWebhookJobData>;
}

// ─── Mock fetch ──────────────────────────────────────────────────────────────

const mockFetch = vi.fn();

// ─── Test Suite ──────────────────────────────────────────────────────────────

describe('WebhookDeliveryProcessor', () => {
  let processor: WebhookDeliveryProcessor;
  let prisma: Partial<PrismaService>;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();

    // Save and replace global fetch
    originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;

    prisma = {
      $queryRaw: vi.fn(),
      $executeRaw: vi.fn().mockResolvedValue(1),
    } as unknown as Partial<PrismaService>;

    processor = new WebhookDeliveryProcessor(prisma as PrismaService);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // ── Successful delivery ───────────────────────────────────────────────────

  describe('successful delivery', () => {
    it('should POST to the webhook URL with correct headers', async () => {
      mockFetch.mockResolvedValueOnce(new Response('OK', { status: 200 }));
      // failure tracking: success resets count
      vi.mocked(prisma.$queryRaw!).mockResolvedValue([]);

      const jobData = makeJobData();
      const result = await processor.process(makeJob(jobData));

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://example.com/webhook');
      expect(options.method).toBe('POST');
      expect(options.headers).toEqual(
        expect.objectContaining({
          'Content-Type': 'application/json',
          'X-Webhook-Signature': 'sha256=abc123',
          'User-Agent': 'Notesaner-Webhook/1.0',
        }),
      );
      expect(options.body).toBe(jobData.body);

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.deliveryId).toBe('del-1');
      expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should record the delivery attempt in the database', async () => {
      mockFetch.mockResolvedValueOnce(new Response('OK', { status: 200 }));

      await processor.process(makeJob(makeJobData()));

      // $executeRaw is called for: record attempt + reset failure count
      expect(prisma.$executeRaw).toHaveBeenCalled();
    });

    it('should reset failure count on success', async () => {
      mockFetch.mockResolvedValueOnce(new Response('OK', { status: 200 }));

      await processor.process(makeJob(makeJobData()));

      // At least 2 $executeRaw calls: record delivery + reset failure count
      expect(vi.mocked(prisma.$executeRaw!).mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ── Failed delivery ───────────────────────────────────────────────────────

  describe('failed delivery', () => {
    it('should throw on non-2xx status to trigger BullMQ retry', async () => {
      mockFetch.mockResolvedValueOnce(new Response('Server Error', { status: 500 }));
      // failure_count query
      vi.mocked(prisma.$queryRaw!).mockResolvedValue([{ failure_count: 1 }]);

      await expect(processor.process(makeJob(makeJobData()))).rejects.toThrow(
        /Webhook delivery failed/,
      );
    });

    it('should throw on network error to trigger BullMQ retry', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      vi.mocked(prisma.$queryRaw!).mockResolvedValue([{ failure_count: 1 }]);

      await expect(processor.process(makeJob(makeJobData()))).rejects.toThrow(
        /Webhook delivery failed/,
      );
    });

    it('should record null statusCode on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('DNS lookup failed'));
      vi.mocked(prisma.$queryRaw!).mockResolvedValue([{ failure_count: 1 }]);

      await expect(processor.process(makeJob(makeJobData()))).rejects.toThrow();

      // The first $executeRaw call should be the delivery attempt recording
      expect(prisma.$executeRaw).toHaveBeenCalled();
    });

    it('should increment failure count on failed delivery', async () => {
      mockFetch.mockResolvedValueOnce(new Response('Bad Gateway', { status: 502 }));
      vi.mocked(prisma.$queryRaw!).mockResolvedValue([{ failure_count: 3 }]);

      await expect(processor.process(makeJob(makeJobData()))).rejects.toThrow();

      // Should have calls for: record attempt + increment failure + check count
      expect(prisma.$executeRaw).toHaveBeenCalled();
    });
  });

  // ── Auto-disable ──────────────────────────────────────────────────────────

  describe('auto-disable after consecutive failures', () => {
    it('should disable webhook when failure threshold is reached', async () => {
      mockFetch.mockResolvedValueOnce(new Response('Error', { status: 503 }));
      vi.mocked(prisma.$queryRaw!).mockResolvedValue([
        { failure_count: WEBHOOK_AUTO_DISABLE_THRESHOLD },
      ]);

      await expect(processor.process(makeJob(makeJobData()))).rejects.toThrow();

      // Should call $executeRaw for: record attempt + increment + disable
      const executeCalls = vi.mocked(prisma.$executeRaw!).mock.calls;
      expect(executeCalls.length).toBeGreaterThanOrEqual(3);
    });

    it('should not disable webhook when failure count is below threshold', async () => {
      mockFetch.mockResolvedValueOnce(new Response('Error', { status: 503 }));
      vi.mocked(prisma.$queryRaw!).mockResolvedValue([
        { failure_count: WEBHOOK_AUTO_DISABLE_THRESHOLD - 1 },
      ]);

      await expect(processor.process(makeJob(makeJobData()))).rejects.toThrow();

      // Should NOT have the third $executeRaw call for disabling
      const executeCalls = vi.mocked(prisma.$executeRaw!).mock.calls;
      // record attempt + increment = 2 calls (no disable call)
      expect(executeCalls.length).toBe(2);
    });
  });

  // ── Unknown job name ──────────────────────────────────────────────────────

  describe('unknown job name', () => {
    it('should throw for unknown job names', async () => {
      const job = {
        name: 'unknown-job',
        data: makeJobData(),
      } as unknown as Job<DeliverWebhookJobData>;

      await expect(processor.process(job)).rejects.toThrow('Unknown job name: unknown-job');
    });
  });
});
