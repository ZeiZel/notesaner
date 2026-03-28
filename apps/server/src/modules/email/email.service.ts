import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IEmailTransport,
  EmailMessage,
  SendResult,
  createEmailTransport,
  TestTransport,
  ConsoleTransport,
  SmtpConfig,
} from './email-transport';
import { EMAIL_TEMPLATES, EmailTemplateName, EmailTemplateDefinition } from './email-templates';
import { renderTemplate, TemplateVariables } from './email-template-engine';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum send attempts per email (initial attempt + retries). */
const MAX_ATTEMPTS = 3;

/** Base delay (ms) for exponential back-off: attempt i waits base * 2^i ms. */
const BACKOFF_BASE_MS = 500;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SendEmailOptions {
  to: string;
  template: EmailTemplateName;
  variables?: TemplateVariables;
}

export interface BulkSendEmailOptions {
  recipients: string[];
  template: EmailTemplateName;
  /** Variables shared across all recipients. */
  variables?: TemplateVariables;
  /**
   * Per-recipient variable overrides keyed by email address.
   * Merged with (and take precedence over) the shared variables.
   */
  perRecipientVariables?: Record<string, TemplateVariables>;
}

export interface EmailDeliveryLog {
  id: string;
  to: string;
  template: EmailTemplateName;
  status: 'sent' | 'failed';
  messageId?: string;
  error?: string;
  attempts: number;
  sentAt: Date;
}

export interface BulkSendResult {
  sent: number;
  failed: number;
  errors: Array<{ to: string; error: string }>;
}

// ─── Service ─────────────────────────────────────────────────────────────────

