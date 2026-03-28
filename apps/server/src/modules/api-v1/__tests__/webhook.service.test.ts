import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import {
  WebhookService,
  WEBHOOK_MAX_ATTEMPTS,
  WEBHOOK_BACKOFF_DELAYS_MS,
} from '../webhook.service';
import { WebhookEvent } from '../dto/create-webhook.dto';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { JobsService } from '../../jobs/jobs.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeWebhookRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'wh-1',
    workspace_id: 'ws-1',
    url: 'https://example.com/hook',
    events: [WebhookEvent.NOTE_CREATED],
    secret_hash: 'abc123',
    is_active: true,
    created_at: new Date('2025-01-01'),
    updated_at: new Date('2025-01-01'),
    ...overrides,
  };
}

function makeDeliveryRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'del-1',
    webhook_id: 'wh-1',
    event: WebhookEvent.NOTE_CREATED,
    payload: { noteId: 'n1' },
    status_code: null,
    success: false,
    attempts: 0,
    delivered_at: null,
    created_at: new Date('2025-01-01'),
    ...overrides,
  };
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('WebhookService', () => {
  let service: WebhookService;
  let prisma: Partial<PrismaService>;
  let jobsService: Partial<JobsService>;

  beforeEach(() => {
    vi.clearAllMocks();

    prisma = {
      $queryRaw: vi.fn(),
      $executeRaw: vi.fn().mockResolvedValue(1),
    } as unknown as Partial<PrismaService>;

    jobsService = {
      enqueueDeliverWebhook: vi.fn().mockResolvedValue(undefined),
    } as unknown as Partial<JobsService>;

    service = new WebhookService(prisma as PrismaService, jobsService as JobsService);
  });

  // ── Constants ──────────────────────────────────────────────────────────────

  describe('constants', () => {
    it('should have WEBHOOK_MAX_ATTEMPTS = 3', () => {
      expect(WEBHOOK_MAX_ATTEMPTS).toBe(3);
    });

    it('should have three back-off delay entries', () => {
      expect(WEBHOOK_BACKOFF_DELAYS_MS).toHaveLength(3);
    });

    it('should have 0 ms delay for first attempt', () => {
      expect(WEBHOOK_BACKOFF_DELAYS_MS[0]).toBe(0);
    });

    it('should have increasing delays for subsequent attempts', () => {
      expect(WEBHOOK_BACKOFF_DELAYS_MS[1]).toBeGreaterThan(WEBHOOK_BACKOFF_DELAYS_MS[0]!);
      expect(WEBHOOK_BACKOFF_DELAYS_MS[2]).toBeGreaterThan(WEBHOOK_BACKOFF_DELAYS_MS[1]!);
    });
  });

  // ── hashSecret ─────────────────────────────────────────────────────────────

  describe('hashSecret', () => {
    it('should return a 64-char hex string', () => {
      expect(WebhookService.hashSecret('my-secret')).toHaveLength(64);
    });

    it('should be deterministic', () => {
      const h1 = WebhookService.hashSecret('s');
      const h2 = WebhookService.hashSecret('s');
      expect(h1).toBe(h2);
    });

    it('should differ for different inputs', () => {
      expect(WebhookService.hashSecret('a')).not.toBe(WebhookService.hashSecret('b'));
    });
  });

  // ── signPayload ────────────────────────────────────────────────────────────

  describe('signPayload', () => {
    it('should return signature starting with sha256=', () => {
      const sig = WebhookService.signPayload('body', 'secret');
      expect(sig).toMatch(/^sha256=[0-9a-f]{64}$/);
    });

    it('should be deterministic for same body and secret', () => {
      const s1 = WebhookService.signPayload('body', 'secret');
      const s2 = WebhookService.signPayload('body', 'secret');
      expect(s1).toBe(s2);
    });

    it('should differ when body changes', () => {
      const s1 = WebhookService.signPayload('body1', 'secret');
      const s2 = WebhookService.signPayload('body2', 'secret');
      expect(s1).not.toBe(s2);
    });

    it('should differ when secret changes', () => {
      const s1 = WebhookService.signPayload('body', 'secret1');
      const s2 = WebhookService.signPayload('body', 'secret2');
      expect(s1).not.toBe(s2);
    });
  });

  // ── verifySignature ────────────────────────────────────────────────────────

  describe('verifySignature', () => {
    it('should verify a valid signature', () => {
      const secret = 'my-signing-secret';
      const body = JSON.stringify({ event: 'note.created' });
      const sig = WebhookService.signPayload(body, secret);
      expect(WebhookService.verifySignature(body, secret, sig)).toBe(true);
    });

    it('should reject a tampered body', () => {
      const secret = 'my-signing-secret';
      const body = '{"event":"note.created"}';
      const sig = WebhookService.signPayload(body, secret);
      expect(WebhookService.verifySignature('{"event":"note.updated"}', secret, sig)).toBe(false);
    });

    it('should reject a wrong secret', () => {
      const body = '{"event":"note.created"}';
      const sig = WebhookService.signPayload(body, 'correct-secret');
      expect(WebhookService.verifySignature(body, 'wrong-secret', sig)).toBe(false);
    });

    it('should reject an empty signature', () => {
      const body = 'test-body';
      expect(WebhookService.verifySignature(body, 'secret', '')).toBe(false);
    });

    it('should be resistant to length-extension (different length → false)', () => {
      const body = 'test';
      const secret = 'key';
      const validSig = WebhookService.signPayload(body, secret);
      const truncated = validSig.slice(0, -4);
      expect(WebhookService.verifySignature(body, secret, truncated)).toBe(false);
    });
  });

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create a webhook and return it with secret', async () => {
      vi.mocked(prisma.$queryRaw!).mockResolvedValue([makeWebhookRow()]);

      const result = await service.create('ws-1', {
        url: 'https://example.com/hook',
        events: [WebhookEvent.NOTE_CREATED],
      });

      expect(result.id).toBe('wh-1');
      expect(result.url).toBe('https://example.com/hook');
      expect(result.secret).toBeDefined();
      expect(result.secret).toHaveLength(64); // 32 bytes as hex
    });

    it('should use provided secret when supplied', async () => {
      vi.mocked(prisma.$queryRaw!).mockResolvedValue([makeWebhookRow()]);

      await service.create('ws-1', {
        url: 'https://example.com/hook',
        events: [WebhookEvent.NOTE_CREATED],
        secret: '1234567890abcdef1234567890abcdef',
      });

      expect(prisma.$queryRaw).toHaveBeenCalledOnce();
    });

    it('should not expose secret_hash in the returned DTO', async () => {
      vi.mocked(prisma.$queryRaw!).mockResolvedValue([makeWebhookRow()]);
      const result = await service.create('ws-1', {
        url: 'https://example.com/hook',
        events: [WebhookEvent.NOTE_UPDATED],
      });
      expect((result as unknown as Record<string, unknown>).secretHash).toBeUndefined();
      expect((result as unknown as Record<string, unknown>).secret_hash).toBeUndefined();
    });

    it('should accept multiple events', async () => {
      vi.mocked(prisma.$queryRaw!).mockResolvedValue([
        makeWebhookRow({ events: [WebhookEvent.NOTE_CREATED, WebhookEvent.NOTE_DELETED] }),
      ]);
      const result = await service.create('ws-1', {
        url: 'https://example.com/hook',
        events: [WebhookEvent.NOTE_CREATED, WebhookEvent.NOTE_DELETED],
      });
      expect(result.events).toContain(WebhookEvent.NOTE_CREATED);
      expect(result.events).toContain(WebhookEvent.NOTE_DELETED);
    });

    it('should propagate DB errors', async () => {
      vi.mocked(prisma.$queryRaw!).mockRejectedValue(new Error('unique constraint'));
      await expect(
        service.create('ws-1', {
          url: 'https://example.com/hook',
          events: [WebhookEvent.NOTE_CREATED],
        }),
      ).rejects.toThrow('unique constraint');
    });
  });

  // ── list ───────────────────────────────────────────────────────────────────

  describe('list', () => {
    it('should return active webhooks for workspace', async () => {
      vi.mocked(prisma.$queryRaw!).mockResolvedValue([
        makeWebhookRow({ id: 'wh-1' }),
        makeWebhookRow({ id: 'wh-2' }),
      ]);
      const result = await service.list('ws-1');
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no webhooks', async () => {
      vi.mocked(prisma.$queryRaw!).mockResolvedValue([]);
      const result = await service.list('ws-1');
      expect(result).toEqual([]);
    });

    it('should not expose secret_hash in list results', async () => {
      vi.mocked(prisma.$queryRaw!).mockResolvedValue([makeWebhookRow()]);
      const result = await service.list('ws-1');
      expect((result[0] as unknown as Record<string, unknown>).secret_hash).toBeUndefined();
      expect((result[0] as unknown as Record<string, unknown>).secretHash).toBeUndefined();
    });
  });

  // ── findById ───────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('should return the webhook DTO', async () => {
      vi.mocked(prisma.$queryRaw!).mockResolvedValue([makeWebhookRow()]);
      const result = await service.findById('ws-1', 'wh-1');
      expect(result.id).toBe('wh-1');
    });

    it('should throw NotFoundException for unknown ID', async () => {
      vi.mocked(prisma.$queryRaw!).mockResolvedValue([]);
      await expect(service.findById('ws-1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for wrong workspace', async () => {
      vi.mocked(prisma.$queryRaw!).mockResolvedValue([]);
      await expect(service.findById('ws-other', 'wh-1')).rejects.toThrow(NotFoundException);
    });
  });

  // ── delete ─────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('should deactivate the webhook', async () => {
      vi.mocked(prisma.$queryRaw!).mockResolvedValue([makeWebhookRow()]);
      await service.delete('ws-1', 'wh-1');
      expect(prisma.$executeRaw).toHaveBeenCalledOnce();
    });

    it('should throw NotFoundException when webhook not found', async () => {
      vi.mocked(prisma.$queryRaw!).mockResolvedValue([]);
      await expect(service.delete('ws-1', 'wh-1')).rejects.toThrow(NotFoundException);
    });

    it('should not call $executeRaw when webhook not found', async () => {
      vi.mocked(prisma.$queryRaw!).mockResolvedValue([]);
      await expect(service.delete('ws-1', 'wh-1')).rejects.toThrow();
      expect(prisma.$executeRaw).not.toHaveBeenCalled();
    });
  });

  // ── dispatchEvent ──────────────────────────────────────────────────────────

  describe('dispatchEvent', () => {
    it('should enqueue a job for each matching webhook', async () => {
      // First call: find matching webhooks
      // Second call: insert delivery record
      vi.mocked(prisma.$queryRaw!)
        .mockResolvedValueOnce([makeWebhookRow()])
        .mockResolvedValueOnce([{ id: 'del-1' }]);

      await service.dispatchEvent('ws-1', WebhookEvent.NOTE_CREATED, { noteId: 'n1' });

      expect(jobsService.enqueueDeliverWebhook).toHaveBeenCalledOnce();
    });

    it('should pass event and payload to enqueueDeliverWebhook', async () => {
      vi.mocked(prisma.$queryRaw!)
        .mockResolvedValueOnce([makeWebhookRow()])
        .mockResolvedValueOnce([{ id: 'del-1' }]);

      await service.dispatchEvent('ws-1', WebhookEvent.NOTE_UPDATED, { noteId: 'n2' });

      const callArg = vi.mocked(jobsService.enqueueDeliverWebhook!).mock.calls[0]?.[0];
      expect(callArg?.event).toBe(WebhookEvent.NOTE_UPDATED);
      expect(callArg?.webhookId).toBe('wh-1');
    });

    it('should not enqueue when no webhooks match', async () => {
      vi.mocked(prisma.$queryRaw!).mockResolvedValue([]);

      await service.dispatchEvent('ws-1', WebhookEvent.NOTE_DELETED, {});

      expect(jobsService.enqueueDeliverWebhook).not.toHaveBeenCalled();
    });

    it('should enqueue for multiple matching webhooks', async () => {
      vi.mocked(prisma.$queryRaw!)
        .mockResolvedValueOnce([makeWebhookRow({ id: 'wh-1' }), makeWebhookRow({ id: 'wh-2' })])
        .mockResolvedValueOnce([{ id: 'del-1' }])
        .mockResolvedValueOnce([{ id: 'del-2' }]);

      await service.dispatchEvent('ws-1', WebhookEvent.NOTE_CREATED, {});

      expect(jobsService.enqueueDeliverWebhook).toHaveBeenCalledTimes(2);
    });

    it('should include HMAC signature in payload', async () => {
      vi.mocked(prisma.$queryRaw!)
        .mockResolvedValueOnce([makeWebhookRow({ secret_hash: 'test-hash' })])
        .mockResolvedValueOnce([{ id: 'del-1' }]);

      await service.dispatchEvent('ws-1', WebhookEvent.NOTE_CREATED, { noteId: 'n1' });

      const callArg = vi.mocked(jobsService.enqueueDeliverWebhook!).mock.calls[0]?.[0];
      expect(callArg?.payload._signature).toMatch(/^sha256=[0-9a-f]{64}$/);
    });

    it('should include triggeredAt ISO timestamp', async () => {
      vi.mocked(prisma.$queryRaw!)
        .mockResolvedValueOnce([makeWebhookRow()])
        .mockResolvedValueOnce([{ id: 'del-1' }]);

      await service.dispatchEvent('ws-1', WebhookEvent.NOTE_PUBLISHED, {});

      const callArg = vi.mocked(jobsService.enqueueDeliverWebhook!).mock.calls[0]?.[0];
      expect(callArg?.triggeredAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should include deliveryId in payload', async () => {
      vi.mocked(prisma.$queryRaw!)
        .mockResolvedValueOnce([makeWebhookRow()])
        .mockResolvedValueOnce([{ id: 'del-999' }]);

      await service.dispatchEvent('ws-1', WebhookEvent.NOTE_CREATED, {});

      const callArg = vi.mocked(jobsService.enqueueDeliverWebhook!).mock.calls[0]?.[0];
      expect(callArg?.payload._deliveryId).toBe('del-999');
    });
  });

  // ── listDeliveries ─────────────────────────────────────────────────────────

  describe('listDeliveries', () => {
    it('should return delivery records for valid webhook', async () => {
      vi.mocked(prisma.$queryRaw!)
        .mockResolvedValueOnce([{ id: 'wh-1' }]) // webhook existence check
        .mockResolvedValueOnce([makeDeliveryRow(), makeDeliveryRow({ id: 'del-2' })]);

      const result = await service.listDeliveries('ws-1', 'wh-1');
      expect(result).toHaveLength(2);
    });

    it('should throw NotFoundException for unknown webhook', async () => {
      vi.mocked(prisma.$queryRaw!).mockResolvedValue([]);
      await expect(service.listDeliveries('ws-1', 'wh-99')).rejects.toThrow(NotFoundException);
    });

    it('should cap limit at 200', async () => {
      vi.mocked(prisma.$queryRaw!)
        .mockResolvedValueOnce([{ id: 'wh-1' }])
        .mockResolvedValueOnce([]);

      await service.listDeliveries('ws-1', 'wh-1', 9999);

      const deliveryCall = vi.mocked(prisma.$queryRaw!).mock.calls[1];
      // The LIMIT parameter should be 200, not 9999
      expect(JSON.stringify(deliveryCall)).toContain('200');
    });

    it('should correctly map delivery status fields', async () => {
      const delivered = new Date('2025-06-01T12:00:00Z');
      vi.mocked(prisma.$queryRaw!)
        .mockResolvedValueOnce([{ id: 'wh-1' }])
        .mockResolvedValueOnce([
          makeDeliveryRow({
            status_code: 200,
            success: true,
            attempts: 1,
            delivered_at: delivered,
          }),
        ]);

      const result = await service.listDeliveries('ws-1', 'wh-1');
      expect(result[0].statusCode).toBe(200);
      expect(result[0].success).toBe(true);
      expect(result[0].attempts).toBe(1);
      expect(result[0].deliveredAt).toBe(delivered.toISOString());
    });

    it('should handle null status_code for pending deliveries', async () => {
      vi.mocked(prisma.$queryRaw!)
        .mockResolvedValueOnce([{ id: 'wh-1' }])
        .mockResolvedValueOnce([makeDeliveryRow({ status_code: null })]);

      const result = await service.listDeliveries('ws-1', 'wh-1');
      expect(result[0].statusCode).toBeNull();
    });
  });

  // ── recordDeliveryAttempt ──────────────────────────────────────────────────

  describe('recordDeliveryAttempt', () => {
    it('should update the delivery record on success', async () => {
      await service.recordDeliveryAttempt('del-1', 200, true);
      expect(prisma.$executeRaw).toHaveBeenCalledOnce();
    });

    it('should update the delivery record on failure', async () => {
      await service.recordDeliveryAttempt('del-1', 503, false);
      expect(prisma.$executeRaw).toHaveBeenCalledOnce();
    });

    it('should handle null statusCode (network failure)', async () => {
      await service.recordDeliveryAttempt('del-1', null, false);
      expect(prisma.$executeRaw).toHaveBeenCalledOnce();
    });

    it('should propagate DB errors', async () => {
      vi.mocked(prisma.$executeRaw!).mockRejectedValue(new Error('DB error'));
      await expect(service.recordDeliveryAttempt('del-1', 200, true)).rejects.toThrow('DB error');
    });
  });
});
