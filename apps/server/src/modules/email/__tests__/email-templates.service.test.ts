/**
 * Tests for EmailTemplatesService
 *
 * Verifies template loading, section parsing, rendering, layout injection,
 * variable enrichment, and error handling for all five .hbs templates.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  EmailTemplatesService,
  HbsTemplateName,
  RenderedEmail,
} from '../templates/email-templates.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Creates an EmailTemplatesService and runs onModuleInit() to load templates.
 */
function createService(): EmailTemplatesService {
  const service = new EmailTemplatesService();
  service.onModuleInit();
  return service;
}

// ─── Module initialisation ────────────────────────────────────────────────────

describe('EmailTemplatesService — onModuleInit', () => {
  it('loads all five templates without throwing', () => {
    expect(() => createService()).not.toThrow();
  });

  it('marks all five templates as loaded after init', () => {
    const service = createService();
    const expected: HbsTemplateName[] = [
      'welcome',
      'password-reset',
      'notification-digest',
      'comment-mention',
      'share-invite',
    ];
    for (const name of expected) {
      expect(service.isLoaded(name), `Expected "${name}" to be loaded`).toBe(true);
    }
  });

  it('listLoaded() returns all five template names', () => {
    const service = createService();
    const loaded = service.listLoaded();
    expect(loaded).toHaveLength(5);
    expect(loaded).toContain('welcome');
    expect(loaded).toContain('password-reset');
    expect(loaded).toContain('notification-digest');
    expect(loaded).toContain('comment-mention');
    expect(loaded).toContain('share-invite');
  });
});

// ─── welcome template ─────────────────────────────────────────────────────────

