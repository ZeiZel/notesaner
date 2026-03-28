import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { join, basename, extname, dirname, relative, posix } from 'path';
import { readFile, readdir, stat, mkdir, writeFile } from 'fs/promises';
import type {
  ImportSource,
  ImportOptionsDto,
  ImportPreviewNote,
  ImportPreviewResult,
  ImportResult,
  ImportError,
} from './dto/import.dto';

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface ParsedNote {
  originalPath: string;
  content: string;
  title: string;
  sizeBytes: number;
  attachments: string[];
  internalLinks: string[];
  warnings: string[];
}

interface _UploadedFile {
  originalname: string;
  path: string;
  mimetype: string;
  size: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);
  private readonly storageRoot: string;

  constructor(configService: ConfigService) {
    this.storageRoot = configService.get<string>('storage.root') ?? '/var/lib/notesaner/workspaces';
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Preview what an import will do without actually importing.
   *
   * Parses the uploaded files, extracts notes, and returns a preview
   * of what will be created.
   */
  async previewImport(
    extractedPath: string,
    options: ImportOptionsDto,
  ): Promise<ImportPreviewResult> {
    const parsedNotes = await this.parseSource(extractedPath, options.source);

    const warnings: string[] = [];
    let totalAttachments = 0;
    let totalSizeBytes = 0;

    const previewNotes: ImportPreviewNote[] = parsedNotes.map((note) => {
      const targetPath = this.computeTargetPath(
        note.originalPath,
        options.targetFolder,
        options.preserveFolderStructure,
      );

      totalAttachments += note.attachments.length;
      totalSizeBytes += note.sizeBytes;

      return {
        originalPath: note.originalPath,
        targetPath,
        title: note.title,
        sizeBytes: note.sizeBytes,
        hasAttachments: note.attachments.length > 0,
        linkCount: note.internalLinks.length,
        warnings: note.warnings,
      };
    });

    if (parsedNotes.length === 0) {
      warnings.push('No markdown files found in the uploaded content.');
    }

    return {
      source: options.source,
      totalNotes: parsedNotes.length,
      totalAttachments,
      totalSizeBytes,
      notes: previewNotes,
      warnings,
    };
  }

  /**
   * Execute the actual import: parse, convert, and write notes to the workspace.
   */
  async executeImport(
    workspaceId: string,
    extractedPath: string,
    options: ImportOptionsDto,
  ): Promise<ImportResult> {
    const startTime = Date.now();
    const errors: ImportError[] = [];
    let importedNotes = 0;
    let importedAttachments = 0;
    let skippedFiles = 0;

    const parsedNotes = await this.parseSource(extractedPath, options.source);

    for (const note of parsedNotes) {
      try {
        const targetPath = this.computeTargetPath(
          note.originalPath,
          options.targetFolder,
          options.preserveFolderStructure,
        );

        let content = note.content;
        if (options.convertLinks) {
          content = this.convertLinksForSource(content, options.source);
        }

        // Write the note file
        const absolutePath = join(this.storageRoot, workspaceId, targetPath);
        await mkdir(dirname(absolutePath), { recursive: true });
        await writeFile(absolutePath, content, 'utf-8');
        importedNotes++;

        // Import attachments if enabled
        if (options.importAttachments && note.attachments.length > 0) {
          for (const attachment of note.attachments) {
            try {
              const attachmentSource = join(extractedPath, attachment);
              const attachmentTarget = join(
                this.storageRoot,
                workspaceId,
                options.targetFolder,
                'attachments',
                basename(attachment),
              );
              await mkdir(dirname(attachmentTarget), { recursive: true });

              const attachmentData = await readFile(attachmentSource);
              await writeFile(attachmentTarget, attachmentData);
              importedAttachments++;
            } catch (error) {
              errors.push({
                file: attachment,
                message: `Failed to import attachment: ${String(error)}`,
                recoverable: true,
              });
            }
          }
        }
      } catch (error) {
        errors.push({
          file: note.originalPath,
          message: `Failed to import note: ${String(error)}`,
          recoverable: true,
        });
        skippedFiles++;
      }
    }

    const duration = Date.now() - startTime;

    this.logger.log(
      `Import complete: ${importedNotes} notes, ${importedAttachments} attachments, ` +
        `${skippedFiles} skipped, ${errors.length} errors in ${duration}ms`,
    );

    return {
      importedNotes,
      importedAttachments,
      skippedFiles,
      errors,
      duration,
    };
  }

  // -----------------------------------------------------------------------
  // Source parsers
  // -----------------------------------------------------------------------

  /**
   * Route to the appropriate parser based on import source type.
   */
  private async parseSource(extractedPath: string, source: ImportSource): Promise<ParsedNote[]> {
    switch (source) {
      case 'obsidian':
        return this.parseObsidianVault(extractedPath);
      case 'notion':
        return this.parseNotionExport(extractedPath);
      case 'logseq':
        return this.parseLogseqExport(extractedPath);
      case 'markdown':
        return this.parseMarkdownFiles(extractedPath);
      default:
        throw new BadRequestException(`Unsupported import source: ${source as string}`);
    }
  }

  /**
   * Parse an Obsidian vault.
   *
   * Obsidian vaults contain:
   * - .md files with [[wiki links]]
   * - .obsidian/ config directory (ignored)
   * - Attachments in configurable paths (usually root or an "attachments" folder)
   */
  private async parseObsidianVault(vaultPath: string): Promise<ParsedNote[]> {
    const notes: ParsedNote[] = [];
    const mdFiles = await this.findFiles(vaultPath, '.md');

    for (const filePath of mdFiles) {
      // Skip .obsidian/ and .trash/ directories
      const relativePath = relative(vaultPath, filePath);
      if (relativePath.startsWith('.obsidian') || relativePath.startsWith('.trash')) {
        continue;
      }

      try {
        const content = await readFile(filePath, 'utf-8');
        const title = this.extractTitle(content) ?? basename(filePath, '.md');
        const internalLinks = this.extractObsidianLinks(content);
        const attachments = this.extractObsidianEmbeds(content);
        const warnings: string[] = [];

        // Check for unsupported features
        if (content.includes('```dataview')) {
          warnings.push('Contains Dataview queries (will be preserved as code blocks)');
        }
        if (content.includes('%%')) {
          warnings.push('Contains Obsidian comments (will be preserved as-is)');
        }

        const stats = await stat(filePath);
        notes.push({
          originalPath: relativePath,
          content,
          title,
          sizeBytes: stats.size,
          attachments,
          internalLinks,
          warnings,
        });
      } catch (error) {
        this.logger.warn(`Failed to parse Obsidian file ${filePath}: ${String(error)}`);
      }
    }

    return notes;
  }

  /**
   * Parse a Notion export.
   *
   * Notion exports contain:
   * - .md files with Notion-specific formatting
   * - .csv files for databases (converted to tables)
   * - Folders with random hex suffixes (e.g., "My Page a1b2c3d4e5f6")
   * - Internal links use Notion IDs
   */
  private async parseNotionExport(exportPath: string): Promise<ParsedNote[]> {
    const notes: ParsedNote[] = [];
    const mdFiles = await this.findFiles(exportPath, '.md');

    for (const filePath of mdFiles) {
      try {
        let content = await readFile(filePath, 'utf-8');
        const relativePath = relative(exportPath, filePath);
        const warnings: string[] = [];

        // Clean Notion-specific path formatting (remove hex suffixes)
        const cleanPath = this.cleanNotionPath(relativePath);

        // Clean Notion formatting quirks
        content = this.cleanNotionContent(content);

        const title = this.extractTitle(content) ?? basename(cleanPath, '.md');
        const internalLinks = this.extractNotionLinks(content);
        const attachments = this.extractMarkdownImages(content);

        // Detect Notion-specific features
        if (content.includes('/toggle')) {
          warnings.push('Contains Notion toggle blocks (converted to details/summary)');
        }
        if (content.includes('> [!')) {
          warnings.push('Contains Notion callout blocks (preserved as blockquotes)');
        }

        const stats = await stat(filePath);
        notes.push({
          originalPath: cleanPath,
          content,
          title,
          sizeBytes: stats.size,
          attachments,
          internalLinks,
          warnings,
        });
      } catch (error) {
        this.logger.warn(`Failed to parse Notion file ${filePath}: ${String(error)}`);
      }
    }

    // Also try to convert CSV files (Notion databases)
    const csvFiles = await this.findFiles(exportPath, '.csv');
    for (const csvPath of csvFiles) {
      try {
        const csvContent = await readFile(csvPath, 'utf-8');
        const relativePath = relative(exportPath, csvPath);
        const tableMd = this.csvToMarkdownTable(csvContent);
        const title = basename(relativePath, '.csv');
        const stats = await stat(csvPath);

        notes.push({
          originalPath: relativePath.replace('.csv', '.md'),
          content: `# ${title}\n\n${tableMd}`,
          title,
          sizeBytes: stats.size,
          attachments: [],
          internalLinks: [],
          warnings: ['Converted from Notion database CSV export'],
        });
      } catch (error) {
        this.logger.warn(`Failed to parse Notion CSV ${csvPath}: ${String(error)}`);
      }
    }

    return notes;
  }

  /**
   * Parse a Logseq export.
   *
   * Logseq uses an outliner format:
   * - Bullet-based hierarchy (each line starts with "- " or "  - ")
   * - Pages in pages/ directory, journals in journals/ directory
   * - Internal links use [[double brackets]]
   * - Properties use key:: value syntax on the first bullet
   */
  private async parseLogseqExport(exportPath: string): Promise<ParsedNote[]> {
    const notes: ParsedNote[] = [];

    // Logseq typically has pages/ and journals/ directories
    const pagesDir = join(exportPath, 'pages');
    const journalsDir = join(exportPath, 'journals');

    const dirs = [exportPath];
    try {
      await stat(pagesDir);
      dirs.push(pagesDir);
    } catch {
      // pages/ directory doesn't exist
    }
    try {
      await stat(journalsDir);
      dirs.push(journalsDir);
    } catch {
      // journals/ directory doesn't exist
    }

    const mdFiles = new Set<string>();
    for (const dir of dirs) {
      for (const f of await this.findFiles(dir, '.md')) {
        mdFiles.add(f);
      }
    }

    for (const filePath of mdFiles) {
      try {
        let content = await readFile(filePath, 'utf-8');
        const relativePath = relative(exportPath, filePath);
        const warnings: string[] = [];

        // Skip Logseq config files
        if (relativePath.startsWith('logseq/')) continue;

        // Convert Logseq outliner format to standard markdown
        content = this.convertLogseqToMarkdown(content);

        const title = this.extractTitle(content) ?? basename(filePath, '.md');
        const internalLinks = this.extractObsidianLinks(content); // Logseq uses same link format
        const attachments = this.extractMarkdownImages(content);

        // Detect Logseq-specific features
        if (content.includes('collapsed:: true')) {
          warnings.push('Contains collapsed blocks (expanded during conversion)');
        }
        if (content.includes('query-table::')) {
          warnings.push('Contains Logseq queries (preserved as text)');
        }

        const stats = await stat(filePath);
        notes.push({
          originalPath: relativePath,
          content,
          title,
          sizeBytes: stats.size,
          attachments,
          internalLinks,
          warnings,
        });
      } catch (error) {
        this.logger.warn(`Failed to parse Logseq file ${filePath}: ${String(error)}`);
      }
    }

    return notes;
  }

  /**
   * Parse plain markdown files (generic import).
   */
  private async parseMarkdownFiles(dirPath: string): Promise<ParsedNote[]> {
    const notes: ParsedNote[] = [];
    const mdFiles = await this.findFiles(dirPath, '.md');

    for (const filePath of mdFiles) {
      try {
        const content = await readFile(filePath, 'utf-8');
        const relativePath = relative(dirPath, filePath);
        const title = this.extractTitle(content) ?? basename(filePath, '.md');
        const internalLinks = this.extractObsidianLinks(content);
        const attachments = this.extractMarkdownImages(content);
        const stats = await stat(filePath);

        notes.push({
          originalPath: relativePath,
          content,
          title,
          sizeBytes: stats.size,
          attachments,
          internalLinks,
          warnings: [],
        });
      } catch (error) {
        this.logger.warn(`Failed to parse markdown file ${filePath}: ${String(error)}`);
      }
    }

    return notes;
  }

  // -----------------------------------------------------------------------
  // Link extraction
  // -----------------------------------------------------------------------

  /**
   * Extract Obsidian-style [[wiki links]] from content.
   */
  private extractObsidianLinks(content: string): string[] {
    const links: string[] = [];
    const regex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      links.push(match[1]);
    }
    return [...new Set(links)];
  }

  /**
   * Extract Obsidian embeds (images and transclusions) from content.
   */
  private extractObsidianEmbeds(content: string): string[] {
    const embeds: string[] = [];
    const regex = /!\[\[([^\]]+)\]\]/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      embeds.push(match[1]);
    }
    return [...new Set(embeds)];
  }

  /**
   * Extract Notion-style internal links from content.
   */
  private extractNotionLinks(content: string): string[] {
    const links: string[] = [];
    // Notion uses relative markdown links with encoded paths
    const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      const url = match[2];
      // Filter to internal links (relative, not http)
      if (!url.startsWith('http') && !url.startsWith('mailto:')) {
        links.push(decodeURIComponent(url));
      }
    }
    return [...new Set(links)];
  }

  /**
   * Extract standard markdown image references.
   */
  private extractMarkdownImages(content: string): string[] {
    const images: string[] = [];
    const regex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      const url = match[2];
      // Only include local paths, not URLs
      if (!url.startsWith('http')) {
        images.push(decodeURIComponent(url));
      }
    }
    return [...new Set(images)];
  }

  // -----------------------------------------------------------------------
  // Link conversion
  // -----------------------------------------------------------------------

  /**
   * Convert internal links from source format to Notesaner wiki-link format.
   */
  private convertLinksForSource(content: string, source: ImportSource): string {
    switch (source) {
      case 'obsidian':
        // Obsidian already uses [[wiki links]], just normalize
        return this.normalizeObsidianLinks(content);
      case 'notion':
        return this.convertNotionLinks(content);
      case 'logseq':
        // Logseq uses same [[wiki link]] format as Obsidian
        return this.normalizeObsidianLinks(content);
      case 'markdown':
        return content; // No conversion needed for generic MD
      default:
        return content;
    }
  }

  /**
   * Normalize Obsidian wiki links (remove path components, keep aliases).
   */
  private normalizeObsidianLinks(content: string): string {
    // Keep [[links]] as-is since Notesaner uses the same format
    // But normalize any path-based links to just the note name
    return content.replace(
      /\[\[([^\]|]+?)(?:\|([^\]]+))?\]\]/g,
      (_match, target: string, alias: string | undefined) => {
        // Remove folder paths from the target for cleaner links
        const noteNameOnly = basename(target, '.md');
        if (alias) {
          return `[[${noteNameOnly}|${alias}]]`;
        }
        return `[[${noteNameOnly}]]`;
      },
    );
  }

  /**
   * Convert Notion relative links to wiki-link format.
   */
  private convertNotionLinks(content: string): string {
    return content.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, text: string, url: string) => {
      // External links stay as-is
      if (url.startsWith('http') || url.startsWith('mailto:')) {
        return _match;
      }

      // Internal links: convert to wiki-link
      const decoded = decodeURIComponent(url);
      // Remove Notion hex suffixes and .md extension
      const cleanName = this.cleanNotionPageName(decoded);
      if (cleanName === text) {
        return `[[${cleanName}]]`;
      }
      return `[[${cleanName}|${text}]]`;
    });
  }

  // -----------------------------------------------------------------------
  // Notion-specific helpers
  // -----------------------------------------------------------------------

  /**
   * Remove Notion's hex ID suffixes from paths.
   * Example: "My Page a1b2c3d4e5f6.md" -> "My Page.md"
   */
  private cleanNotionPath(path: string): string {
    // Notion appends a 32-char hex ID separated by a space
    return path.replace(/\s+[a-f0-9]{32}/g, '');
  }

  /**
   * Clean a Notion page name by removing hex suffixes and extensions.
   */
  private cleanNotionPageName(name: string): string {
    let clean = name;
    // Remove .md extension
    clean = clean.replace(/\.md$/, '');
    // Remove Notion hex suffix
    clean = clean.replace(/\s+[a-f0-9]{32}$/, '');
    // Clean up encoded characters
    clean = decodeURIComponent(clean);
    // Get just the filename
    clean = basename(clean);
    return clean;
  }

  /**
   * Clean Notion-specific content formatting.
   */
  private cleanNotionContent(content: string): string {
    let cleaned = content;

    // Remove Notion's empty link placeholders
    cleaned = cleaned.replace(/\[([^\]]*)\]\(\)/g, '$1');

    // Convert Notion callout blocks to standard blockquotes
    cleaned = cleaned.replace(/^> ([^\n]+)\n>/gm, '> $1');

    // Clean up excessive whitespace from Notion export
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    return cleaned;
  }

  // -----------------------------------------------------------------------
  // Logseq-specific helpers
  // -----------------------------------------------------------------------

  /**
   * Convert Logseq's outliner format to standard markdown.
   *
   * Logseq uses:
   * - "- " prefixed bullets at various indent levels
   * - "key:: value" property syntax
   * - "collapsed:: true" for collapsed blocks
   */
  private convertLogseqToMarkdown(content: string): string {
    const lines = content.split('\n');
    const result: string[] = [];
    let inPropertiesBlock = false;
    const frontmatterProps: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip empty lines
      if (trimmed === '') {
        if (!inPropertiesBlock) {
          result.push('');
        }
        continue;
      }

      // Handle page-level properties (first few lines with key:: value format)
      const propMatch = /^([a-zA-Z_-]+)::\s*(.+)$/.exec(trimmed);
      if (propMatch && i < 10 && !trimmed.startsWith('- ')) {
        inPropertiesBlock = true;
        const key = propMatch[1].toLowerCase();
        // Skip Logseq internal properties
        if (!['collapsed', 'id', 'heading'].includes(key)) {
          frontmatterProps.push(`${key}: ${propMatch[2]}`);
        }
        continue;
      }

      if (inPropertiesBlock && trimmed.startsWith('- ')) {
        inPropertiesBlock = false;
        // Add frontmatter if we collected any
        if (frontmatterProps.length > 0) {
          result.unshift(`---\n${frontmatterProps.join('\n')}\n---\n`);
        }
      }

      // Convert bullet points: measure indentation, then strip "- "
      if (trimmed.startsWith('- ')) {
        const indent = line.length - line.trimStart().length;
        const bulletContent = trimmed.slice(2);

        // Skip Logseq property bullets
        const bulletPropMatch = /^([a-zA-Z_-]+)::\s*(.+)$/.exec(bulletContent);
        if (bulletPropMatch) {
          const key = bulletPropMatch[1].toLowerCase();
          if (['collapsed', 'id', 'heading'].includes(key)) {
            continue;
          }
        }

        // Check if this is a heading (Logseq marks headings with "heading:: true")
        const nextLine = i + 1 < lines.length ? lines[i + 1]?.trim() : '';
        if (nextLine?.startsWith('heading::')) {
          // Determine heading level from indent
          const headingLevel = Math.min(Math.floor(indent / 2) + 1, 6);
          result.push(`${'#'.repeat(headingLevel)} ${bulletContent}`);
          i++; // Skip the heading:: line
          continue;
        }

        // Regular bullet: convert indent to nested list or paragraph
        if (indent === 0) {
          result.push(bulletContent);
        } else {
          const nestLevel = Math.floor(indent / 2);
          result.push(`${'  '.repeat(nestLevel)}- ${bulletContent}`);
        }
      } else {
        result.push(line);
      }
    }

    // Add frontmatter if collected but never flushed
    if (frontmatterProps.length > 0 && result[0] !== '---') {
      result.unshift(`---\n${frontmatterProps.join('\n')}\n---\n`);
    }

    return result.join('\n');
  }

  // -----------------------------------------------------------------------
  // Shared helpers
  // -----------------------------------------------------------------------

  /**
   * Recursively find all files with a given extension in a directory.
   */
  private async findFiles(dirPath: string, extension: string): Promise<string[]> {
    const results: string[] = [];

    try {
      const entries = await readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dirPath, entry.name);

        if (entry.isDirectory()) {
          // Skip hidden directories
          if (entry.name.startsWith('.')) continue;
          const nested = await this.findFiles(fullPath, extension);
          results.push(...nested);
        } else if (entry.isFile() && extname(entry.name).toLowerCase() === extension) {
          results.push(fullPath);
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to read directory ${dirPath}: ${String(error)}`);
    }

    return results;
  }

  /**
   * Extract the first heading from markdown content as the title.
   */
  private extractTitle(content: string): string | null {
    // Try to extract from frontmatter title
    const fmMatch = /^---\n[\s\S]*?^title:\s*(.+)$/m.exec(content);
    if (fmMatch) return fmMatch[1].trim().replace(/^["']|["']$/g, '');

    // Try first H1
    const h1Match = /^#\s+(.+)$/m.exec(content);
    if (h1Match) return h1Match[1].trim();

    return null;
  }

  /**
   * Compute the target path for an imported note within the workspace.
   */
  private computeTargetPath(
    originalPath: string,
    targetFolder: string,
    preserveFolderStructure: boolean,
  ): string {
    const normalizedPath = originalPath.split(/[\\/]/).join(posix.sep);

    if (preserveFolderStructure) {
      return posix.join(targetFolder, normalizedPath);
    }

    // Flatten: just use the filename
    return posix.join(targetFolder, basename(normalizedPath));
  }

  /**
   * Convert a CSV string to a markdown table.
   */
  private csvToMarkdownTable(csv: string): string {
    const lines = csv.split('\n').filter((line) => line.trim());
    if (lines.length === 0) return '';

    const parseRow = (line: string): string[] => {
      const cells: string[] = [];
      let current = '';
      let inQuotes = false;

      for (const char of line) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          cells.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      cells.push(current.trim());
      return cells;
    };

    const header = parseRow(lines[0]);
    const rows = lines.slice(1).map(parseRow);

    const headerRow = `| ${header.join(' | ')} |`;
    const separator = `| ${header.map(() => '---').join(' | ')} |`;
    const dataRows = rows.map((row) => `| ${row.join(' | ')} |`);

    return [headerRow, separator, ...dataRows].join('\n');
  }
}
