/**
 * EmailTemplates — definitions of all transactional email templates.
 *
 * Each template exposes:
 *   subject  — the email subject line (may contain {{variable}} tokens)
 *   html     — the full HTML body (may contain all engine syntax)
 *   text     — plain-text fallback body
 *
 * All templates use the Handlebars-style syntax processed by EmailTemplateEngine.
 */

export type EmailTemplateName =
  | 'verification'
  | 'password-reset'
  | 'workspace-invite'
  | 'comment-mention'
  | 'freshness-alert'
  | 'backup-failure'
  | 'notification-digest';

export interface EmailTemplateDefinition {
  subject: string;
  html: string;
  /** Plain-text fallback rendered for email clients that do not support HTML. */
  text: string;
}

// ─── Base layout ─────────────────────────────────────────────────────────────

/**
 * Wraps content in a minimal, accessible HTML email layout.
 * The {{content}} placeholder is replaced by each template's body HTML.
 */
const BASE_HTML_LAYOUT = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{{subject}}</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5; color: #1a1a1a; }
    .wrapper { max-width: 600px; margin: 0 auto; padding: 24px 16px; }
    .card { background: #ffffff; border-radius: 8px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
    .logo { font-size: 20px; font-weight: 700; color: #5b50f0; margin-bottom: 24px; }
    h1 { font-size: 22px; font-weight: 600; margin: 0 0 16px; color: #1a1a1a; }
    p { font-size: 15px; line-height: 1.6; margin: 0 0 16px; color: #4a4a4a; }
    .btn { display: inline-block; padding: 12px 24px; background-color: #5b50f0; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px; margin: 8px 0 16px; }
    .divider { border: none; border-top: 1px solid #e8e8e8; margin: 24px 0; }
    .footer { font-size: 12px; color: #9a9a9a; text-align: center; margin-top: 24px; }
    .muted { color: #9a9a9a; font-size: 13px; }
    .code { font-family: monospace; background: #f0f0f0; padding: 12px 16px; border-radius: 4px; font-size: 20px; letter-spacing: 4px; text-align: center; margin: 16px 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="logo">Notesaner</div>
      {{{content}}}
    </div>
    <div class="footer">
      <p>&copy; {{year}} Notesaner. All rights reserved.</p>
      <p class="muted">This email was sent to {{recipientEmail}}. If you did not request it, you can safely ignore it.</p>
    </div>
  </div>
</body>
</html>`;

// ─── Helper ───────────────────────────────────────────────────────────────────

function wrapInLayout(content: string): string {
  return BASE_HTML_LAYOUT.replace('{{{content}}}', content);
}

// ─── Template definitions ─────────────────────────────────────────────────────

export const EMAIL_TEMPLATES: Record<EmailTemplateName, EmailTemplateDefinition> = {
  // ── Email address verification ──────────────────────────────────────────────
  verification: {
    subject: 'Verify your Notesaner email address',
    html: wrapInLayout(`
      <h1>Verify your email address</h1>
      <p>Hi {{displayName}},</p>
      <p>Thanks for signing up for Notesaner! Please verify your email address to activate your account.</p>
      <a href="{{{verificationUrl}}}" class="btn">Verify email address</a>
      <p class="muted">Or copy and paste this link into your browser:</p>
      <p class="muted">{{{verificationUrl}}}</p>
      <hr class="divider" />
      <p class="muted">This link expires in {{expiryHours}} hours. If you did not create an account, you can safely ignore this email.</p>
    `),
    text: `Verify your Notesaner email address

Hi {{displayName}},

Thanks for signing up for Notesaner! Please verify your email address to activate your account.

Verification link: {{{verificationUrl}}}

This link expires in {{expiryHours}} hours. If you did not create an account, you can safely ignore this email.

— The Notesaner team
`,
  },

  // ── Password reset ──────────────────────────────────────────────────────────
  'password-reset': {
    subject: 'Reset your Notesaner password',
    html: wrapInLayout(`
      <h1>Reset your password</h1>
      <p>Hi {{displayName}},</p>
      <p>We received a request to reset the password for your Notesaner account. Click the button below to choose a new password.</p>
      <a href="{{{resetUrl}}}" class="btn">Reset password</a>
      <p class="muted">Or copy and paste this link into your browser:</p>
      <p class="muted">{{{resetUrl}}}</p>
      <hr class="divider" />
      <p class="muted">This link expires in {{expiryMinutes}} minutes. If you did not request a password reset, please ignore this email — your password will remain unchanged.</p>
    `),
    text: `Reset your Notesaner password

Hi {{displayName}},

We received a request to reset the password for your Notesaner account. Use the link below to choose a new password.

Reset link: {{{resetUrl}}}

This link expires in {{expiryMinutes}} minutes. If you did not request a password reset, please ignore this email.

— The Notesaner team
`,
  },

  // ── Workspace invitation ────────────────────────────────────────────────────
  'workspace-invite': {
    subject: '{{inviterName}} invited you to join {{workspaceName}} on Notesaner',
    html: wrapInLayout(`
      <h1>You've been invited!</h1>
      <p>Hi there,</p>
      <p><strong>{{inviterName}}</strong> has invited you to join the workspace <strong>{{workspaceName}}</strong> on Notesaner as a <strong>{{role}}</strong>.</p>
      <a href="{{{inviteUrl}}}" class="btn">Accept invitation</a>
      <p class="muted">Or copy and paste this link into your browser:</p>
      <p class="muted">{{{inviteUrl}}}</p>
      <hr class="divider" />
      <p class="muted">This invitation expires on {{expiresAt}}. If you do not want to join this workspace, you can safely ignore this email.</p>
    `),
    text: `You've been invited to join {{workspaceName}} on Notesaner

Hi there,

{{inviterName}} has invited you to join the workspace "{{workspaceName}}" on Notesaner as a {{role}}.

Accept your invitation: {{{inviteUrl}}}

This invitation expires on {{expiresAt}}. If you do not want to join this workspace, you can safely ignore this email.

— The Notesaner team
`,
  },

  // ── Comment mention ─────────────────────────────────────────────────────────
  'comment-mention': {
    subject: '{{mentionedByName}} mentioned you in {{noteTitle}}',
    html: wrapInLayout(`
      <h1>You were mentioned</h1>
      <p>Hi {{displayName}},</p>
      <p><strong>{{mentionedByName}}</strong> mentioned you in a comment on <strong>{{noteTitle}}</strong>:</p>
      <blockquote style="border-left: 3px solid #5b50f0; margin: 16px 0; padding: 8px 16px; background: #f8f7ff; border-radius: 0 4px 4px 0;">
        <p style="margin: 0; font-style: italic;">{{commentPreview}}</p>
      </blockquote>
      <a href="{{{noteUrl}}}" class="btn">View comment</a>
      <hr class="divider" />
      {{#if workspaceName}}<p class="muted">In workspace: {{workspaceName}}</p>{{/if}}
    `),
    text: `{{mentionedByName}} mentioned you in {{noteTitle}}

Hi {{displayName}},

{{mentionedByName}} mentioned you in a comment on "{{noteTitle}}":

  "{{commentPreview}}"

View the comment: {{{noteUrl}}}
{{#if workspaceName}}
Workspace: {{workspaceName}}
{{/if}}
— The Notesaner team
`,
  },

  // ── Freshness alert ─────────────────────────────────────────────────────────
  'freshness-alert': {
    subject: 'Some of your notes may be out of date',
    html: wrapInLayout(`
      <h1>Freshness reminder</h1>
      <p>Hi {{displayName}},</p>
      <p>The following notes in your workspace <strong>{{workspaceName}}</strong> haven't been updated in over {{staleDays}} days and may be out of date:</p>
      <ul style="margin: 16px 0; padding: 0 0 0 20px;">
        {{#each notes}}
        <li style="margin-bottom: 8px;">
          <a href="{{{url}}}" style="color: #5b50f0;">{{title}}</a>
          <span class="muted"> — last updated {{lastUpdated}}</span>
        </li>
        {{/each}}
      </ul>
      <a href="{{{workspaceUrl}}}" class="btn">Open workspace</a>
      <hr class="divider" />
      <p class="muted">You are receiving this because you have freshness alerts enabled for this workspace.</p>
    `),
    text: `Freshness reminder for {{workspaceName}}

Hi {{displayName}},

The following notes in "{{workspaceName}}" haven't been updated in over {{staleDays}} days:

{{#each notes}}
- {{title}} — last updated {{lastUpdated}}
  {{{url}}}
{{/each}}

Open workspace: {{{workspaceUrl}}}

You are receiving this because you have freshness alerts enabled for this workspace.

— The Notesaner team
`,
  },

  // ── Notification digest ─────────────────────────────────────────────────
  'notification-digest': {
    subject: 'Your {{periodLabel}} Notesaner digest — {{notificationCount}} new notifications',
    html: wrapInLayout(`
      <h1>Your {{periodLabel}} digest</h1>
      <p>Hi {{displayName}},</p>
      <p>Here is a summary of your recent notifications:</p>
      <ul style="margin: 16px 0; padding: 0 0 0 20px;">
        {{#each notifications}}
        <li style="margin-bottom: 12px;">
          <strong>{{title}}</strong>
          <p style="margin: 4px 0 0; font-size: 14px; color: #4a4a4a;">{{body}}</p>
          <span class="muted" style="font-size: 12px;">{{createdAt}}</span>
        </li>
        {{/each}}
      </ul>
      <a href="{{{appUrl}}}" class="btn">Open Notesaner</a>
      <hr class="divider" />
      <p class="muted">You are receiving this {{periodLabel}} digest because of your notification preferences. You can change this in your settings.</p>
    `),
    text: `Your {{periodLabel}} Notesaner digest

Hi {{displayName}},

Here is a summary of your recent notifications:

{{#each notifications}}
- {{title}}: {{body}} ({{createdAt}})
{{/each}}

Open Notesaner: {{{appUrl}}}

You are receiving this {{periodLabel}} digest because of your notification preferences. You can change this in your settings.

— The Notesaner team
`,
  },

  // ── Backup failure alert ──────────────────────────────────────────────────
  'backup-failure': {
    subject: 'Backup failed on {{serverHost}}',
    html: wrapInLayout(`
      <h1 style="color: #e53e3e;">Backup failure alert</h1>
      <p>A backup job has failed and requires your attention.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr>
          <td style="padding: 8px 12px; background: #f8f8f8; font-weight: 600; border: 1px solid #e8e8e8;">Job</td>
          <td style="padding: 8px 12px; border: 1px solid #e8e8e8;">{{jobName}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; background: #f8f8f8; font-weight: 600; border: 1px solid #e8e8e8;">Time</td>
          <td style="padding: 8px 12px; border: 1px solid #e8e8e8;">{{timestamp}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; background: #f8f8f8; font-weight: 600; border: 1px solid #e8e8e8;">Server</td>
          <td style="padding: 8px 12px; border: 1px solid #e8e8e8;">{{serverHost}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; background: #f8f8f8; font-weight: 600; border: 1px solid #e8e8e8;">Error</td>
          <td style="padding: 8px 12px; border: 1px solid #e8e8e8; color: #e53e3e;">{{errorMessage}}</td>
        </tr>
      </table>
      <p>Please investigate the issue and verify the backup system is functioning correctly.</p>
      <hr class="divider" />
      <p class="muted">This is an automated alert from the Notesaner backup system. Check your server logs for full details.</p>
    `),
    text: `Backup failure alert

A backup job has failed on {{serverHost}}.

Job: {{jobName}}
Time: {{timestamp}}
Error: {{errorMessage}}

Please investigate the issue and verify the backup system is functioning correctly.

— Notesaner Backup System
`,
  },
};

/**
 * Returns the template definition for a given template name.
 * Throws if the template is unknown.
 */
export function getEmailTemplate(name: EmailTemplateName): EmailTemplateDefinition {
  const template = EMAIL_TEMPLATES[name];
  if (!template) {
    throw new Error(`Unknown email template: "${name}"`);
  }
  return template;
}

/**
 * Returns a list of all registered template names.
 */
export function listEmailTemplates(): EmailTemplateName[] {
  return Object.keys(EMAIL_TEMPLATES) as EmailTemplateName[];
}