describe('EmailTemplatesService.render — welcome', () => {
  let service: EmailTemplatesService;
  let rendered: RenderedEmail;

  beforeEach(() => {
    service = createService();
    rendered = service.render(
      'welcome',
      {
        displayName: 'Alice',
        appUrl: 'https://app.notesaner.io',
      },
      'alice@example.com',
    );
  });

  it('renders a non-empty subject', () => {
    expect(rendered.subject).toBeTruthy();
    expect(rendered.subject.length).toBeGreaterThan(5);
  });

  it('includes display name in the subject', () => {
    expect(rendered.subject).toContain('Alice');
  });

  it('renders a full HTML document', () => {
    expect(rendered.html).toContain('<!DOCTYPE html>');
    expect(rendered.html).toContain('</html>');
  });

  it('includes display name in the HTML body', () => {
    expect(rendered.html).toContain('Alice');
  });

  it('includes the app URL in the HTML body', () => {
    expect(rendered.html).toContain('https://app.notesaner.io');
  });

  it('injects the recipient email into the layout footer', () => {
    expect(rendered.html).toContain('alice@example.com');
  });

  it('injects the current year into the layout footer', () => {
    expect(rendered.html).toContain(String(new Date().getFullYear()));
  });

  it('renders a non-empty plain-text body', () => {
    expect(rendered.text).toBeTruthy();
  });

  it('includes the app URL in the plain-text body', () => {
    expect(rendered.text).toContain('https://app.notesaner.io');
  });

  it('does not contain raw {{!-- comment --}} markers in output', () => {
    expect(rendered.subject).not.toMatch(/\{\{!--/);
    expect(rendered.html).not.toMatch(/\{\{!--/);
    expect(rendered.text).not.toMatch(/\{\{!--/);
  });
});

// ─── password-reset template ──────────────────────────────────────────────────

describe('EmailTemplatesService.render — password-reset', () => {
  let service: EmailTemplatesService;
  let rendered: RenderedEmail;

  beforeEach(() => {
    service = createService();
    rendered = service.render(
      'password-reset',
      {
        displayName: 'Bob',
        resetUrl: 'https://app.notesaner.io/reset?token=xyz789',
        expiryMinutes: 30,
      },
      'bob@example.com',
    );
  });

  it('renders subject mentioning password reset', () => {
    expect(rendered.subject.toLowerCase()).toContain('password');
  });

  it('includes the reset URL in the HTML body', () => {
    expect(rendered.html).toContain('https://app.notesaner.io/reset?token=xyz789');
  });

  it('includes expiry minutes in the HTML body', () => {
    expect(rendered.html).toContain('30');
  });

  it('includes display name in the HTML body', () => {
    expect(rendered.html).toContain('Bob');
  });

  it('includes the reset URL in the plain-text body', () => {
    expect(rendered.text).toContain('https://app.notesaner.io/reset?token=xyz789');
  });

  it('injects recipient email into HTML footer', () => {
    expect(rendered.html).toContain('bob@example.com');
  });
});

// ─── notification-digest template ─────────────────────────────────────────────

describe('EmailTemplatesService.render — notification-digest', () => {
  let service: EmailTemplatesService;

  const notifications = [
    { title: 'Mentioned', body: 'Alice mentioned you', createdAt: '2026-03-28T08:00:00Z' },
    { title: 'Shared', body: 'Bob shared a note', createdAt: '2026-03-27T10:00:00Z' },
  ];

  beforeEach(() => {
    service = createService();
  });

  it('renders a daily digest subject with notification count', () => {
    const rendered = service.render(
      'notification-digest',
      {
        displayName: 'Carol',
        periodLabel: 'daily',
        notificationCount: 2,
        notifications,
        appUrl: '#',
      },
      'carol@example.com',
    );
    expect(rendered.subject).toContain('daily');
    expect(rendered.subject).toContain('2');
  });

  it('renders all notification titles in the HTML body', () => {
    const rendered = service.render(
      'notification-digest',
      {
        displayName: 'Carol',
        periodLabel: 'daily',
        notificationCount: 2,
        notifications,
        appUrl: '#',
      },
      'carol@example.com',
    );
    expect(rendered.html).toContain('Mentioned');
    expect(rendered.html).toContain('Shared');
  });

  it('renders all notification titles in the plain-text body', () => {
    const rendered = service.render(
      'notification-digest',
      {
        displayName: 'Carol',
        periodLabel: 'daily',
        notificationCount: 2,
        notifications,
        appUrl: '#',
      },
      'carol@example.com',
    );
    expect(rendered.text).toContain('Mentioned');
    expect(rendered.text).toContain('Shared');
  });

  it('renders weekly period label', () => {
    const rendered = service.render(
      'notification-digest',
      {
        displayName: 'Dave',
        periodLabel: 'weekly',
        notificationCount: 5,
        notifications,
        appUrl: 'https://app.notesaner.io',
      },
      'dave@example.com',
    );
    expect(rendered.subject).toContain('weekly');
    expect(rendered.html).toContain('weekly');
  });

  it('renders empty notification list without error', () => {
    const rendered = service.render(
      'notification-digest',
      {
        displayName: 'Empty',
        periodLabel: 'daily',
        notificationCount: 0,
        notifications: [],
        appUrl: '#',
      },
      'empty@example.com',
    );
    expect(rendered.html).toContain('<!DOCTYPE html>');
    expect(rendered.text).toBeTruthy();
  });
});

// ─── comment-mention template ─────────────────────────────────────────────────

describe('EmailTemplatesService.render — comment-mention', () => {
  let service: EmailTemplatesService;
  let rendered: RenderedEmail;

  beforeEach(() => {
    service = createService();
    rendered = service.render(
      'comment-mention',
      {
        displayName: 'Eve',
        mentionedByName: 'Frank',
        noteTitle: 'Q4 Planning',
        commentPreview: '@Eve great point about the budget!',
        noteUrl: 'https://app.notesaner.io/notes/42#comment-5',
        workspaceName: 'Finance Team',
      },
      'eve@example.com',
    );
  });

  it('includes mention author and note title in the subject', () => {
    expect(rendered.subject).toContain('Frank');
    expect(rendered.subject).toContain('Q4 Planning');
  });

  it('includes mention author in the HTML body', () => {
    expect(rendered.html).toContain('Frank');
  });

  it('includes note title in the HTML body', () => {
    expect(rendered.html).toContain('Q4 Planning');
  });

  it('includes note URL in the HTML body', () => {
    expect(rendered.html).toContain('https://app.notesaner.io/notes/42#comment-5');
  });

  it('includes workspace name in the HTML body when provided', () => {
    expect(rendered.html).toContain('Finance Team');
  });

  it('omits workspace section when workspaceName is empty', () => {
    const noWs = service.render(
      'comment-mention',
      {
        displayName: 'Eve',
        mentionedByName: 'Frank',
        noteTitle: 'Q4 Planning',
        commentPreview: 'hello',
        noteUrl: 'https://app.notesaner.io/notes/42',
        workspaceName: '',
      },
      'eve@example.com',
    );
    expect(noWs.html).not.toContain('In workspace:');
  });

  it('includes note URL in the plain-text body', () => {
    expect(rendered.text).toContain('https://app.notesaner.io/notes/42#comment-5');
  });
});

// ─── share-invite template ────────────────────────────────────────────────────

describe('EmailTemplatesService.render — share-invite', () => {
  let service: EmailTemplatesService;

  beforeEach(() => {
    service = createService();
  });

  it('includes inviter name and note title in the subject', () => {
    const rendered = service.render(
      'share-invite',
      {
        displayName: 'Grace',
        inviterName: 'Henry',
        noteTitle: 'Product Roadmap',
        noteUrl: 'https://app.notesaner.io/notes/99',
        workspaceName: 'Design Team',
        permission: 'view',
      },
      'grace@example.com',
    );
    expect(rendered.subject).toContain('Henry');
    expect(rendered.subject).toContain('Product Roadmap');
  });

  it('includes note URL in the HTML body', () => {
    const rendered = service.render(
      'share-invite',
      {
        displayName: 'Grace',
        inviterName: 'Henry',
        noteTitle: 'Product Roadmap',
        noteUrl: 'https://app.notesaner.io/notes/99',
        permission: 'view',
      },
      'grace@example.com',
    );
    expect(rendered.html).toContain('https://app.notesaner.io/notes/99');
  });

  it('renders optional message when provided', () => {
    const rendered = service.render(
      'share-invite',
      {
        displayName: 'Grace',
        inviterName: 'Henry',
        noteTitle: 'Roadmap',
        noteUrl: 'https://app.notesaner.io/notes/99',
        permission: 'edit',
        message: 'Check out these plans!',
      },
      'grace@example.com',
    );
    expect(rendered.html).toContain('Check out these plans!');
    expect(rendered.text).toContain('Check out these plans!');
  });

  it('omits message section when message is not provided', () => {
    const rendered = service.render(
      'share-invite',
      {
        displayName: 'Grace',
        inviterName: 'Henry',
        noteTitle: 'Roadmap',
        noteUrl: 'https://app.notesaner.io/notes/99',
        permission: 'view',
      },
      'grace@example.com',
    );
    // The {{#if message}} block should not render
    expect(rendered.html).not.toContain('Message from Henry');
  });

  it('includes permission level in the HTML body', () => {
    const rendered = service.render(
      'share-invite',
      {
        displayName: 'Grace',
        inviterName: 'Henry',
        noteTitle: 'Roadmap',
        noteUrl: 'https://app.notesaner.io/notes/99',
        permission: 'edit',
      },
      'grace@example.com',
    );
    expect(rendered.html).toContain('edit');
  });

  it('includes note URL in the plain-text body', () => {
    const rendered = service.render(
      'share-invite',
      {
        displayName: 'Grace',
        inviterName: 'Henry',
        noteTitle: 'Roadmap',
        noteUrl: 'https://app.notesaner.io/notes/99',
        permission: 'view',
      },
      'grace@example.com',
    );
    expect(rendered.text).toContain('https://app.notesaner.io/notes/99');
  });
});

// ─── Error handling ───────────────────────────────────────────────────────────

describe('EmailTemplatesService — error handling', () => {
  it('throws an informative error for an unloaded template name', () => {
    const service = createService();
    expect(() => service.render('nonexistent' as HbsTemplateName, {})).toThrow(/not loaded/i);
  });

  it('includes available template names in the error message', () => {
    const service = createService();
    let errorMessage = '';
    try {
      service.render('nonexistent' as HbsTemplateName, {});
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : '';
    }
    expect(errorMessage).toContain('welcome');
  });
});

// ─── Variable enrichment ──────────────────────────────────────────────────────

describe('EmailTemplatesService — variable enrichment', () => {
  it('automatically injects the current year if not provided', () => {
    const service = createService();
    const rendered = service.render(
      'welcome',
      { displayName: 'Alice', appUrl: 'https://app.notesaner.io' },
      'alice@example.com',
    );
    expect(rendered.html).toContain(String(new Date().getFullYear()));
  });

  it('allows callers to override the year variable', () => {
    const service = createService();
    const rendered = service.render(
      'welcome',
      { displayName: 'Alice', appUrl: 'https://app.notesaner.io', year: 2099 },
      'alice@example.com',
    );
    expect(rendered.html).toContain('2099');
  });

  it('injects recipientEmail from the to argument', () => {
    const service = createService();
    const rendered = service.render(
      'welcome',
      { displayName: 'Alice', appUrl: 'https://app.notesaner.io' },
      'alice@custom.example.com',
    );
    expect(rendered.html).toContain('alice@custom.example.com');
  });

  it('renders correctly when to argument is omitted', () => {
    const service = createService();
    // Should not throw even without to
    expect(() =>
      service.render('welcome', { displayName: 'Alice', appUrl: 'https://app.notesaner.io' }),
    ).not.toThrow();
  });
});

// ─── reload ───────────────────────────────────────────────────────────────────

describe('EmailTemplatesService.reload', () => {
  it('reloads a template without changing the rendered output', () => {
    const service = createService();

    const before = service.render(
      'welcome',
      { displayName: 'Alice', appUrl: 'https://app.notesaner.io' },
      'alice@example.com',
    );

    service.reload('welcome');

    const after = service.render(
      'welcome',
      { displayName: 'Alice', appUrl: 'https://app.notesaner.io' },
      'alice@example.com',
    );

    expect(after.subject).toBe(before.subject);
    expect(after.text).toBe(before.text);
  });
});
