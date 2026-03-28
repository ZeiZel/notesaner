import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../../common/decorators/public.decorator';
import { EmailService } from './email.service';
import { EMAIL_TEMPLATES, EmailTemplateName, listEmailTemplates } from './email-templates';
import { renderTemplate } from './email-template-engine';
import { SendEmailDto } from './dto/send-email.dto';

/**
 * EmailController — development-only preview and test endpoints.
 *
 * All routes are guarded by a NODE_ENV check: in production they return 404.
 * This prevents accidental exposure of the SMTP test surface in production.
 *
 * Routes:
 *   GET  /dev/email/:template   — HTML preview of a template with sample data
 *   POST /dev/email/test        — Send a test email via the configured transport
 */
@Public() // Dev endpoints are unauthenticated for convenience
@Controller('dev/email')
export class EmailController {
  constructor(
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
  ) {}

  // ─── Preview ───────────────────────────────────────────────────────────────

  /**
   * Renders a template with placeholder sample data and returns the raw HTML.
   * Useful for iterating on email design without sending anything.
   *
   * @example GET /dev/email/verification
   */
  @Get(':template')
  @HttpCode(HttpStatus.OK)
  previewTemplate(@Param('template') template: string): string {
    this.assertDevEnvironment();
    this.assertKnownTemplate(template);

    const templateDef = EMAIL_TEMPLATES[template as EmailTemplateName];
    const sampleVars = buildSampleVariables(template as EmailTemplateName);

    const subject = renderTemplate(templateDef.subject, sampleVars);
    const html = renderTemplate(templateDef.html, { ...sampleVars, subject });

    return html;
  }

  /**
   * Lists all registered template names.
   *
   * @example GET /dev/email
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  listTemplates(): { templates: string[] } {
    this.assertDevEnvironment();
    return { templates: listEmailTemplates() };
  }

  // ─── Test send ─────────────────────────────────────────────────────────────

  /**
   * Sends a test email using the currently configured transport.
   * In development this logs to the console; in test it captures to memory.
   *
   * @example
   * POST /dev/email/test
   * { "to": "alice@example.com", "template": "verification", "variables": {} }
   */
  @Post('test')
  @HttpCode(HttpStatus.OK)
  async sendTestEmail(@Body() dto: SendEmailDto): Promise<{ message: string }> {
    this.assertDevEnvironment();
    this.assertKnownTemplate(dto.template);

    await this.emailService.send({
      to: dto.to,
      template: dto.template as EmailTemplateName,
      variables: dto.variables,
    });

    return { message: `Test email [${dto.template}] queued for ${dto.to}` };
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private assertDevEnvironment(): void {
    const nodeEnv = this.config.get<string>('nodeEnv', 'development');
    if (nodeEnv === 'production') {
      throw new NotFoundException('Not found');
    }
  }

  private assertKnownTemplate(template: string): void {
    const known = listEmailTemplates() as string[];
    if (!known.includes(template)) {
      throw new NotFoundException(
        `Email template "${template}" not found. Available: ${known.join(', ')}`,
      );
    }
  }
}

// ─── Sample data ──────────────────────────────────────────────────────────────

/**
 * Returns sample template variables used for preview rendering.
 * Designed to produce a realistic-looking preview for each template.
 */
function buildSampleVariables(template: EmailTemplateName): Record<string, unknown> {
  const base = {
    recipientEmail: 'preview@example.com',
    year: new Date().getFullYear(),
    displayName: 'Alice',
  };

  switch (template) {
    case 'verification':
      return {
        ...base,
        verificationUrl: 'https://app.notesaner.io/verify?token=preview-token-abc123',
        expiryHours: 24,
      };

    case 'password-reset':
      return {
        ...base,
        resetUrl: 'https://app.notesaner.io/reset-password?token=preview-token-xyz789',
        expiryMinutes: 30,
      };

    case 'workspace-invite':
      return {
        ...base,
        inviterName: 'Bob Smith',
        workspaceName: 'Marketing Hub',
        role: 'EDITOR',
        inviteUrl: 'https://app.notesaner.io/invite?token=preview-invite-token',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US'),
      };

    case 'comment-mention':
      return {
        ...base,
        mentionedByName: 'Charlie',
        noteTitle: 'Q4 Strategy Overview',
        commentPreview: '@Alice what do you think about this approach? We should discuss further.',
        noteUrl: 'https://app.notesaner.io/workspaces/ws-1/notes/note-1#comment-123',
        workspaceName: 'Marketing Hub',
      };

    case 'freshness-alert':
      return {
        ...base,
        workspaceName: 'Personal Notes',
        staleDays: 30,
        workspaceUrl: 'https://app.notesaner.io/workspaces/ws-1',
        notes: [
          {
            title: 'Meeting Notes 2024-01',
            url: 'https://app.notesaner.io/workspaces/ws-1/notes/1',
            lastUpdated: '45 days ago',
          },
          {
            title: 'Project Roadmap',
            url: 'https://app.notesaner.io/workspaces/ws-1/notes/2',
            lastUpdated: '60 days ago',
          },
          {
            title: 'Ideas Backlog',
            url: 'https://app.notesaner.io/workspaces/ws-1/notes/3',
            lastUpdated: '90 days ago',
          },
        ],
      };
  }
}
