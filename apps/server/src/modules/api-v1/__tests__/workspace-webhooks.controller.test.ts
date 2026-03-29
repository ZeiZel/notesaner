import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { WorkspaceWebhooksController } from '../workspace-webhooks.controller';
import { WebhookEvent } from '../dto/create-webhook.dto';
import type { WebhookService } from '../webhook.service';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const WS_ID = 'ws-test-1';
const WH_ID = 'wh-test-1';

function makeWebhookDto(overrides: Record<string, unknown> = {}) {
  return {
    id: WH_ID,
    workspaceId: WS_ID,
    url: 'https://example.com/hook',
    events: [WebhookEvent.NOTE_CREATED],
    isActive: true,
    failureCount: 0,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeWebhookWithStatsDto(overrides: Record<string, unknown> = {}) {
  return {
    ...makeWebhookDto(),
    deliveryStats: {
      totalDeliveries: 10,
      successfulDeliveries: 8,
      failedDeliveries: 2,
      lastDeliveryAt: '2025-06-01T12:00:00.000Z',
    },
    ...overrides,
  };
}

function makeDeliveryDto(overrides: Record<string, unknown> = {}) {
  return {
    id: 'del-1',
    webhookId: WH_ID,
    event: WebhookEvent.NOTE_CREATED,
    payload: { noteId: 'n1' },
    statusCode: 200,
    responseTimeMs: 150,
    success: true,
    attempts: 1,
    deliveredAt: '2025-06-01T12:00:00.000Z',
    createdAt: '2025-06-01T12:00:00.000Z',
    ...overrides,
  };
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('WorkspaceWebhooksController', () => {
  let controller: WorkspaceWebhooksController;
  let webhookService: Partial<WebhookService>;

  beforeEach(() => {
    vi.clearAllMocks();

    webhookService = {
      create: vi.fn(),
      list: vi.fn(),
      findById: vi.fn(),
      findByIdWithStats: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      sendTestEvent: vi.fn(),
      listDeliveries: vi.fn(),
    } as unknown as Partial<WebhookService>;

    controller = new WorkspaceWebhooksController(webhookService as WebhookService);
  });

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create a webhook and return it with the raw secret', async () => {
      const expected = { ...makeWebhookDto(), secret: 'raw-secret-value' };
      vi.mocked(webhookService.create!).mockResolvedValue(expected);

      const result = await controller.create(WS_ID, {
        url: 'https://example.com/hook',
        events: [WebhookEvent.NOTE_CREATED],
      });

      expect(result).toEqual(expected);
      expect(webhookService.create).toHaveBeenCalledWith(WS_ID, {
        url: 'https://example.com/hook',
        events: [WebhookEvent.NOTE_CREATED],
      });
    });

    it('should pass through the optional secret when provided', async () => {
      const dto = {
        url: 'https://example.com/hook',
        events: [WebhookEvent.NOTE_UPDATED],
        secret: '1234567890abcdef1234567890abcdef',
      };
      vi.mocked(webhookService.create!).mockResolvedValue({
        ...makeWebhookDto(),
        secret: dto.secret,
      });

      await controller.create(WS_ID, dto);

      expect(webhookService.create).toHaveBeenCalledWith(WS_ID, dto);
    });

    it('should propagate BadRequestException when limit is reached', async () => {
      const { BadRequestException } = await import('@nestjs/common');
      vi.mocked(webhookService.create!).mockRejectedValue(
        new BadRequestException('Maximum of 10 active webhooks per workspace reached'),
      );

      await expect(
        controller.create(WS_ID, {
          url: 'https://example.com/hook',
          events: [WebhookEvent.NOTE_CREATED],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── list ───────────────────────────────────────────────────────────────────

  describe('list', () => {
    it('should return an array of webhooks for the workspace', async () => {
      const expected = [makeWebhookDto({ id: 'wh-1' }), makeWebhookDto({ id: 'wh-2' })];
      vi.mocked(webhookService.list!).mockResolvedValue(expected);

      const result = await controller.list(WS_ID);

      expect(result).toHaveLength(2);
      expect(webhookService.list).toHaveBeenCalledWith(WS_ID);
    });

    it('should return an empty array when no webhooks exist', async () => {
      vi.mocked(webhookService.list!).mockResolvedValue([]);

      const result = await controller.list(WS_ID);

      expect(result).toEqual([]);
    });
  });

  // ── findOne ────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return webhook with delivery stats', async () => {
      const expected = makeWebhookWithStatsDto();
      vi.mocked(webhookService.findByIdWithStats!).mockResolvedValue(expected);

      const result = await controller.findOne(WS_ID, WH_ID);

      expect(result).toEqual(expected);
      expect(result.deliveryStats.totalDeliveries).toBe(10);
      expect(result.deliveryStats.successfulDeliveries).toBe(8);
      expect(result.deliveryStats.failedDeliveries).toBe(2);
      expect(webhookService.findByIdWithStats).toHaveBeenCalledWith(WS_ID, WH_ID);
    });

    it('should propagate NotFoundException for unknown webhook', async () => {
      vi.mocked(webhookService.findByIdWithStats!).mockRejectedValue(
        new NotFoundException('Webhook not found'),
      );

      await expect(controller.findOne(WS_ID, 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should propagate NotFoundException for wrong workspace', async () => {
      vi.mocked(webhookService.findByIdWithStats!).mockRejectedValue(
        new NotFoundException('Webhook not found'),
      );

      await expect(controller.findOne('wrong-ws', WH_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should update URL and return the updated webhook', async () => {
      const updated = makeWebhookDto({ url: 'https://new-endpoint.com/hook' });
      vi.mocked(webhookService.update!).mockResolvedValue(updated);

      const result = await controller.update(WS_ID, WH_ID, {
        url: 'https://new-endpoint.com/hook',
      });

      expect(result.url).toBe('https://new-endpoint.com/hook');
      expect(webhookService.update).toHaveBeenCalledWith(WS_ID, WH_ID, {
        url: 'https://new-endpoint.com/hook',
      });
    });

    it('should update events list', async () => {
      const updated = makeWebhookDto({
        events: [WebhookEvent.NOTE_CREATED, WebhookEvent.NOTE_DELETED],
      });
      vi.mocked(webhookService.update!).mockResolvedValue(updated);

      const result = await controller.update(WS_ID, WH_ID, {
        events: [WebhookEvent.NOTE_CREATED, WebhookEvent.NOTE_DELETED],
      });

      expect(result.events).toContain(WebhookEvent.NOTE_DELETED);
    });

    it('should disable a webhook (active=false)', async () => {
      const updated = makeWebhookDto({ isActive: false });
      vi.mocked(webhookService.update!).mockResolvedValue(updated);

      const result = await controller.update(WS_ID, WH_ID, { active: false });

      expect(result.isActive).toBe(false);
    });

    it('should re-enable a webhook (active=true)', async () => {
      const updated = makeWebhookDto({ isActive: true, failureCount: 0 });
      vi.mocked(webhookService.update!).mockResolvedValue(updated);

      const result = await controller.update(WS_ID, WH_ID, { active: true });

      expect(result.isActive).toBe(true);
      expect(result.failureCount).toBe(0);
    });

    it('should propagate NotFoundException for unknown webhook', async () => {
      vi.mocked(webhookService.update!).mockRejectedValue(
        new NotFoundException('Webhook not found'),
      );

      await expect(
        controller.update(WS_ID, 'nonexistent', { url: 'https://example.com/hook' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── delete ─────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('should call webhookService.delete with correct params', async () => {
      vi.mocked(webhookService.delete!).mockResolvedValue(undefined);

      await controller.delete(WS_ID, WH_ID);

      expect(webhookService.delete).toHaveBeenCalledWith(WS_ID, WH_ID);
    });

    it('should propagate NotFoundException for unknown webhook', async () => {
      vi.mocked(webhookService.delete!).mockRejectedValue(
        new NotFoundException('Webhook not found'),
      );

      await expect(controller.delete(WS_ID, 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should not return a body (void return for 204)', async () => {
      vi.mocked(webhookService.delete!).mockResolvedValue(undefined);

      const result = await controller.delete(WS_ID, WH_ID);

      expect(result).toBeUndefined();
    });
  });

  // ── sendTest ───────────────────────────────────────────────────────────────

  describe('sendTest', () => {
    it('should return deliveryId and message', async () => {
      vi.mocked(webhookService.sendTestEvent!).mockResolvedValue({ deliveryId: 'del-test-1' });

      const result = await controller.sendTest(WS_ID, WH_ID);

      expect(result.deliveryId).toBe('del-test-1');
      expect(result.message).toContain('enqueued');
      expect(webhookService.sendTestEvent).toHaveBeenCalledWith(WS_ID, WH_ID);
    });

    it('should propagate NotFoundException for unknown webhook', async () => {
      vi.mocked(webhookService.sendTestEvent!).mockRejectedValue(
        new NotFoundException('Webhook not found'),
      );

      await expect(controller.sendTest(WS_ID, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ── listDeliveries ─────────────────────────────────────────────────────────

  describe('listDeliveries', () => {
    it('should return delivery records', async () => {
      const expected = [makeDeliveryDto(), makeDeliveryDto({ id: 'del-2' })];
      vi.mocked(webhookService.listDeliveries!).mockResolvedValue(expected);

      const result = await controller.listDeliveries(WS_ID, WH_ID);

      expect(result).toHaveLength(2);
      expect(webhookService.listDeliveries).toHaveBeenCalledWith(WS_ID, WH_ID, undefined);
    });

    it('should pass parsed numeric limit to service', async () => {
      vi.mocked(webhookService.listDeliveries!).mockResolvedValue([]);

      await controller.listDeliveries(WS_ID, WH_ID, '50');

      expect(webhookService.listDeliveries).toHaveBeenCalledWith(WS_ID, WH_ID, 50);
    });

    it('should propagate NotFoundException for unknown webhook', async () => {
      vi.mocked(webhookService.listDeliveries!).mockRejectedValue(
        new NotFoundException('Webhook not found'),
      );

      await expect(controller.listDeliveries(WS_ID, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return empty array for webhook with no deliveries', async () => {
      vi.mocked(webhookService.listDeliveries!).mockResolvedValue([]);

      const result = await controller.listDeliveries(WS_ID, WH_ID);

      expect(result).toEqual([]);
    });
  });
});
