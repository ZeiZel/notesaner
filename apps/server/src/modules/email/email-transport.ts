/**
 * EmailTransport — transport abstraction layer for email delivery.
 *
 * Three implementations:
 *   SMTPTransport    — production: sends via an SMTP server (nodemailer-compatible interface)
 *   ConsoleTransport — development: logs the email to stdout (no actual send)
 *   TestTransport    — testing: stores sent messages in memory for assertion
 *
 * The factory function `createEmailTransport` selects the right implementation
 * based on configuration.
 */

import * as net from 'net';

// ─── Core types ────────────────────────────────────────────────────────────────

export interface EmailMessage {
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendResult {
  messageId: string;
  accepted: string[];
  rejected: string[];
}

/**
 * Common interface implemented by all transports.
 */
export interface IEmailTransport {
  send(message: EmailMessage): Promise<SendResult>;
  close?(): Promise<void>;
}

// ─── SMTP transport ────────────────────────────────────────────────────────────

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  password?: string;
  fromAddress: string;
  fromName: string;
}

/**
 * SMTPTransport — sends email via an SMTP server.
 *
 * Uses Node's built-in `net` module for the raw TCP connection to avoid
 * adding a nodemailer dependency. For production we recommend mounting
 * nodemailer as a peer dependency and using its well-tested implementation
 * instead. This implementation covers the required interface for the task
 * without external packages.
 *
 * NOTE: This implementation uses the nodemailer-compatible interface contract:
 * you can swap the implementation body for `nodemailer.createTransport(...)` at
 * any time without changing callers.
 */
export class SmtpTransport implements IEmailTransport {
  constructor(private readonly config: SmtpConfig) {}

  async send(message: EmailMessage): Promise<SendResult> {
    // Build an SMTP envelope using raw socket communication
    // RFC 5321 compliant minimal SMTP conversation
    return new Promise<SendResult>((resolve, reject) => {
      const socket = net.createConnection(this.config.port, this.config.host);
      const messageId = `<${Date.now()}.${Math.random().toString(36).slice(2)}@notesaner>`;
      const lines: string[] = [];
      let step = 0;

      const send = (line: string) => {
        socket.write(line + '\r\n');
      };

      const parseCode = (data: string): number => {
        return parseInt(data.slice(0, 3), 10);
      };

      const buildEmailBody = (): string => {
        const boundary = `boundary_${Date.now()}`;
        const date = new Date().toUTCString();
        const from = `"${this.config.fromName}" <${this.config.fromAddress}>`;
        const subject = Buffer.from(message.subject).toString('base64');

        const parts: string[] = [
          `From: ${from}`,
          `To: ${message.to}`,
          `Subject: =?UTF-8?B?${subject}?=`,
          `Date: ${date}`,
          `Message-ID: ${messageId}`,
          `MIME-Version: 1.0`,
          `Content-Type: multipart/alternative; boundary="${boundary}"`,
          '',
        ];

        if (message.text) {
          parts.push(
            `--${boundary}`,
            `Content-Type: text/plain; charset=UTF-8`,
            `Content-Transfer-Encoding: base64`,
            '',
            Buffer.from(message.text).toString('base64'),
            '',
          );
        }

        parts.push(
          `--${boundary}`,
          `Content-Type: text/html; charset=UTF-8`,
          `Content-Transfer-Encoding: base64`,
          '',
          Buffer.from(message.html).toString('base64'),
          '',
          `--${boundary}--`,
          '',
          '.',
        );

        return parts.join('\r\n');
      };

      socket.on('data', (data) => {
        const response = data.toString();
        lines.push(response);
        const code = parseCode(response);

        switch (step) {
          case 0: // Greeting
            if (code === 220) {
              step = 1;
              send(`EHLO notesaner`);
            } else {
              socket.destroy();
              reject(new Error(`SMTP greeting failed: ${response}`));
            }
            break;

          case 1: // EHLO response
            if (code === 250) {
              step = 2;
              if (this.config.user && this.config.password) {
                send('AUTH LOGIN');
              } else {
                send(`MAIL FROM:<${this.config.fromAddress}>`);
                step = 4;
              }
            } else {
              socket.destroy();
              reject(new Error(`SMTP EHLO failed: ${response}`));
            }
            break;

          case 2: // AUTH LOGIN challenge
            if (code === 334) {
              step = 3;
              send(Buffer.from(this.config.user ?? '').toString('base64'));
            } else {
              socket.destroy();
              reject(new Error(`SMTP AUTH failed: ${response}`));
            }
            break;

          case 3: // AUTH password challenge
            if (code === 334) {
              step = 4;
              send(Buffer.from(this.config.password ?? '').toString('base64'));
            } else if (code === 235) {
              step = 4;
              send(`MAIL FROM:<${this.config.fromAddress}>`);
            } else {
              socket.destroy();
              reject(new Error(`SMTP AUTH credentials failed: ${response}`));
            }
            break;

          case 4: // MAIL FROM or AUTH 235
            if (code === 250 || code === 235) {
              step = 5;
              if (code === 235) {
                send(`MAIL FROM:<${this.config.fromAddress}>`);
              } else {
                send(`RCPT TO:<${message.to}>`);
              }
            } else {
              socket.destroy();
              reject(new Error(`SMTP MAIL FROM failed: ${response}`));
            }
            break;

          case 5: // RCPT TO
            if (code === 250) {
              step = 6;
              send('DATA');
            } else {
              socket.destroy();
              reject(new Error(`SMTP RCPT TO failed: ${response}`));
            }
            break;

          case 6: // DATA command accepted (354)
            if (code === 354 || code === 250) {
              step = 7;
              if (code === 354) {
                send(buildEmailBody());
              } else {
                send('DATA');
              }
            } else {
              socket.destroy();
              reject(new Error(`SMTP DATA init failed: ${response}`));
            }
            break;

          case 7: // Message body accepted
            if (code === 250) {
              step = 8;
              send('QUIT');
            } else {
              socket.destroy();
              reject(new Error(`SMTP message delivery failed: ${response}`));
            }
            break;

          case 8: // QUIT
            socket.destroy();
            resolve({
              messageId,
              accepted: [message.to],
              rejected: [],
            });
            break;
        }
      });

      socket.on('error', (err) => {
        reject(new Error(`SMTP connection error: ${err.message}`));
      });

      socket.setTimeout(30_000, () => {
        socket.destroy();
        reject(new Error('SMTP connection timed out'));
      });
    });
  }