/**
 * EmailService — the primary interface for sending transactional emails.
 *
 * Responsibilities:
 *   - Render template subjects and bodies using the template engine.
 *   - Dispatch emails via the configured transport.
 *   - Retry failed sends up to MAX_ATTEMPTS times with exponential back-off.
 *   - Write an in-memory delivery log for observability.
 *
 * The concrete transport (SMTP / Console / Test) is determined at construction
 * time from the ConfigService, following the factory pattern in email-transport.ts.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transport: IEmailTransport;
  private readonly fromAddress: string;
  private readonly fromName: string;

  /** In-memory delivery log (last MAX_LOG_SIZE entries). */
  private readonly deliveryLog: EmailDeliveryLog[] = [];
  private static readonly MAX_LOG_SIZE = 500;

  constructor(private readonly config: ConfigService) {
    this.fromAddress = this.config.get<string>('email.fromAddress', 'noreply@notesaner.io');
    this.fromName = this.config.get<string>('email.fromName', 'Notesaner');

    const nodeEnv = this.config.get<string>('nodeEnv', 'development');

    // Build SMTP config only when in production (and vars are present)
    const smtpHost = this.config.get<string>('email.smtp.host');
    const smtpConfig: SmtpConfig | undefined = smtpHost
      ? {
          host: smtpHost,
          port: this.config.get<number>('email.smtp.port', 587),
          secure: this.config.get<boolean>('email.smtp.secure', false),
          user: this.config.get<string>('email.smtp.user'),
          password: this.config.get<string>('email.smtp.password'),
          fromAddress: this.fromAddress,
          fromName: this.fromName,
        }
      : undefined;

    this.transport = createEmailTransport({ nodeEnv, smtp: smtpConfig });
  }

  /**
   * Sends a single transactional email.
   *
   * Renders the specified template with the provided variables, then dispatches
   * via the configured transport. Retries up to MAX_ATTEMPTS times on failure
   * with exponential back-off.
   *
   * @throws  Never — send failures are logged but not propagated to callers.
   */
  async send(options: SendEmailOptions): Promise<void> {
    const { to, template, variables = {} } = options;

    const templateDef = EMAIL_TEMPLATES[template];
    if (!templateDef) {
      this.logger.error(`Unknown email template: "${template}"`);
      this.appendDeliveryLog(to, template, 'failed', undefined, `Unknown template: ${template}`, 0);
      return;
    }

    const enrichedVars: TemplateVariables = {
      ...variables,
      recipientEmail: to,
      year: new Date().getFullYear(),
    };

    const message = this.renderMessage(to, templateDef, enrichedVars);

    await this.sendWithRetry(to, template, message);
  }

  /**
   * Sends the same template to multiple recipients in parallel.
   *
   * Each recipient can receive per-recipient variable overrides merged with the
   * shared variables. Failed sends are recorded in the result's `errors` array
   * and do not abort the bulk operation.
   */
  async sendBulk(options: BulkSendEmailOptions): Promise<BulkSendResult> {
    const { recipients, template, variables = {}, perRecipientVariables = {} } = options;

    const result: BulkSendResult = { sent: 0, failed: 0, errors: [] };

    await Promise.all(
      recipients.map(async (to) => {
        const recipientVars: TemplateVariables = {
          ...variables,
          ...(perRecipientVariables[to] ?? {}),
        };

        try {
          await this.send({ to, template, variables: recipientVars });
          result.sent++;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          result.failed++;
          result.errors.push({ to, error: message });
          this.logger.error(`Bulk send failed for ${to}: ${message}`);
        }
      }),
    );

    return result;
  }

  /**
   * Returns a snapshot of recent delivery log entries (newest first).
   * Capped at MAX_LOG_SIZE entries — oldest entries are discarded automatically.
   */
  getDeliveryLog(limit = 100): EmailDeliveryLog[] {
    return [...this.deliveryLog].reverse().slice(0, Math.min(limit, EmailService.MAX_LOG_SIZE));
  }

  /**
   * Returns delivery log entries for a specific recipient.
   */
  getDeliveryLogForRecipient(to: string, limit = 20): EmailDeliveryLog[] {
    return this.deliveryLog
      .filter((entry) => entry.to === to)
      .reverse()
      .slice(0, limit);
  }

  /**
   * Clears the delivery log. Intended for use in tests only.
   */
  clearDeliveryLog(): void {
    this.deliveryLog.length = 0;
  }

  /**
   * Exposes the underlying transport for use in tests (e.g. to read sent messages
   * from TestTransport). Not for use in production code.
   *
   * @internal
   */
  getTransport(): IEmailTransport {
    return this.transport;
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  /**
   * Renders the email template subject and body with the provided variables.
   */
  private renderMessage(
    to: string,
    template: EmailTemplateDefinition,
    variables: TemplateVariables,
  ): EmailMessage {
    const subject = renderTemplate(template.subject, variables);
    const html = renderTemplate(template.html, {
      ...variables,
      subject, // Expose rendered subject so layout can use it
    });
    const text = template.text ? renderTemplate(template.text, variables) : undefined;

    return {
      from: `"${this.fromName}" <${this.fromAddress}>`,
      to,
      subject,
      html,
      text,
    };
  }

  /**
   * Attempts to send a message, retrying up to MAX_ATTEMPTS times on failure.
   * Uses exponential back-off: delay = BACKOFF_BASE_MS * 2^(attempt - 1)
   */
  private async sendWithRetry(
    to: string,
    template: EmailTemplateName,
    message: EmailMessage,
  ): Promise<void> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const result: SendResult = await this.transport.send(message);

        this.logger.log(
          `Email [${template}] delivered to ${to} (attempt ${attempt}/${MAX_ATTEMPTS}, messageId=${result.messageId})`,
        );
        this.appendDeliveryLog(to, template, 'sent', result.messageId, undefined, attempt);
        return;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        this.logger.warn(
          `Email [${template}] to ${to} failed on attempt ${attempt}/${MAX_ATTEMPTS}: ${lastError.message}`,
        );

        if (attempt < MAX_ATTEMPTS) {
          const delayMs = BACKOFF_BASE_MS * Math.pow(2, attempt - 1);
          this.logger.debug(`Retrying in ${delayMs}ms…`);
          await this.sleep(delayMs);
        }
      }
    }

    // All attempts exhausted
    this.logger.error(
      `Email [${template}] to ${to} failed after ${MAX_ATTEMPTS} attempts: ${lastError?.message}`,
    );
    this.appendDeliveryLog(to, template, 'failed', undefined, lastError?.message, MAX_ATTEMPTS);
  }

  private appendDeliveryLog(
    to: string,
    template: EmailTemplateName,
    status: 'sent' | 'failed',
    messageId: string | undefined,
    error: string | undefined,
    attempts: number,
  ): void {
    const entry: EmailDeliveryLog = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      to,
      template,
      status,
      messageId,
      error,
      attempts,
      sentAt: new Date(),
    };

    this.deliveryLog.push(entry);

    // Trim oldest entries once over capacity
    if (this.deliveryLog.length > EmailService.MAX_LOG_SIZE) {
      this.deliveryLog.splice(0, this.deliveryLog.length - EmailService.MAX_LOG_SIZE);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ─── Factory helper for testing ───────────────────────────────────────────────

/**
 * Creates an EmailService wired with a TestTransport.
 * Useful in unit tests where you want to avoid the NestJS DI container.
 *
 * @example
 *   const { service, transport } = createTestEmailService();
 *   await service.send({ to: 'alice@example.com', template: 'verification', variables: { ... } });
 *   expect(transport.getSentMessages()).toHaveLength(1);
 */
export function createTestEmailService(configOverrides: Record<string, unknown> = {}): {
  service: EmailService;
  transport: TestTransport;
} {
  const config: Record<string, unknown> = {
    nodeEnv: 'test',
    'email.fromAddress': 'test@notesaner.io',
    'email.fromName': 'Notesaner Test',
    ...configOverrides,
  };

  const configService = {
    get: <T>(key: string, defaultValue?: T): T => {
      return (config[key] as T) ?? (defaultValue as T);
    },
  } as unknown as ConfigService;

  const service = new EmailService(configService);
  const transport = service.getTransport() as TestTransport;

  return { service, transport };
}

/**
 * Creates an EmailService wired with a ConsoleTransport.
 * Useful for integration tests where you want to see email output.
 */
export function createConsoleEmailService(configOverrides: Record<string, unknown> = {}): {
  service: EmailService;
  transport: ConsoleTransport;
} {
  const config: Record<string, unknown> = {
    nodeEnv: 'development',
    'email.fromAddress': 'dev@notesaner.io',
    'email.fromName': 'Notesaner Dev',
    ...configOverrides,
  };

  const configService = {
    get: <T>(key: string, defaultValue?: T): T => {
      return (config[key] as T) ?? (defaultValue as T);
    },
  } as unknown as ConfigService;

  const service = new EmailService(configService);
  const transport = service.getTransport() as ConsoleTransport;

  return { service, transport };
}
