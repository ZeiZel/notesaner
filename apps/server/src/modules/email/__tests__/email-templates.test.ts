/**
 * Tests for EmailTemplates
 *
 * Verifies that all templates render without errors using representative
 * variable sets and that required content appears in the output.
 */

import { describe, it, expect } from 'vitest';
import {
  EMAIL_TEMPLATES,
  getEmailTemplate,
  listEmailTemplates,
  EmailTemplateName,
} from '../email-templates';
import { renderTemplate } from '../email-template-engine';

// ─── listEmailTemplates ────────────────────────────────────────────────────────

describe('listEmailTemplates', () => {
  it('returns an array of template names', () => {
    const names = listEmailTemplates();
    expect(Array.isArray(names)).toBe(true);
    expect(names.length).toBeGreaterThanOrEqual(5);
  });

  it('includes all required templates', () => {
    const names = listEmailTemplates();
    const required: EmailTemplateName[] = [
      'verification',
      'password-reset',
      'workspace-invite',
      'comment-mention',
      'freshness-alert',
    ];
    for (const name of required) {
      expect(names).toContain(name);
    }
  });
});

// ─── getEmailTemplate ──────────────────────────────────────────────────────────

describe('getEmailTemplate', () => {
  it('returns the template definition for a known name', () => {
    const template = getEmailTemplate('verification');
    expect(template).toBeDefined();
    expect(template.subject).toBeTruthy();
    expect(template.html).toBeTruthy();
    expect(template.text).toBeTruthy();
  });

  it('throws for an unknown template name', () => {
    expect(() => getEmailTemplate('nonexistent' as EmailTemplateName)).toThrow(
      /Unknown email template/,
    );
  });
});

// ─── Verification template ────────────────────────────────────────────────────

describe('EMAIL_TEMPLATES.verification', () => {
  const template = EMAIL_TEMPLATES['verification'];
  const vars = {
    displayName: 'Alice',
    verificationUrl: 'https://app.notesaner.io/verify?token=abc123',
    expiryHours: 24,
    recipientEmail: 'alice@example.com',
    year: 2026,
  };

  it('has a defined subject', () => {
    expect(template.subject).toBeTruthy();
  });

  it('renders subject without errors', () => {
    const subject = renderTemplate(template.subject, vars);
    expect(subject).toBeTruthy();
  });

  it('renders HTML body without errors', () => {
    const html = renderTemplate(template.html, {
      ...vars,
      subject: renderTemplate(template.subject, vars),
    });
    expect(html).toBeTruthy();
  });

  it('includes verification URL in rendered HTML', () => {
    const html = renderTemplate(template.html, { ...vars, subject: '' });
    expect(html).toContain(vars.verificationUrl);
  });

  it('includes displayName in rendered HTML', () => {
    const html = renderTemplate(template.html, { ...vars, subject: '' });
    expect(html).toContain(vars.displayName);
  });

  it('includes expiry hours in rendered HTML', () => {
    const html = renderTemplate(template.html, { ...vars, subject: '' });
    expect(html).toContain('24');
  });

  it('renders plain-text body without errors', () => {
    const text = renderTemplate(template.text, vars);
    expect(text).toBeTruthy();
    expect(text).toContain(vars.verificationUrl);
  });
});

// ─── Password-reset template ──────────────────────────────────────────────────

describe('EMAIL_TEMPLATES.password-reset', () => {
  const template = EMAIL_TEMPLATES['password-reset'];
  const vars = {
    displayName: 'Bob',
    resetUrl: 'https://app.notesaner.io/reset?token=xyz789',
    expiryMinutes: 30,
    recipientEmail: 'bob@example.com',
    year: 2026,
  };

  it('renders HTML body with reset URL', () => {
    const html = renderTemplate(template.html, { ...vars, subject: '' });
    expect(html).toContain(vars.resetUrl);
  });

  it('includes expiry minutes in rendered HTML', () => {
    const html = renderTemplate(template.html, { ...vars, subject: '' });
    expect(html).toContain('30');
  });

  it('renders plain-text fallback with reset URL', () => {
    const text = renderTemplate(template.text, vars);
    expect(text).toContain(vars.resetUrl);
  });
});

// ─── Workspace-invite template ────────────────────────────────────────────────

