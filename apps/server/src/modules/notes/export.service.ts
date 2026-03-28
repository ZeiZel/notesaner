import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { readFile } from 'fs/promises';
import type { ExportFormat } from './dto/export.dto';
import { NotesService } from './notes.service';

/**
 * Dynamically require an optional dependency.
 * Returns the module if available, or null if not installed.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tryRequire(moduleName: string): any | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(moduleName);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExportedFile {
  filename: string;
  contentType: string;
  buffer: Buffer;
}

interface NoteData {
  id: string;
  title: string;
  path: string;
  content: string;
}

// ---------------------------------------------------------------------------
// HTML template for rendered export
// ---------------------------------------------------------------------------

const HTML_TEMPLATE = (title: string, bodyHtml: string): string => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      --font-mono: "SF Mono", "Fira Code", "Fira Mono", "Roboto Mono", monospace;
      --color-text: #1a1a1a;
      --color-bg: #ffffff;
      --color-border: #e5e5e5;
      --color-code-bg: #f5f5f5;
      --color-link: #2563eb;
    }
    body {
      font-family: var(--font-sans);
      color: var(--color-text);
      background: var(--color-bg);
      max-width: 768px;
      margin: 0 auto;
      padding: 2rem 1.5rem;
      line-height: 1.7;
      font-size: 16px;
    }
    h1 { font-size: 2rem; margin: 0 0 1.5rem; font-weight: 700; line-height: 1.2; }
    h2 { font-size: 1.5rem; margin: 2rem 0 1rem; font-weight: 600; }
    h3 { font-size: 1.25rem; margin: 1.5rem 0 0.75rem; font-weight: 600; }
    h4, h5, h6 { font-size: 1rem; margin: 1rem 0 0.5rem; font-weight: 600; }
    p { margin: 0 0 1rem; }
    a { color: var(--color-link); text-decoration: none; }
    a:hover { text-decoration: underline; }
    code {
      font-family: var(--font-mono);
      font-size: 0.875em;
      background: var(--color-code-bg);
      border-radius: 4px;
      padding: 0.15em 0.35em;
    }
    pre {
      background: var(--color-code-bg);
      border-radius: 8px;
      padding: 1rem;
      overflow-x: auto;
      margin: 0 0 1rem;
    }
    pre code { background: none; padding: 0; }
    blockquote {
      border-left: 3px solid var(--color-border);
      margin: 0 0 1rem;
      padding: 0.5rem 0 0.5rem 1rem;
      color: #555;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 0 0 1rem;
    }
    th, td {
      border: 1px solid var(--color-border);
      padding: 0.5rem 0.75rem;
      text-align: left;
    }
    th { background: var(--color-code-bg); font-weight: 600; }
    img { max-width: 100%; height: auto; border-radius: 4px; }
    hr { border: none; border-top: 1px solid var(--color-border); margin: 2rem 0; }
    ul, ol { margin: 0 0 1rem; padding-left: 1.5rem; }
    li { margin: 0.25rem 0; }
    .task-list-item { list-style: none; margin-left: -1.5rem; }
    .task-list-item input[type="checkbox"] { margin-right: 0.5rem; }
    .frontmatter { display: none; }
  </style>
</head>
<body>
${bodyHtml}
</body>
</html>`;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);
  private readonly storageRoot: string;

  constructor(
    private readonly notesService: NotesService,
    configService: ConfigService,
  ) {
    this.storageRoot = configService.get<string>('storage.root') ?? '/var/lib/notesaner/workspaces';
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Export a single note in the requested format.
   */
  async exportNote(
    workspaceId: string,
    noteId: string,
    format: ExportFormat,
  ): Promise<ExportedFile> {
    const noteData = await this.loadNoteData(workspaceId, noteId);
    return this.convertNote(noteData, format);
  }

  /**
   * Export multiple notes as a ZIP archive.
   */
  async exportBatch(
    workspaceId: string,
    noteIds: string[],
    format: ExportFormat,
  ): Promise<ExportedFile> {
    if (noteIds.length === 0) {
      throw new BadRequestException('At least one note ID is required');
    }

    if (noteIds.length > 100) {
      throw new BadRequestException('Cannot export more than 100 notes at once');
    }

    const notes = await Promise.all(noteIds.map((id) => this.loadNoteData(workspaceId, id)));

    const exportedFiles = await Promise.all(notes.map((note) => this.convertNote(note, format)));

    return this.createZipArchive(exportedFiles, format);
  }

  // -----------------------------------------------------------------------
  // Format converters
  // -----------------------------------------------------------------------

  private async convertNote(note: NoteData, format: ExportFormat): Promise<ExportedFile> {
    switch (format) {
      case 'md':
        return this.toMarkdown(note);
      case 'html':
        return this.toHtml(note);
      case 'pdf':
        return this.toPdf(note);
      case 'docx':
        return this.toDocx(note);
      default:
        throw new BadRequestException(`Unsupported export format: ${format as string}`);
    }
  }

  /**
   * Export as raw markdown with frontmatter preserved.
   */
  private toMarkdown(note: NoteData): ExportedFile {
    const filename = this.sanitizeFilename(note.title) + '.md';
    return {
      filename,
      contentType: 'text/markdown; charset=utf-8',
      buffer: Buffer.from(note.content, 'utf-8'),
    };
  }

  /**
   * Export as rendered HTML with embedded styles.
   */
  private toHtml(note: NoteData): ExportedFile {
    const filename = this.sanitizeFilename(note.title) + '.html';
    const bodyHtml = this.markdownToHtml(note.content);
    const html = HTML_TEMPLATE(note.title, bodyHtml);

    return {
      filename,
      contentType: 'text/html; charset=utf-8',
      buffer: Buffer.from(html, 'utf-8'),
    };
  }

  /**
   * Export as PDF using server-side HTML-to-PDF conversion.
   *
   * Attempts to use puppeteer if available. Falls back to a simple
   * HTML-based response if puppeteer is not installed.
   */
  private async toPdf(note: NoteData): Promise<ExportedFile> {
    const filename = this.sanitizeFilename(note.title) + '.pdf';
    const bodyHtml = this.markdownToHtml(note.content);
    const html = HTML_TEMPLATE(note.title, bodyHtml);

    try {
      const puppeteer = tryRequire('puppeteer');
      if (!puppeteer) throw new Error('puppeteer is not installed');
      const browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });

      try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({
          format: 'A4',
          margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
          printBackground: true,
        });

        return {
          filename,
          contentType: 'application/pdf',
          buffer: Buffer.from(pdfBuffer),
        };
      } finally {
        await browser.close();
      }
    } catch (error) {
      this.logger.warn(
        `Puppeteer not available for PDF export, falling back to HTML: ${String(error)}`,
      );
      // Fallback: return HTML with PDF content-type header hint in filename
      // The controller will set the correct content-disposition
      const fallbackFilename = this.sanitizeFilename(note.title) + '.html';
      return {
        filename: fallbackFilename,
        contentType: 'text/html; charset=utf-8',
        buffer: Buffer.from(html, 'utf-8'),
      };
    }
  }

  /**
   * Export as DOCX using the docx library.
   *
   * Converts markdown to a structured Word document with proper
   * headings, paragraphs, bold, italic, code, and lists.
   */
  private async toDocx(note: NoteData): Promise<ExportedFile> {
    const filename = this.sanitizeFilename(note.title) + '.docx';

    try {
      const docx = tryRequire('docx');
      if (!docx) throw new Error('docx package is not installed');
      const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = docx;

      const contentWithoutFrontmatter = this.stripFrontmatter(note.content);
      const lines = contentWithoutFrontmatter.split('\n');
      const children: InstanceType<typeof Paragraph>[] = [];

      for (const line of lines) {
        const paragraph = this.lineToDocxParagraph(line, {
          Document,
          Paragraph,
          TextRun,
          HeadingLevel,
          AlignmentType,
        });
        if (paragraph) {
          children.push(paragraph);
        }
      }

      // If no content was parsed, add an empty paragraph
      if (children.length === 0) {
        children.push(new Paragraph({ children: [new TextRun('')] }));
      }

      const doc = new Document({
        creator: 'Notesaner',
        title: note.title,
        description: `Exported from Notesaner on ${new Date().toISOString()}`,
        sections: [{ children }],
      });

      const buffer = await Packer.toBuffer(doc);
      return {
        filename,
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        buffer: Buffer.from(buffer),
      };
    } catch (error) {
      this.logger.error(`DOCX export failed: ${String(error)}`);
      throw new BadRequestException(
        'DOCX export is not available. Please install the "docx" package.',
      );
    }
  }

  // -----------------------------------------------------------------------
  // Markdown parsing helpers
  // -----------------------------------------------------------------------

  /**
   * Convert markdown to basic HTML.
   *
   * This is a lightweight converter for export purposes. It handles
   * the most common markdown constructs. For full-fidelity rendering,
   * the frontend TipTap editor should be used.
   */
  private markdownToHtml(markdown: string): string {
    const content = this.stripFrontmatter(markdown);
    let html = escapeHtml(content);

    // Code blocks (must be before inline code)
    html = html.replace(
      /```(\w*)\n([\s\S]*?)```/g,
      (_match, lang, code) => `<pre><code class="language-${lang}">${code.trim()}</code></pre>`,
    );

    // Headings (ATX style)
    html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
    html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
    html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

    // Horizontal rules
    html = html.replace(/^---+$/gm, '<hr>');

    // Bold and italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    // Wiki links (Obsidian style [[Page Name]])
    html = html.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match, target, alias) => {
      const display = alias ?? target;
      return `<a href="#" title="${escapeHtml(target)}">${escapeHtml(display)}</a>`;
    });

    // Images
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');

    // Task lists
    html = html.replace(
      /^(\s*)- \[x\]\s+(.+)$/gm,
      '$1<li class="task-list-item"><input type="checkbox" checked disabled> $2</li>',
    );
    html = html.replace(
      /^(\s*)- \[ \]\s+(.+)$/gm,
      '$1<li class="task-list-item"><input type="checkbox" disabled> $2</li>',
    );

    // Unordered lists
    html = html.replace(/^(\s*)- (.+)$/gm, '$1<li>$2</li>');

    // Ordered lists
    html = html.replace(/^(\s*)\d+\.\s+(.+)$/gm, '$1<li>$2</li>');

    // Blockquotes
    html = html.replace(/^>\s+(.+)$/gm, '<blockquote><p>$1</p></blockquote>');

    // Paragraphs: wrap remaining non-empty, non-HTML lines
    html = html.replace(/^(?!<[a-z]|$)(.+)$/gm, '<p>$1</p>');

    // Clean up consecutive blockquotes
    html = html.replace(/<\/blockquote>\s*<blockquote>/g, '\n');

    // Wrap consecutive <li> in <ul>
    html = html.replace(/((?:<li[^>]*>.*<\/li>\s*)+)/g, '<ul>$1</ul>');

    return html;
  }

  /**
   * Convert a markdown line to a docx Paragraph.
   */
  private lineToDocxParagraph(
    line: string,
    docxTypes: {
      Paragraph: new (options: Record<string, unknown>) => unknown;
      TextRun: new (options: Record<string, unknown> | string) => unknown;
      HeadingLevel: Record<string, unknown>;
      AlignmentType: Record<string, unknown>;
      Document: unknown;
    },
  ): unknown {
    const { Paragraph, TextRun, HeadingLevel } = docxTypes;
    const trimmed = line.trimEnd();

    // Skip empty lines (add spacing via paragraph options)
    if (trimmed === '') {
      return new Paragraph({ children: [new TextRun('')], spacing: { after: 120 } });
    }

    // Headings
    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingLevelMap: Record<number, unknown> = {
        1: HeadingLevel.HEADING_1,
        2: HeadingLevel.HEADING_2,
        3: HeadingLevel.HEADING_3,
        4: HeadingLevel.HEADING_4,
        5: HeadingLevel.HEADING_5,
        6: HeadingLevel.HEADING_6,
      };
      return new Paragraph({
        children: this.parseInlineFormatting(headingMatch[2], TextRun),
        heading: headingLevelMap[level],
        spacing: { before: 240, after: 120 },
      });
    }

    // Horizontal rule
    if (/^---+$/.test(trimmed)) {
      return new Paragraph({
        children: [new TextRun({ text: '---' })],
        spacing: { before: 200, after: 200 },
      });
    }

    // Task list items
    const taskMatch = /^- \[([ x])\]\s+(.+)$/.exec(trimmed);
    if (taskMatch) {
      const checked = taskMatch[1] === 'x';
      const prefix = checked ? '[x] ' : '[ ] ';
      return new Paragraph({
        children: [
          new TextRun({ text: prefix, font: { name: 'Courier New' } }),
          ...this.parseInlineFormatting(taskMatch[2], TextRun),
        ],
        spacing: { after: 60 },
      });
    }

    // Unordered list items
    const ulMatch = /^(\s*)- (.+)$/.exec(trimmed);
    if (ulMatch) {
      return new Paragraph({
        children: [
          new TextRun({ text: '\u2022 ' }),
          ...this.parseInlineFormatting(ulMatch[2], TextRun),
        ],
        spacing: { after: 60 },
      });
    }

    // Ordered list items
    const olMatch = /^(\s*)(\d+)\.\s+(.+)$/.exec(trimmed);
    if (olMatch) {
      return new Paragraph({
        children: [
          new TextRun({ text: `${olMatch[2]}. ` }),
          ...this.parseInlineFormatting(olMatch[3], TextRun),
        ],
        spacing: { after: 60 },
      });
    }

    // Blockquote
    const bqMatch = /^>\s+(.+)$/.exec(trimmed);
    if (bqMatch) {
      return new Paragraph({
        children: this.parseInlineFormatting(bqMatch[1], TextRun),
        indent: { left: 720 },
        spacing: { after: 80 },
      });
    }

    // Regular paragraph
    return new Paragraph({
      children: this.parseInlineFormatting(trimmed, TextRun),
      spacing: { after: 120 },
    });
  }

  /**
   * Parse inline markdown formatting (bold, italic, code, links)
   * into an array of docx TextRun instances.
   */
  private parseInlineFormatting(
    text: string,
    TextRun: new (options: Record<string, unknown> | string) => unknown,
  ): unknown[] {
    const runs: unknown[] = [];
    // Regex to find bold, italic, code, and links
    const inlineRegex =
      /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)|\[\[([^\]|]+)(?:\|([^\]]+))?\]\])/g;

    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = inlineRegex.exec(text)) !== null) {
      // Add plain text before the match
      if (match.index > lastIndex) {
        runs.push(new TextRun({ text: text.slice(lastIndex, match.index) }));
      }

      if (match[2]) {
        // Bold + italic (***text***)
        runs.push(new TextRun({ text: match[2], bold: true, italics: true }));
      } else if (match[3]) {
        // Bold (**text**)
        runs.push(new TextRun({ text: match[3], bold: true }));
      } else if (match[4]) {
        // Italic (*text*)
        runs.push(new TextRun({ text: match[4], italics: true }));
      } else if (match[5]) {
        // Inline code (`text`)
        runs.push(new TextRun({ text: match[5], font: { name: 'Courier New' } }));
      } else if (match[6] && match[7]) {
        // Link [text](url)
        runs.push(new TextRun({ text: match[6], underline: {} }));
      } else if (match[8]) {
        // Wiki link [[target]] or [[target|alias]]
        const display = match[9] ?? match[8];
        runs.push(new TextRun({ text: display, underline: {} }));
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining plain text
    if (lastIndex < text.length) {
      runs.push(new TextRun({ text: text.slice(lastIndex) }));
    }

    // If nothing was added, add the full text
    if (runs.length === 0) {
      runs.push(new TextRun({ text }));
    }

    return runs;
  }

  // -----------------------------------------------------------------------
  // Data loading
  // -----------------------------------------------------------------------

  private async loadNoteData(workspaceId: string, noteId: string): Promise<NoteData> {
    // Attempt to get note metadata from the notes service
    let noteMeta: { id: string; title: string; path: string } | null = null;

    try {
      noteMeta = (await this.notesService.findById(workspaceId, noteId)) as {
        id: string;
        title: string;
        path: string;
      } | null;
    } catch {
      // findById may throw NotImplementedException in current state;
      // fall through to file-based loading
    }

    if (!noteMeta) {
      throw new NotFoundException(`Note ${noteId} not found in workspace ${workspaceId}`);
    }

    // Read the markdown content from the filesystem
    const filePath = join(this.storageRoot, workspaceId, noteMeta.path);
    let content: string;

    try {
      content = await readFile(filePath, 'utf-8');
    } catch (error) {
      this.logger.error(`Failed to read note file at ${filePath}: ${String(error)}`);
      throw new NotFoundException(`Note file not found at path: ${noteMeta.path}`);
    }

    return {
      id: noteId,
      title: noteMeta.title,
      path: noteMeta.path,
      content,
    };
  }

  // -----------------------------------------------------------------------
  // ZIP creation
  // -----------------------------------------------------------------------

  /**
   * Create a ZIP archive from multiple exported files.
   *
   * Uses a minimal ZIP implementation to avoid adding heavy dependencies.
   * For a production system, consider using archiver or jszip.
   */
  private async createZipArchive(
    files: ExportedFile[],
    format: ExportFormat,
  ): Promise<ExportedFile> {
    try {
      // Attempt to use the archiver package if available
      const archiverFn = tryRequire('archiver');
      if (!archiverFn) throw new Error('archiver is not installed');
      return await this.createZipWithArchiver(files, format, archiverFn);
    } catch {
      // Fallback: create a basic ZIP using Node.js zlib
      return this.createBasicZip(files, format);
    }
  }

  private async createZipWithArchiver(
    files: ExportedFile[],
    _format: ExportFormat,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    archiverFn: any,
  ): Promise<ExportedFile> {
    return new Promise((resolve, reject) => {
      const archive = archiverFn('zip', { zlib: { level: 9 } });

      const chunks: Buffer[] = [];

      archive.on('data', (chunk: Buffer) => chunks.push(chunk));
      archive.on('end', () => {
        resolve({
          filename: `notesaner-export-${Date.now()}.zip`,
          contentType: 'application/zip',
          buffer: Buffer.concat(chunks),
        });
      });
      archive.on('error', reject);

      // Ensure unique filenames by tracking duplicates
      const usedNames = new Map<string, number>();
      for (const file of files) {
        let name = file.filename;
        const count = usedNames.get(name) ?? 0;
        if (count > 0) {
          const ext = name.lastIndexOf('.');
          name =
            ext >= 0 ? `${name.slice(0, ext)} (${count})${name.slice(ext)}` : `${name} (${count})`;
        }
        usedNames.set(file.filename, count + 1);
        archive.append(file.buffer, { name });
      }

      void archive.finalize();
    });
  }

  /**
   * Fallback ZIP creation without archiver — creates a simple
   * concatenated file with a manifest. Not a real ZIP, but serves
   * as a graceful degradation.
   */
  private createBasicZip(files: ExportedFile[], _format: ExportFormat): ExportedFile {
    // Without a proper ZIP library, we concatenate files with a separator.
    // This is a development fallback; production should have archiver installed.
    this.logger.warn('archiver not available, creating concatenated export instead of ZIP');

    const parts: string[] = [
      `# Notesaner Batch Export`,
      `# Exported: ${new Date().toISOString()}`,
      `# Files: ${files.length}`,
      '',
    ];

    for (const file of files) {
      parts.push(`${'='.repeat(72)}`);
      parts.push(`# File: ${file.filename}`);
      parts.push(`${'='.repeat(72)}`);
      parts.push(file.buffer.toString('utf-8'));
      parts.push('');
    }

    return {
      filename: `notesaner-export-${Date.now()}.txt`,
      contentType: 'text/plain; charset=utf-8',
      buffer: Buffer.from(parts.join('\n'), 'utf-8'),
    };
  }

  // -----------------------------------------------------------------------
  // Utility helpers
  // -----------------------------------------------------------------------

  /**
   * Strip YAML frontmatter from markdown content.
   */
  private stripFrontmatter(content: string): string {
    const match = /^---\n[\s\S]*?\n---\n/.exec(content);
    return match ? content.slice(match[0].length) : content;
  }

  /**
   * Sanitize a string for use as a filename.
   */
  private sanitizeFilename(name: string): string {
    return (
      name
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 200) || 'untitled'
    );
  }
}

// ---------------------------------------------------------------------------
// Standalone helpers
// ---------------------------------------------------------------------------

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
