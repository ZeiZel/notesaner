import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { renderTemplate, TemplateVariables } from '../email-template-engine';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * The names of all Handlebars-backed email templates stored as .hbs files.
 * These supplement the inline templates in email-templates.ts.
 */
export type HbsTemplateName =
  | 'welcome'
  | 'password-reset'
  | 'notification-digest'
  | 'comment-mention'
  | 'share-invite';

/**
 * The rendered output produced by EmailTemplatesService.render().
 */
export interface RenderedEmail {
  /** Rendered email subject line (plain text). */
  subject: string;
  /** Rendered HTML body (full document wrapped in the base layout). */
  html: string;
  /** Rendered plain-text fallback body. */
  text: string;
}

/** Internal representation of a parsed .hbs file. */
interface ParsedTemplate {
  subjectTemplate: string;
  htmlTemplate: string;
  textTemplate: string;
}

// ─── Layout ───────────────────────────────────────────────────────────────────

/**
 * Shared HTML email layout.  The {{{content}}} triple-brace token is replaced
 * with the per-template HTML body so that all emails share consistent chrome.
 *
 * Kept here (rather than in a separate file) so the service has zero
 * filesystem dependencies beyond the .hbs template files.
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

// ─── Section extraction ───────────────────────────────────────────────────────

/**
 * Extracts content between `{{!-- section --}}` and `{{!-- /section --}}` markers.
 * Returns an empty string when the section is not found.
 *
 * The comment syntax `{{!-- ... --}}` is deliberately chosen because Handlebars
 * strips these comments at compile time — meaning the markers are invisible in
 * a real Handlebars context — while the custom renderTemplate engine passes
 * them through as literal text, so we can strip them ourselves in extractSection.
 */
function extractSection(source: string, section: string): string {
  const open = `{{!-- ${section} --}}`;
  const close = `{{!-- /${section} --}}`;

  const startIndex = source.indexOf(open);
  const endIndex = source.indexOf(close);

  if (startIndex === -1 || endIndex === -1) {
    return '';
  }

  return source.slice(startIndex + open.length, endIndex).trim();
}

/**
 * Strips all Handlebars comment markers (`{{!-- ... --}}`) from a rendered
 * string.  This ensures no comment tags leak into the final email output.
 */
function stripComments(rendered: string): string {
  return rendered.replace(/\{\{!--.*?--\}\}/gs, '').trim();
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * EmailTemplatesService — loads and renders .hbs email templates.
 *
 * Responsibilities:
 *   - Read .hbs template files from the templates/ directory on module init
 *   - Parse each file into subject / html / text sections
 *   - Render templates using the project's custom Handlebars-compatible engine
 *   - Wrap rendered HTML bodies in the shared base layout
 *   - Return { subject, html, text } for consumption by EmailService
 *
 * Template file format:
 *   {{!-- subject --}}    ← subject line template
 *   subject text here
 *   {{!-- /subject --}}
 *
 *   {{!-- html --}}       ← HTML body content (without layout wrapper)
 *   <h1>...</h1>
 *   {{!-- /html --}}
 *
 *   {{!-- text --}}       ← plain-text fallback
 *   plain text here
 *   {{!-- /text --}}
 *
 * @example
 *   const rendered = service.render('welcome', {
 *     displayName: 'Alice',
 *     appUrl: 'https://app.notesaner.io',
 *   });
 *   // rendered.subject → "Welcome to Notesaner, Alice!"
 *   // rendered.html    → full HTML document
 *   // rendered.text    → plain text body
 */
@Injectable()
export class EmailTemplatesService implements OnModuleInit {
  private readonly logger = new Logger(EmailTemplatesService.name);

  /** Directory containing .hbs template files. */
  private readonly templatesDir: string;

  /** In-memory cache of parsed templates, keyed by template name. */
  private readonly cache = new Map<HbsTemplateName, ParsedTemplate>();

  constructor() {
    this.templatesDir = resolve(__dirname);
  }

  /**
   * Loads all .hbs templates from disk into the in-memory cache.
   * Called automatically by NestJS when the module initialises.
   */
  onModuleInit(): void {
    const templateNames: HbsTemplateName[] = [
      'welcome',
      'password-reset',
      'notification-digest',
      'comment-mention',
      'share-invite',
    ];

    for (const name of templateNames) {
      try {
        const parsed = this.loadTemplate(name);
        this.cache.set(name, parsed);
        this.logger.log(`Loaded email template: ${name}`);
      } catch (err) {
        this.logger.error(
          `Failed to load email template "${name}": ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  /**
   * Renders a named template with the provided variables.
   *
   * Automatically injects the following variables if not already present:
   *   - `year`           — current calendar year (for the footer copyright)
   *   - `recipientEmail` — the recipient address passed as `to`
   *
   * @param name      Template identifier (must be a registered HbsTemplateName)
   * @param variables Template variables to interpolate
   * @param to        Recipient email — injected as `recipientEmail`
   * @throws Error if the template is not found in the cache
   */
  render(name: HbsTemplateName, variables: TemplateVariables, to?: string): RenderedEmail {
    const parsed = this.cache.get(name);
    if (!parsed) {
      throw new Error(
        `Email template "${name}" is not loaded. ` +
          `Available: ${[...this.cache.keys()].join(', ')}`,
      );
    }

    const enrichedVars: TemplateVariables = {
      year: new Date().getFullYear(),
      ...(to ? { recipientEmail: to } : {}),
      ...variables,
    };

    const subject = stripComments(renderTemplate(parsed.subjectTemplate, enrichedVars));

    const htmlContent = renderTemplate(parsed.htmlTemplate, enrichedVars);

    // Inject the rendered body into the layout placeholder via plain string replace
    // (before renderTemplate so that layout-level variables like subject, year,
    // and recipientEmail are also interpolated in a single pass).
    const layoutWithContent = BASE_HTML_LAYOUT.replace('{{{content}}}', htmlContent);
    const html = stripComments(
      renderTemplate(layoutWithContent, {
        ...enrichedVars,
        subject,
      }),
    );

    const text = stripComments(renderTemplate(parsed.textTemplate, enrichedVars));

    return { subject, html, text };
  }

  /**
   * Returns whether a template with the given name is loaded and ready.
   */
  isLoaded(name: HbsTemplateName): boolean {
    return this.cache.has(name);
  }

  /**
   * Returns a list of all loaded template names.
   */
  listLoaded(): HbsTemplateName[] {
    return [...this.cache.keys()];
  }

  /**
   * Reloads a single template from disk.
   * Useful in development when templates change without a server restart.
   */
  reload(name: HbsTemplateName): void {
    const parsed = this.loadTemplate(name);
    this.cache.set(name, parsed);
    this.logger.log(`Reloaded email template: ${name}`);
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  /**
   * Reads a .hbs file from disk and parses it into its three sections.
   */
  private loadTemplate(name: HbsTemplateName): ParsedTemplate {
    const filePath = resolve(this.templatesDir, `${name}.hbs`);
    const source = readFileSync(filePath, 'utf-8');

    const subjectTemplate = extractSection(source, 'subject');
    const htmlTemplate = extractSection(source, 'html');
    const textTemplate = extractSection(source, 'text');

    if (!subjectTemplate) {
      throw new Error(`Template "${name}" is missing the {{!-- subject --}} section`);
    }
    if (!htmlTemplate) {
      throw new Error(`Template "${name}" is missing the {{!-- html --}} section`);
    }
    if (!textTemplate) {
      throw new Error(`Template "${name}" is missing the {{!-- text --}} section`);
    }

    return { subjectTemplate, htmlTemplate, textTemplate };
  }
}
