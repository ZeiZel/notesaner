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
import {
  ApiBody,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Public } from '../../common/decorators/public.decorator';
import { EmailService } from './email.service';
import { EMAIL_TEMPLATES, EmailTemplateName, listEmailTemplates } from './email-templates';
import { renderTemplate } from './email-template-engine';
import { SendEmailDto } from './dto/send-email.dto';

/**
 * EmailController -- development-only preview and test endpoints.
 *
 * All routes are guarded by a NODE_ENV check: in production they return 404.
 */
@ApiTags('Dev - Email')
@Public() // Dev endpoints are unauthenticated for convenience
@Controller('dev/email')
export class EmailController {
  constructor(
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
  ) {}

  // ---- Preview ----

  @Get(':template')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Preview an email template (dev only)',
    description:
      'Renders a template with sample data and returns raw HTML. Not available in production.',
  })
  @ApiParam({
    name: 'template',
    description: 'Template identifier',
    enum: [
      'verification',
      'password-reset',
      'workspace-invite',
      'comment-mention',
      'freshness-alert',
    ],
  })
  @ApiOkResponse({ description: 'Rendered HTML of the template.' })
  @ApiNotFoundResponse({ description: 'Template not found or running in production.' })
  previewTemplate(@Param('template') template: string): string {
    this.assertDevEnvironment();
    this.assertKnownTemplate(template);

    const templateDef = EMAIL_TEMPLATES[template as EmailTemplateName];
    const sampleVars = buildSampleVariables(template as EmailTemplateName);

    const subject = renderTemplate(templateDef.subject, sampleVars);
    const html = renderTemplate(templateDef.html, { ...sampleVars, subject });

    return html;
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List available email templates (dev only)',
    description: 'Lists all registered template names. Not available in production.',
  })
  @ApiOkResponse({
    description: 'List of template names.',
    schema: {
      type: 'object',
      properties: {
        templates: {
          type: 'array',
          items: { type: 'string' },
          example: ['verification', 'password-reset', 'workspace-invite'],
        },
      },
    },
  })
  listTemplates(): { templates: string[] } {
    this.assertDevEnvironment();
    return { templates: listEmailTemplates() };
  }

  // ---- Test send ----

  @Post('test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send a test email (dev only)',
    description:
      'Sends a test email using the configured transport. In development mode, logs to console.',
  })
  @ApiBody({ type: SendEmailDto })
  @ApiOkResponse({ description: 'Test email queued.' })
  @ApiNotFoundResponse({ description: 'Template not found or running in production.' })
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

  // ---- Private helpers ----

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

// ---- Sample data ----

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