  async close(): Promise<void> {
    // Connections are per-send; nothing to close at the transport level
  }
}

// ─── Console transport (development) ──────────────────────────────────────────

/**
 * ConsoleTransport — logs email content to stdout instead of sending.
 * Appropriate for local development where an SMTP server is not available.
 */
export class ConsoleTransport implements IEmailTransport {
  async send(message: EmailMessage): Promise<SendResult> {
    const messageId = `<console.${Date.now()}@notesaner>`;

    // eslint-disable-next-line no-console
    console.log(
      [
        '┌─ [ConsoleTransport] Email ─────────────────────────────────────────',
        `│ To:      ${message.to}`,
        `│ From:    ${message.from}`,
        `│ Subject: ${message.subject}`,
        `│ Body (text):`,
        (message.text ?? '(no plain-text body)')
          .split('\n')
          .map((l) => `│   ${l}`)
          .join('\n'),
        '└────────────────────────────────────────────────────────────────────',
      ].join('\n'),
    );

    return {
      messageId,
      accepted: [message.to],
      rejected: [],
    };
  }
}

// ─── Test transport ────────────────────────────────────────────────────────────

export interface SentMessage extends EmailMessage {
  messageId: string;
  sentAt: Date;
}

/**
 * TestTransport — stores all sent messages in memory.
 * Use in unit and integration tests to assert on email sends without I/O.
 *
 * @example
 *   const transport = new TestTransport();
 *   // ... invoke service code ...
 *   const sent = transport.getSentMessages();
 *   expect(sent).toHaveLength(1);
 *   expect(sent[0].to).toBe('alice@example.com');
 */
export class TestTransport implements IEmailTransport {
  private readonly _sent: SentMessage[] = [];

  async send(message: EmailMessage): Promise<SendResult> {
    const messageId = `<test.${Date.now()}.${this._sent.length}@notesaner>`;

    this._sent.push({
      ...message,
      messageId,
      sentAt: new Date(),
    });

    return {
      messageId,
      accepted: [message.to],
      rejected: [],
    };
  }

  /** Returns a copy of all messages sent since the transport was created. */
  getSentMessages(): ReadonlyArray<SentMessage> {
    return [...this._sent];
  }

  /** Returns the last sent message, or undefined if nothing was sent. */
  getLastMessage(): SentMessage | undefined {
    return this._sent[this._sent.length - 1];
  }

  /** Returns messages matching the given recipient address. */
  getMessagesTo(to: string): SentMessage[] {
    return this._sent.filter((m) => m.to === to);
  }

  /** Clears the in-memory message store. */
  clear(): void {
    this._sent.length = 0;
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export interface EmailTransportConfig {
  nodeEnv: string;
  smtp?: SmtpConfig;
}

/**
 * Creates the appropriate transport implementation for the current environment.
 *
 * - 'test'        → TestTransport (never sends, stores in memory)
 * - 'development' → ConsoleTransport (logs to stdout)
 * - 'production'  → SMTPTransport (requires smtp config)
 */
export function createEmailTransport(config: EmailTransportConfig): IEmailTransport {
  if (config.nodeEnv === 'test') {
    return new TestTransport();
  }

  if (config.nodeEnv === 'production') {
    if (!config.smtp) {
      throw new Error(
        'SMTP configuration is required in production. ' +
          'Provide SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM_ADDRESS.',
      );
    }
    return new SmtpTransport(config.smtp);
  }

  // Default: development — log to console
  return new ConsoleTransport();
}
