import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { join, basename, extname, dirname, relative, posix } from 'path';
import { readFile, readdir, stat, mkdir, writeFile, access } from 'fs/promises';
import type {
  ImportSource,
  ImportOptionsDto,
  ImportPreviewNote,
  ImportPreviewResult,
  ImportResult,
  ImportError,
  ImportProgressEvent,
  ParsedFrontmatter,
  ObsidianWorkspaceConfig,
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
  tags: string[];
  frontmatter: ParsedFrontmatter;
  wasRecentlyOpen: boolean;
}

interface _UploadedFile {
  originalname: string;
  path: string;
  mimetype: string;
  size: number;
}

/** Callback invoked after each note is processed during executeImport. */
export type ImportProgressCallback = (event: ImportProgressEvent) => void;

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
    const obsidianWorkspace =
      options.source === 'obsidian' && options.parseObsidianWorkspace
        ? await this.readObsidianWorkspaceConfig(extractedPath)
        : null;

    const parsedNotes = await this.parseSource(extractedPath, options.source, obsidianWorkspace);

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
        tags: note.tags.length > 0 ? note.tags : undefined,
        wasRecentlyOpen: note.wasRecentlyOpen || undefined,
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
   *
   * @param onProgress Optional callback invoked after each note is processed.
   *                   Use this to stream SSE progress events to the client.
   */
  async executeImport(
    workspaceId: string,
    extractedPath: string,
    options: ImportOptionsDto,
    onProgress?: ImportProgressCallback,
  ): Promise<ImportResult> {
    const startTime = Date.now();
    const errors: ImportError[] = [];
    let importedNotes = 0;
    let importedAttachments = 0;
    let skippedFiles = 0;

    const obsidianWorkspace =
      options.source === 'obsidian' && options.parseObsidianWorkspace
        ? await this.readObsidianWorkspaceConfig(extractedPath)
        : null;

    const parsedNotes = await this.parseSource(extractedPath, options.source, obsidianWorkspace);
    const total = parsedNotes.length;

    // Emit initial progress event
    onProgress?.({
      phase: 'parsing',
      current: 0,
      total,
      errors: [],
    });

    for (let i = 0; i < parsedNotes.length; i++) {
      const note = parsedNotes[i];

      // Notify that we are working on this file
      onProgress?.({
        phase: 'importing',
        current: i,
        total,
        currentFile: note.originalPath,
        errors: [...errors],
      });

      try {
        const rawTargetPath = this.computeTargetPath(
          note.originalPath,
          options.targetFolder,
          options.preserveFolderStructure,
        );

        let content = note.content;
        if (options.convertLinks) {
          content = this.convertLinksForSource(content, options.source);
        }

        // Resolve conflict before writing
        const resolvedPath = await this.resolveConflict(
          workspaceId,
          rawTargetPath,
          options.conflictStrategy,
        );

        if (resolvedPath === null) {
          // Strategy is 'skip' and the file exists
          skippedFiles++;
          continue;
        }

        // Write the note file
        const absolutePath = join(this.storageRoot, workspaceId, resolvedPath);
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

    // Emit completion event
    onProgress?.({
      phase: 'complete',
      current: total,
      total,
      errors,
    });

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
  private async parseSource(
    extractedPath: string,
    source: ImportSource,
    obsidianWorkspace: ObsidianWorkspaceConfig | null,
  ): Promise<ParsedNote[]> {
    switch (source) {
      case 'obsidian':
        return this.parseObsidianVault(extractedPath, obsidianWorkspace);
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
   * - .md files with [[wiki links]] and ![[embeds]]
   * - .obsidian/ config directory (skipped, except workspace.json when requested)
   * - Attachments in configurable paths (usually root or an "attachments" folder)
   * - YAML frontmatter with tags, aliases, and arbitrary properties
   * - Dataview inline fields (key:: value) and query blocks (```dataview)
   */
  private async parseObsidianVault(
    vaultPath: string,
    obsidianWorkspace: ObsidianWorkspaceConfig | null,
  ): Promise<ParsedNote[]> {
    const notes: ParsedNote[] = [];
    const mdFiles = await this.findFiles(vaultPath, '.md');

    const recentlyOpenSet = new Set(obsidianWorkspace?.lastOpenFiles ?? []);

    for (const filePath of mdFiles) {
      // Skip .obsidian/ and .trash/ directories
      const relativePath = relative(vaultPath, filePath);
      if (relativePath.startsWith('.obsidian') || relativePath.startsWith('.trash')) {
        continue;
      }

      try {
        const rawContent = await readFile(filePath, 'utf-8');
        const warnings: string[] = [];

        // Parse YAML frontmatter
        const frontmatter = this.parseObsidianFrontmatter(rawContent);

        // Convert Obsidian frontmatter tags → notesaner format
        // and strip the raw YAML block so we can re-inject a clean one
        const contentWithoutFm = this.stripFrontmatter(rawContent);
        const normalizedContent = this.rebuildContentWithFrontmatter(
          contentWithoutFm,
          frontmatter,
          rawContent,
        );

        const title =
          frontmatter.title ?? this.extractTitle(rawContent) ?? basename(filePath, '.md');
        const internalLinks = this.extractObsidianLinks(rawContent);
        const attachments = this.extractObsidianEmbeds(rawContent);

        // Check for unsupported / partially-supported features
        if (/```dataview\b/i.test(rawContent)) {
          warnings.push('Contains Dataview queries (will be preserved as code blocks)');
        }
        if (rawContent.includes('%%')) {
          warnings.push('Contains Obsidian comments (will be preserved as-is)');
        }

        // Detect dataview inline fields outside code blocks
        if (this.hasInlineDataviewFields(rawContent)) {
          warnings.push('Contains Dataview inline fields (key:: value) — converted to frontmatter');
        }

        const processedContent = this.processObsidianContent(normalizedContent, frontmatter);

        const stats = await stat(filePath);
        notes.push({
          originalPath: relativePath,
          content: processedContent,
          title,
          sizeBytes: stats.size,
          attachments,
          internalLinks,
          warnings,
          tags: frontmatter.tags,
          frontmatter,
          wasRecentlyOpen: recentlyOpenSet.has(relativePath),
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
          tags: [],
          frontmatter: { tags: [], aliases: [], extra: {} },
          wasRecentlyOpen: false,
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
          tags: [],
          frontmatter: { tags: [], aliases: [], extra: {} },
          wasRecentlyOpen: false,
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
          tags: [],
          frontmatter: { tags: [], aliases: [], extra: {} },
          wasRecentlyOpen: false,
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
          tags: [],
          frontmatter: { tags: [], aliases: [], extra: {} },
          wasRecentlyOpen: false,
        });
      } catch (error) {
        this.logger.warn(`Failed to parse markdown file ${filePath}: ${String(error)}`);
      }
    }

    return notes;
  }

  // -----------------------------------------------------------------------
  // Obsidian frontmatter parsing
  // -----------------------------------------------------------------------

  /**
   * Parse Obsidian YAML frontmatter from raw note content.
   *
   * Handles:
   * - `tags:` as YAML list or inline `[tag1, tag2]` or space-separated string
   * - `aliases:` as YAML list or inline array
   * - `title:` string
   * - All other keys are placed in `extra`
   *
   * Also handles the legacy Obsidian "tags" inline syntax: `#tag` in frontmatter.
   */
  parseObsidianFrontmatter(content: string): ParsedFrontmatter {
    const result: ParsedFrontmatter = {
      tags: [],
      aliases: [],
      extra: {},
    };

    const fmMatch = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
    if (!fmMatch) {
      return result;
    }

    const yamlBody = fmMatch[1];
    const parsed = this.parseSimpleYaml(yamlBody);

    // --- title ---
    if (typeof parsed['title'] === 'string' && parsed['title']) {
      result.title = parsed['title'];
    }

    // --- tags ---
    const rawTags = parsed['tags'];
    if (rawTags !== undefined) {
      result.tags = this.normalizeTagList(rawTags);
      delete parsed['tags'];
    }

    // --- aliases ---
    const rawAliases = parsed['aliases'];
    if (rawAliases !== undefined) {
      result.aliases = this.normalizeStringList(rawAliases);
      delete parsed['aliases'];
    }

    // --- title (already handled, remove from extra) ---
    if ('title' in parsed) {
      delete parsed['title'];
    }

    // --- everything else goes to extra ---
    result.extra = parsed;

    return result;
  }

  /**
   * Minimal YAML parser that handles the subset used in Obsidian frontmatter.
   *
   * Supports:
   * - Scalar values: `key: value`
   * - Block lists:
   *     key:
   *       - item1
   *       - item2
   * - Inline lists: `key: [item1, item2]`
   * - Quoted strings: `key: "value"` or `key: 'value'`
   * - Multiline values are NOT supported (not used in Obsidian frontmatter)
   */
  parseSimpleYaml(yaml: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const lines = yaml.split(/\r?\n/);
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Skip blank lines and comments
      if (!line.trim() || line.trim().startsWith('#')) {
        i++;
        continue;
      }

      const keyMatch = /^([a-zA-Z_][a-zA-Z0-9_-]*):\s*(.*)$/.exec(line);
      if (!keyMatch) {
        i++;
        continue;
      }

      const key = keyMatch[1];
      const valueStr = keyMatch[2].trim();

      if (valueStr === '' || valueStr === '|' || valueStr === '>') {
        // Possible block list or empty value — peek ahead
        const items: string[] = [];
        let j = i + 1;
        while (j < lines.length && /^\s+-\s/.test(lines[j])) {
          const itemMatch = /^\s+-\s+(.+)$/.exec(lines[j]);
          if (itemMatch) {
            items.push(itemMatch[1].trim());
          }
          j++;
        }
        if (items.length > 0) {
          result[key] = items;
          i = j;
        } else {
          result[key] = '';
          i++;
        }
        continue;
      }

      // Inline array: [item1, item2]
      if (valueStr.startsWith('[')) {
        result[key] = this.parseYamlInlineArray(valueStr);
        i++;
        continue;
      }

      // Quoted string
      if (
        (valueStr.startsWith('"') && valueStr.endsWith('"')) ||
        (valueStr.startsWith("'") && valueStr.endsWith("'"))
      ) {
        result[key] = valueStr.slice(1, -1);
        i++;
        continue;
      }

      // Boolean / null / number coercion
      if (valueStr === 'true') {
        result[key] = true;
      } else if (valueStr === 'false') {
        result[key] = false;
      } else if (valueStr === 'null' || valueStr === '~') {
        result[key] = null;
      } else if (/^-?\d+(\.\d+)?$/.test(valueStr)) {
        result[key] = Number(valueStr);
      } else {
        result[key] = valueStr;
      }

      i++;
    }

    return result;
  }

  /**
   * Parse a YAML inline array string like `[item1, "item 2", item3]`.
   */
  private parseYamlInlineArray(str: string): string[] {
    const inner = str.replace(/^\[|\]$/g, '').trim();
    if (!inner) return [];

    const items: string[] = [];
    // Split on commas not inside quotes
    const parts = inner.split(/,(?=(?:[^"']*["'][^"']*["'])*[^"']*$)/);
    for (const part of parts) {
      const trimmed = part.trim();
      if (
        (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))
      ) {
        items.push(trimmed.slice(1, -1));
      } else {
        items.push(trimmed);
      }
    }
    return items.filter(Boolean);
  }

  /**
   * Normalize a tag value from frontmatter into a string[].
   * Strips leading `#` characters (Obsidian sometimes includes them).
   */
  private normalizeTagList(raw: unknown): string[] {
    const list = this.normalizeStringList(raw);
    return list.map((tag) => tag.replace(/^#+/, '').trim()).filter(Boolean);
  }

  /**
   * Normalize an unknown YAML value into a string[].
   *
   * Also strips surrounding single/double quotes from individual items
   * (Obsidian sometimes writes `- "#tag"` in block lists).
   */
  private normalizeStringList(raw: unknown): string[] {
    const stripQuotes = (s: string): string => {
      const trimmed = s.trim();
      if (
        (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))
      ) {
        return trimmed.slice(1, -1);
      }
      return trimmed;
    };

    if (Array.isArray(raw)) {
      return raw
        .filter((item) => typeof item === 'string')
        .map((item) => stripQuotes(String(item)));
    }
    if (typeof raw === 'string') {
      // Could be a space-separated or comma-separated list
      return raw
        .split(/[,\s]+/)
        .map((s) => stripQuotes(s))
        .filter(Boolean);
    }
    return [];
  }

  /**
   * Strip the YAML frontmatter block from content.
   */
  private stripFrontmatter(content: string): string {
    return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
  }

  /**
   * Rebuild note content by prepending a clean frontmatter block.
   *
   * When the original had no frontmatter, the original content is returned unchanged.
   */
  private rebuildContentWithFrontmatter(
    contentWithoutFm: string,
    frontmatter: ParsedFrontmatter,
    originalContent: string,
  ): string {
    // No frontmatter in original → return untouched
    if (!/^---\r?\n/.test(originalContent)) {
      return originalContent;
    }

    const lines: string[] = ['---'];

    if (frontmatter.title) {
      lines.push(`title: ${frontmatter.title}`);
    }

    if (frontmatter.tags.length > 0) {
      lines.push('tags:');
      for (const tag of frontmatter.tags) {
        lines.push(`  - ${tag}`);
      }
    }

    if (frontmatter.aliases.length > 0) {
      lines.push('aliases:');
      for (const alias of frontmatter.aliases) {
        lines.push(`  - ${alias}`);
      }
    }

    for (const [key, value] of Object.entries(frontmatter.extra)) {
      if (value === null) {
        lines.push(`${key}: null`);
      } else if (Array.isArray(value)) {
        lines.push(`${key}:`);
        for (const item of value) {
          lines.push(`  - ${String(item)}`);
        }
      } else if (typeof value === 'string') {
        // Quote strings containing special YAML characters
        if (/[:#\[\]{}|>&*!,?]/.test(value)) {
          lines.push(`${key}: "${value.replace(/"/g, '\\"')}"`);
        } else {
          lines.push(`${key}: ${value}`);
        }
      } else {
        lines.push(`${key}: ${String(value)}`);
      }
    }

    lines.push('---');

    return `${lines.join('\n')}\n${contentWithoutFm}`;
  }

  // -----------------------------------------------------------------------
  // Obsidian content processing
  // -----------------------------------------------------------------------

  /**
   * Apply all Obsidian-specific content transformations:
   * 1. Convert embedded image syntax `![[image.png|200]]` to standard MD
   * 2. Convert inline Dataview fields (key:: value) to frontmatter additions
   *    when they appear outside code/quote blocks
   *
   * Wiki-link conversion happens separately in `convertLinksForSource`.
   */
  private processObsidianContent(content: string, frontmatter: ParsedFrontmatter): string {
    let processed = content;

    // 1. Convert ![[embed|size]] image embeds to standard MD images
    processed = this.convertObsidianEmbeds(processed);

    // 2. Convert inline Dataview fields to frontmatter
    processed = this.convertInlineDataviewFields(processed, frontmatter);

    return processed;
  }

  /**
   * Convert Obsidian embed syntax to standard markdown image syntax.
   *
   * Patterns handled:
   *   ![[image.png]]               → ![image](image.png)
   *   ![[image.png|200]]           → ![200](image.png)  (width hint as alt)
   *   ![[image.png|alt text]]      → ![alt text](image.png)
   *   ![[Note title]]              → HTML comment (transclusion)
   *
   * Image file extensions: png, jpg, jpeg, gif, svg, webp, bmp, tiff, avif
   */
  convertObsidianEmbeds(content: string): string {
    const imageExtensions = new Set([
      'png',
      'jpg',
      'jpeg',
      'gif',
      'svg',
      'webp',
      'bmp',
      'tiff',
      'avif',
    ]);

    return content.replace(/!\[\[([^\]]+)\]\]/g, (_match, inner: string) => {
      // Split on | to get filename and optional alt/size
      const pipeIdx = inner.indexOf('|');
      const filePart = pipeIdx === -1 ? inner : inner.slice(0, pipeIdx);
      const altOrSize = pipeIdx === -1 ? '' : inner.slice(pipeIdx + 1);

      const fileExt = extname(filePart).slice(1).toLowerCase();

      if (imageExtensions.has(fileExt)) {
        const altText = altOrSize || basename(filePart, `.${fileExt}`);
        // URL-encode spaces in the path
        const encodedPath = filePart.replace(/ /g, '%20');
        return `![${altText}](${encodedPath})`;
      }

      // Non-image embed (note transclusion) — preserve as a comment block
      const label = altOrSize || filePart;
      return `<!-- obsidian-embed: ${label} -->`;
    });
  }

  /**
   * Returns true if the content has inline Dataview fields (`key:: value`)
   * that appear outside fenced code blocks.
   */
  hasInlineDataviewFields(content: string): boolean {
    const lines = content.split('\n');
    let inFence = false;

    for (const line of lines) {
      if (/^```/.test(line)) {
        inFence = !inFence;
        continue;
      }
      if (inFence) continue;

      // Match "key:: value" where key is not preceded by list markers/quotes
      if (/^[a-zA-Z_][a-zA-Z0-9_\s-]*::\s*\S/.test(line.trim())) {
        return true;
      }
    }

    return false;
  }

  /**
   * Convert Dataview inline fields (`key:: value`) to YAML frontmatter entries.
   *
   * Fields that appear outside code blocks and outside list-item contexts are
   * extracted and injected into the frontmatter. The original `key:: value`
   * line is removed from the body.
   *
   * Fields that appear inside list items (e.g., `- status:: done`) are left
   * in place because they have semantic value in the outliner context.
   */
  private convertInlineDataviewFields(content: string, frontmatter: ParsedFrontmatter): string {
    const lines = content.split('\n');
    const resultLines: string[] = [];
    let inFence = false;
    const extractedFields: Record<string, string> = {};

    for (const line of lines) {
      if (/^```/.test(line)) {
        inFence = !inFence;
        resultLines.push(line);
        continue;
      }

      if (inFence) {
        resultLines.push(line);
        continue;
      }

      const trimmed = line.trim();

      // Match standalone "key:: value" lines (not inside list items)
      // List items have leading whitespace + "- " or "* "
      const isListItem = /^[\t ]+[-*+]\s/.test(line) || /^[-*+]\s/.test(line);
      const dvMatch = !isListItem && /^([a-zA-Z_][a-zA-Z0-9_\s-]*)::\s*(.+)$/.exec(trimmed);

      if (dvMatch) {
        const key = dvMatch[1].trim().toLowerCase().replace(/\s+/g, '_');
        const value = dvMatch[2].trim();

        // Tags get merged into the frontmatter tags list
        if (key === 'tags' || key === 'tag') {
          const newTags = value
            .split(/[,\s]+/)
            .map((t) => t.replace(/^#+/, '').trim())
            .filter(Boolean);
          frontmatter.tags.push(...newTags);
        } else {
          extractedFields[key] = value;
        }
        // Remove this line from the output
        continue;
      }

      resultLines.push(line);
    }

    // Inject any extracted fields into frontmatter.extra
    for (const [key, value] of Object.entries(extractedFields)) {
      if (!(key in frontmatter.extra)) {
        frontmatter.extra[key] = value;
      }
    }

    return resultLines.join('\n');
  }

  // -----------------------------------------------------------------------
  // Obsidian workspace config
  // -----------------------------------------------------------------------

  /**
   * Read and parse `.obsidian/workspace.json` from the vault root.
   *
   * Returns null silently if the file does not exist or is malformed.
   */
  async readObsidianWorkspaceConfig(vaultPath: string): Promise<ObsidianWorkspaceConfig | null> {
    const workspaceJsonPath = join(vaultPath, '.obsidian', 'workspace.json');

    try {
      await access(workspaceJsonPath);
      const raw = await readFile(workspaceJsonPath, 'utf-8');
      const parsed: unknown = JSON.parse(raw);

      if (typeof parsed !== 'object' || parsed === null) {
        return null;
      }

      const config = parsed as Record<string, unknown>;

      // Obsidian workspace.json stores last-open files at the top level
      // as "lastOpenFiles" (array of strings)
      const lastOpenFiles = Array.isArray(config['lastOpenFiles'])
        ? (config['lastOpenFiles'] as unknown[]).filter((f): f is string => typeof f === 'string')
        : [];

      return { lastOpenFiles };
    } catch {
      // File doesn't exist or parse error — not a blocker
      return null;
    }
  }

  // -----------------------------------------------------------------------
  // Conflict resolution
  // -----------------------------------------------------------------------

  /**
   * Resolve a potential conflict for a target path given the workspace.
   *
   * Returns:
   * - The original `targetPath` if no conflict exists or strategy is `overwrite`
   * - A renamed path (e.g., `Note (1).md`) if strategy is `rename`
   * - `null` if strategy is `skip` and the file already exists
   */
  async resolveConflict(
    workspaceId: string,
    targetPath: string,
    strategy: ImportOptionsDto['conflictStrategy'],
  ): Promise<string | null> {
    const absolutePath = join(this.storageRoot, workspaceId, targetPath);

    const exists = await this.fileExists(absolutePath);
    if (!exists) {
      return targetPath;
    }

    switch (strategy) {
      case 'overwrite':
        return targetPath;

      case 'skip':
        return null;

      case 'rename': {
        // Try "Note (1).md", "Note (2).md", …
        const ext = extname(targetPath);
        const withoutExt = targetPath.slice(0, targetPath.length - ext.length);
        let counter = 1;
        let candidate: string;
        do {
          candidate = `${withoutExt} (${counter})${ext}`;
          counter++;
        } while (await this.fileExists(join(this.storageRoot, workspaceId, candidate)));
        return candidate;
      }
    }
  }

  /**
   * Check whether a file exists at the given absolute path.
   */
  private async fileExists(absolutePath: string): Promise<boolean> {
    try {
      await access(absolutePath);
      return true;
    } catch {
      return false;
    }
  }

  // -----------------------------------------------------------------------
  // Link extraction
  // -----------------------------------------------------------------------

  /**
   * Extract Obsidian-style [[wiki links]] from content.
   * Handles:
   *   [[Note name]]
   *   [[Note name|alias]]
   *   [[Note name#heading]]
   *   [[Note name#heading|alias]]
   *   [[Folder/Note name]]
   */
  private extractObsidianLinks(content: string): string[] {
    const links: string[] = [];
    const regex = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]+)?\]\]/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      links.push(match[1].trim());
    }
    return [...new Set(links)];
  }

  /**
   * Extract Obsidian embeds (images and transclusions) from content.
   * Handles: ![[image.png]], ![[image.png|200]], ![[Note title]]
   */
  private extractObsidianEmbeds(content: string): string[] {
    const embeds: string[] = [];
    const regex = /!\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      embeds.push(match[1].trim());
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
   * Normalize Obsidian wiki links to Notesaner format.
   *
   * Handles:
   *   [[Note]]            → [[Note]]
   *   [[Folder/Note]]     → [[Note]]   (strip path prefix)
   *   [[Note|alias]]      → [[Note|alias]]
   *   [[Note#heading]]    → [[Note#heading]]  (heading anchor preserved)
   *   [[Note#heading|alias]] → [[Note#heading|alias]]
   */
  private normalizeObsidianLinks(content: string): string {
    return content.replace(
      /\[\[([^\]|#]+?)(?:(#[^\]|]*?))?(?:\|([^\]]+?))?\]\]/g,
      (_match, target: string, heading: string | undefined, alias: string | undefined) => {
        // Remove folder paths from the target for cleaner links
        const noteNameOnly = basename(target.trim(), '.md');
        const anchor = heading ?? '';
        if (alias) {
          return `[[${noteNameOnly}${anchor}|${alias}]]`;
        }
        return `[[${noteNameOnly}${anchor}]]`;
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
