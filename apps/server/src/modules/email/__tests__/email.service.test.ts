/**
 * Tests for EmailService
 *
 * Uses the TestTransport (wired automatically in 'test' NODE_ENV) so no
 * actual network I/O occurs. All tests are self-contained and fast.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmailService, createTestEmailService } from '../email.service';
import { TestTransport } from '../email-transport';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeService(configOverrides: Record<string, unknown> = {}) {
  const { service, transport } = createTestEmailService(configOverrides);
  return { service, transport };
}

// ─── Transport selection ──────────────────────────────────────────────────────

describe('EmailService — transport selection', () => {
  it('uses TestTransport in test environment', () => {
    const { service } = makeService();
    expect(service.getTransport()).toBeInstanceOf(TestTransport);
  });
});

// ─── send — happy paths ───────────────────────────────────────────────────────

describe('EmailService.send', () => {
  let service: EmailService;
  let transport: TestTransport;

  beforeEach(() => {
    ({ service, transport } = makeService());
  });

  it('delivers a verification email', async () => {
    await service.send({
      to: 'alice@example.com',
      template: 'verification',
      variables: {
        displayName: 'Alice',
        verificationUrl: 'https://example.com/verify?t=abc',
        expiryHours: 24,
      },
    });

    const sent = transport.getSentMessages();
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('alice@example.com');
  });

  it('delivers a password-reset email', async () => {
    await service.send({
      to: 'bob@example.com',
      template: 'password-reset',
      variables: {
        displayName: 'Bob',
        resetUrl: 'https://example.com/reset?t=xyz',
        expiryMinutes: 30,
      },
    });

    const sent = transport.getSentMessages();
    expect(sent[0].subject).toMatch(/password/i);
  });

  it('delivers a workspace-invite email', async () => {
    await service.send({
      to: 'charlie@example.com',
      template: 'workspace-invite',
      variables: {
        inviterName: 'Dave',
        workspaceName: 'Acme',
        role: 'EDITOR',
        inviteUrl: 'https://example.com/invite?t=tok',
        expiresAt: '2026-04-30',
      },
    });

    const sent = transport.getSentMessages();
    expect(sent[0].to).toBe('charlie@example.com');
  });

  it('delivers a comment-mention email', async () => {
    await service.send({
      to: 'eve@example.com',
      template: 'comment-mention',
      variables: {
        displayName: 'Eve',
        mentionedByName: 'Frank',
        noteTitle: 'Sprint Notes',
        commentPreview: '@Eve LGTM!',
        noteUrl: 'https://example.com/notes/1',
        workspaceName: 'Dev',
      },
    });

    const sent = transport.getSentMessages();
    expect(sent).toHaveLength(1);
  });

  it('delivers a freshness-alert email', async () => {
    await service.send({
      to: 'grace@example.com',
      template: 'freshness-alert',
      variables: {
        displayName: 'Grace',
        workspaceName: 'Personal',
        staleDays: 30,
        workspaceUrl: 'https://example.com/ws/1',
        notes: [
          { title: 'Old Note', url: 'https://example.com/notes/1', lastUpdated: '31 days ago' },
        ],
      },
    });

    const sent = transport.getSentMessages();
    expect(sent[0].html).toContain('Old Note');
  });

  it('injects recipientEmail into template variables', async () => {
    await service.send({
      to: 'alice@example.com',
      template: 'verification',
      variables: {
        displayName: 'Alice',
        verificationUrl: 'https://example.com/v',
        expiryHours: 24,
      },
    });

    const sent = transport.getSentMessages();
    expect(sent[0].html).toContain('alice@example.com');
  });

  it('injects current year into template variables', async () => {
    await service.send({
      to: 'alice@example.com',
      template: 'verification',
      variables: {
        displayName: 'Alice',
        verificationUrl: 'https://example.com/v',
        expiryHours: 24,
      },
    });

    const sent = transport.getSentMessages();
    expect(sent[0].html).toContain(String(new Date().getFullYear()));
  });

  it('includes a rendered subject line', async () => {
    await service.send({
      to: 'alice@example.com',
      template: 'verification',
      variables: {
        displayName: 'Alice',
        verificationUrl: 'https://example.com/v',
        expiryHours: 24,
      },
    });

    const sent = transport.getSentMessages();
    expect(sent[0].subject).toBeTruthy();
    expect(sent[0].subject.length).toBeGreaterThan(5);
  });

  it('sets the from field from config', async () => {
    const { service: svc, transport: t } = makeService({
      'email.fromAddress': 'custom@notesaner.io',
      'email.fromName': 'Custom Sender',
    });

    await svc.send({
      to: 'alice@example.com',
      template: 'verification',
      variables: { displayName: 'Alice', verificationUrl: 'https://x.com', expiryHours: 24 },
    });

    const sent = t.getSentMessages();
    expect(sent[0].from).toContain('custom@notesaner.io');
    expect(sent[0].from).toContain('Custom Sender');
  });

  it('does not throw for an unknown template (logs error and returns)', async () => {
    await expect(
      service.send({ to: 'x@y.com', template: 'nonexistent' as any }),
    ).resolves.toBeUndefined();

    // Nothing was sent
    expect(transport.getSentMessages()).toHaveLength(0);
  });

  it('still sends after transport.clear()', async () => {
    await service.send({
      to: 'alice@example.com',
      template: 'verification',
      variables: { displayName: 'Alice', verificationUrl: 'https://x.com', expiryHours: 24 },
    });
    transport.clear();

    await service.send({
      to: 'bob@example.com',
      template: 'verification',
      variables: { displayName: 'Bob', verificationUrl: 'https://x.com', expiryHours: 24 },
    });

    expect(transport.getSentMessages()).toHaveLength(1);
    expect(transport.getSentMessages()[0].to).toBe('bob@example.com');
  });
});

// ─── send — retry logic ────────────────────────────────────────────────────────

describe('EmailService.send — retry logic', () => {
  it('retries on transport failure and succeeds on second attempt', async () => {
    const { service, transport } = makeService();

    let callCount = 0;
    const originalSend = transport.send.bind(transport);
    vi.spyOn(transport, 'send').mockImplementation(async (msg) => {
      callCount++;
      if (callCount === 1) throw new Error('Temporary SMTP failure');
      return originalSend(msg);
    });

    // Suppress sleep for faster test
    vi.spyOn(service as any, 'sleep').mockResolvedValue(undefined);

    await service.send({
      to: 'alice@example.com',
      template: 'verification',
      variables: { displayName: 'Alice', verificationUrl: 'https://x.com', expiryHours: 24 },
    });

    expect(callCount).toBe(2);
    // Because the real send is only invoked on the 2nd call through our mock
    // after the first throws, and we re-bind to originalSend, transport's internal
    // array gets the message from the 2nd call.
  });

  it('attempts MAX_ATTEMPTS (3) times before giving up', async () => {
    const { service, transport } = makeService();

    let callCount = 0;
    vi.spyOn(transport, 'send').mockImplementation(async () => {
      callCount++;
      throw new Error('SMTP unavailable');
    });

    vi.spyOn(service as any, 'sleep').mockResolvedValue(undefined);

    await service.send({
      to: 'alice@example.com',
      template: 'verification',
      variables: { displayName: 'Alice', verificationUrl: 'https://x.com', expiryHours: 24 },
    });

    expect(callCount).toBe(3);
  });

  it('does not throw even when all retries fail', async () => {
    const { service, transport } = makeService();

    vi.spyOn(transport, 'send').mockRejectedValue(new Error('All attempts failed'));
    vi.spyOn(service as any, 'sleep').mockResolvedValue(undefined);

    await expect(
      service.send({
        to: 'alice@example.com',
        template: 'verification',
        variables: { displayName: 'Alice', verificationUrl: 'https://x.com', expiryHours: 24 },
      }),
    ).resolves.toBeUndefined();
  });

  it('logs a failed delivery entry after all retries exhausted', async () => {
    const { service, transport } = makeService();

    vi.spyOn(transport, 'send').mockRejectedValue(new Error('Connection refused'));
    vi.spyOn(service as any, 'sleep').mockResolvedValue(undefined);

    await service.send({
      to: 'alice@example.com',
      template: 'verification',
      variables: { displayName: 'Alice', verificationUrl: 'https://x.com', expiryHours: 24 },
    });

    const log = service.getDeliveryLog();
    expect(log[0].status).toBe('failed');
    expect(log[0].to).toBe('alice@example.com');
    expect(log[0].error).toContain('Connection refused');
  });
});

// ─── sendBulk ─────────────────────────────────────────────────────────────────

describe('EmailService.sendBulk', () => {
  let service: EmailService;
  let transport: TestTransport;

  beforeEach(() => {
    ({ service, transport } = makeService());
  });

  it('sends to all recipients', async () => {
    const recipients = ['alice@example.com', 'bob@example.com', 'charlie@example.com'];

    const result = await service.sendBulk({
      recipients,
      template: 'verification',
      variables: { displayName: 'User', verificationUrl: 'https://x.com', expiryHours: 24 },
    });

    expect(result.sent).toBe(3);
    expect(result.failed).toBe(0);
    expect(transport.getSentMessages()).toHaveLength(3);
  });

  it('applies per-recipient variable overrides', async () => {
    const result = await service.sendBulk({
      recipients: ['alice@example.com', 'bob@example.com'],
      template: 'verification',
      variables: { verificationUrl: 'https://x.com', expiryHours: 24 },
      perRecipientVariables: {
        'alice@example.com': { displayName: 'Alice' },
        'bob@example.com': { displayName: 'Bob' },
      },
    });

    expect(result.sent).toBe(2);

    const messages = transport.getSentMessages();
    const aliceMsg = messages.find((m) => m.to === 'alice@example.com');
    const bobMsg = messages.find((m) => m.to === 'bob@example.com');

    expect(aliceMsg?.html).toContain('Alice');
    expect(bobMsg?.html).toContain('Bob');
  });

  it('records delivery failures in the log when some sends fail', async () => {
    // Make transport throw for bad@example.com on all 3 retry attempts
    vi.spyOn(transport, 'send').mockImplementation(async (msg) => {
      if (msg.to === 'bad@example.com') throw new Error('Invalid address');
      return {
        messageId: '<test>',
        accepted: [msg.to],
        rejected: [],
      };
    });
    vi.spyOn(service as any, 'sleep').mockResolvedValue(undefined);

    // sendBulk calls service.send() which never throws (errors are swallowed).
    // Both recipients are "processed" from sendBulk's perspective.
    const result = await service.sendBulk({
      recipients: ['good@example.com', 'bad@example.com'],
      template: 'verification',
      variables: { displayName: 'User', verificationUrl: 'https://x.com', expiryHours: 24 },
    });

    // Neither call throws at the sendBulk level — both are "sent" attempts
    expect(result.sent).toBe(2);
    expect(result.failed).toBe(0);

    // But the delivery log records the bad address as failed
    const log = service.getDeliveryLog();
    const failedEntry = log.find((e) => e.to === 'bad@example.com');
    expect(failedEntry).toBeDefined();
    expect(failedEntry?.status).toBe('failed');
  });

  it('returns empty result for empty recipients list', async () => {
    const result = await service.sendBulk({
      recipients: [],
      template: 'verification',
    });

    expect(result.sent).toBe(0);
    expect(result.failed).toBe(0);
    expect(transport.getSentMessages()).toHaveLength(0);
  });
});

// ─── delivery log ─────────────────────────────────────────────────────────────

describe('EmailService — delivery log', () => {
  let service: EmailService;

  beforeEach(() => {
    ({ service } = makeService());
  });

  it('records a successful delivery log entry', async () => {
    await service.send({
      to: 'alice@example.com',
      template: 'verification',
      variables: { displayName: 'Alice', verificationUrl: 'https://x.com', expiryHours: 24 },
    });

    const log = service.getDeliveryLog();
    expect(log).toHaveLength(1);
    expect(log[0].status).toBe('sent');
    expect(log[0].to).toBe('alice@example.com');
    expect(log[0].template).toBe('verification');
    expect(log[0].messageId).toBeTruthy();
    expect(log[0].attempts).toBe(1);
    expect(log[0].sentAt).toBeInstanceOf(Date);
  });

  it('records a failed delivery log entry for unknown template', async () => {
    await service.send({ to: 'x@y.com', template: 'bad' as any });

    const log = service.getDeliveryLog();
    expect(log[0].status).toBe('failed');
    expect(log[0].error).toContain('Unknown template');
  });

  it('getDeliveryLogForRecipient filters by email', async () => {
    await service.send({
      to: 'alice@example.com',
      template: 'verification',
      variables: { displayName: 'Alice', verificationUrl: 'https://x.com', expiryHours: 24 },
    });
    await service.send({
      to: 'bob@example.com',
      template: 'verification',
      variables: { displayName: 'Bob', verificationUrl: 'https://x.com', expiryHours: 24 },
    });

    const aliceLog = service.getDeliveryLogForRecipient('alice@example.com');
    expect(aliceLog).toHaveLength(1);
    expect(aliceLog[0].to).toBe('alice@example.com');
  });

  it('clearDeliveryLog empties the log', async () => {
    await service.send({
      to: 'alice@example.com',
      template: 'verification',
      variables: { displayName: 'Alice', verificationUrl: 'https://x.com', expiryHours: 24 },
    });

    service.clearDeliveryLog();
    expect(service.getDeliveryLog()).toHaveLength(0);
  });

  it('getDeliveryLog respects limit parameter', async () => {
    for (let i = 0; i < 5; i++) {
      await service.send({
        to: `user${i}@example.com`,
        template: 'verification',
        variables: { displayName: `User${i}`, verificationUrl: 'https://x.com', expiryHours: 24 },
      });
    }

    const log = service.getDeliveryLog(3);
    expect(log).toHaveLength(3);
  });

  it('returns log entries newest-first', async () => {
    await service.send({
      to: 'first@example.com',
      template: 'verification',
      variables: { displayName: 'First', verificationUrl: 'https://x.com', expiryHours: 24 },
    });
    await service.send({
      to: 'last@example.com',
      template: 'verification',
      variables: { displayName: 'Last', verificationUrl: 'https://x.com', expiryHours: 24 },
    });

    const log = service.getDeliveryLog();
    expect(log[0].to).toBe('last@example.com');
    expect(log[1].to).toBe('first@example.com');
  });
});

// ─── createTestEmailService ────────────────────────────────────────────────────

describe('createTestEmailService', () => {
  it('returns a service and TestTransport', () => {
    const { service, transport } = createTestEmailService();
    expect(service).toBeInstanceOf(EmailService);
    expect(transport).toBeInstanceOf(TestTransport);
  });

  it('accepts config overrides', () => {
    const { service } = createTestEmailService({
      'email.fromAddress': 'override@notesaner.io',
    });
    expect(service).toBeDefined();
  });
});