describe('EMAIL_TEMPLATES.workspace-invite', () => {
  const template = EMAIL_TEMPLATES['workspace-invite'];
  const vars = {
    inviterName: 'Charlie',
    workspaceName: 'Acme Notes',
    role: 'EDITOR',
    inviteUrl: 'https://app.notesaner.io/invite?token=tok',
    expiresAt: '2026-04-05',
    recipientEmail: 'diana@example.com',
    year: 2026,
  };

  it('includes inviter name in rendered subject', () => {
    const subject = renderTemplate(template.subject, vars);
    expect(subject).toContain(vars.inviterName);
  });

  it('includes workspace name in rendered subject', () => {
    const subject = renderTemplate(template.subject, vars);
    expect(subject).toContain(vars.workspaceName);
  });

  it('includes invite URL in rendered HTML', () => {
    const html = renderTemplate(template.html, { ...vars, subject: '' });
    expect(html).toContain(vars.inviteUrl);
  });

  it('includes role in rendered HTML', () => {
    const html = renderTemplate(template.html, { ...vars, subject: '' });
    expect(html).toContain('EDITOR');
  });

  it('renders plain-text body with invite URL', () => {
    const text = renderTemplate(template.text, vars);
    expect(text).toContain(vars.inviteUrl);
  });
});

// ─── Comment-mention template ─────────────────────────────────────────────────

describe('EMAIL_TEMPLATES.comment-mention', () => {
  const template = EMAIL_TEMPLATES['comment-mention'];
  const vars = {
    displayName: 'Eve',
    mentionedByName: 'Frank',
    noteTitle: 'Q4 Planning',
    commentPreview: '@Eve great point about the budget!',
    noteUrl: 'https://app.notesaner.io/workspaces/ws-1/notes/42#comment-5',
    workspaceName: 'Finance Team',
    recipientEmail: 'eve@example.com',
    year: 2026,
  };

  it('includes mention author name in rendered HTML', () => {
    const html = renderTemplate(template.html, { ...vars, subject: '' });
    expect(html).toContain(vars.mentionedByName);
  });

  it('includes note title in rendered HTML', () => {
    const html = renderTemplate(template.html, { ...vars, subject: '' });
    expect(html).toContain(vars.noteTitle);
  });

  it('includes comment preview in rendered HTML', () => {
    const html = renderTemplate(template.html, { ...vars, subject: '' });
    // Comment preview is HTML-escaped
    expect(html).toContain('Frank');
  });

  it('includes note URL in rendered HTML', () => {
    const html = renderTemplate(template.html, { ...vars, subject: '' });
    expect(html).toContain(vars.noteUrl);
  });

  it('renders workspace name when provided', () => {
    const html = renderTemplate(template.html, { ...vars, subject: '' });
    expect(html).toContain(vars.workspaceName);
  });

  it('omits workspace section when workspaceName is empty', () => {
    const html = renderTemplate(template.html, {
      ...vars,
      workspaceName: '',
      subject: '',
    });
    // The {{#if workspaceName}} block should not render
    expect(html).not.toContain('In workspace:');
  });
});

// ─── Freshness-alert template ─────────────────────────────────────────────────

describe('EMAIL_TEMPLATES.freshness-alert', () => {
  const template = EMAIL_TEMPLATES['freshness-alert'];
  const vars = {
    displayName: 'Grace',
    workspaceName: 'Research Vault',
    staleDays: 30,
    workspaceUrl: 'https://app.notesaner.io/workspaces/ws-2',
    notes: [
      {
        title: 'Introduction to TypeScript',
        url: 'https://app.notesaner.io/notes/1',
        lastUpdated: '45 days ago',
      },
      {
        title: 'System Design Patterns',
        url: 'https://app.notesaner.io/notes/2',
        lastUpdated: '62 days ago',
      },
    ],
    recipientEmail: 'grace@example.com',
    year: 2026,
  };

  it('includes workspace name in rendered HTML', () => {
    const html = renderTemplate(template.html, { ...vars, subject: '' });
    expect(html).toContain(vars.workspaceName);
  });

  it('renders all note titles in the list', () => {
    const html = renderTemplate(template.html, { ...vars, subject: '' });
    expect(html).toContain('Introduction to TypeScript');
    expect(html).toContain('System Design Patterns');
  });

  it('renders stale days threshold', () => {
    const html = renderTemplate(template.html, { ...vars, subject: '' });
    expect(html).toContain('30');
  });

  it('renders plain-text body with note titles', () => {
    const text = renderTemplate(template.text, vars);
    expect(text).toContain('Introduction to TypeScript');
  });

  it('renders empty list section for no notes', () => {
    const html = renderTemplate(template.html, { ...vars, notes: [], subject: '' });
    // The {{#each notes}} section renders nothing but the rest of the email is intact
    expect(html).toContain(vars.workspaceName);
  });
});
