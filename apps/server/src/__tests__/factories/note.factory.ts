/**
 * Note factory for generating test fixtures.
 *
 * Usage:
 *   createNote().build()                                      // random note
 *   createNote().inWorkspace('ws-id').build()                  // specific workspace
 *   createNote().withPath('daily/2026-03-28.md').build()       // specific path
 *   createNote().published().build()                           // published note
 *   createNote().trashed().build()                             // soft-deleted note
 *   createNote().withContent('# Hello').build()                // specific content
 *   createNote().inFolder('Projects').build()                  // in Projects folder
 *   createNote().many(10)                                      // array of 10 notes
 */

import { faker } from '@faker-js/faker';
import type { Prisma } from '@prisma/client';
import { FactoryBuilder, generateId, nextSequence, sha256 } from './base';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface NoteFixture {
  id: string;
  workspaceId: string;
  path: string;
  title: string;
  contentHash: string | null;
  wordCount: number;
  frontmatter: Prisma.InputJsonValue;
  isPublished: boolean;
  isTrashed: boolean;
  trashedAt: Date | null;
  createdById: string;
  lastEditedById: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Content Templates ──────────────────────────────────────────────────────

const MARKDOWN_TEMPLATES = [
  (title: string) => `# ${title}\n\nA brief note about ${faker.lorem.words(3)}.\n`,
  (title: string) =>
    `# ${title}\n\n## Overview\n${faker.lorem.paragraph()}\n\n## Details\n${faker.lorem.paragraph()}\n`,
  (title: string) =>
    `# ${title}\n\n- ${faker.lorem.sentence()}\n- ${faker.lorem.sentence()}\n- ${faker.lorem.sentence()}\n`,
];

function generateContent(title: string): string {
  const template = faker.helpers.arrayElement(MARKDOWN_TEMPLATES);
  return template(title);
}

function wordCount(content: string): number {
  return content.split(/\s+/).filter(Boolean).length;
}

// ─── Folder Presets ─────────────────────────────────────────────────────────

const FOLDER_PRESETS: Record<string, string> = {
  inbox: 'Inbox',
  projects: 'Projects',
  archive: 'Archive',
  daily: 'Daily Notes',
  research: 'Research',
  templates: 'Templates',
};

// ─── Builder ────────────────────────────────────────────────────────────────

class NoteBuilder extends FactoryBuilder<NoteFixture> {
  /** Ephemeral content field used for hash / word count calculation */
  private _content: string | null = null;

  withId(id: string): this {
    this.data.id = id;
    return this;
  }

  inWorkspace(workspaceId: string): this {
    this.data.workspaceId = workspaceId;
    return this;
  }

  withPath(path: string): this {
    this.data.path = path;
    return this;
  }

  withTitle(title: string): this {
    this.data.title = title;
    return this;
  }

  /** Set content and auto-compute hash + word count */
  withContent(content: string): this {
    this._content = content;
    this.data.contentHash = sha256(content);
    this.data.wordCount = wordCount(content);
    return this;
  }

  withFrontmatter(frontmatter: Prisma.InputJsonValue): this {
    this.data.frontmatter = frontmatter;
    return this;
  }

  createdBy(userId: string): this {
    this.data.createdById = userId;
    return this;
  }

  lastEditedBy(userId: string): this {
    this.data.lastEditedById = userId;
    return this;
  }

  /** Place note in a named folder (updates path) */
  inFolder(folder: keyof typeof FOLDER_PRESETS | string): this {
    const folderName = FOLDER_PRESETS[folder] ?? folder;
    const filename = this.data.path.split('/').pop() ?? this.data.path;
    this.data.path = `${folderName.toLowerCase().replace(/\s+/g, '-')}/${filename}`;
    return this;
  }

  published(): this {
    this.data.isPublished = true;
    return this;
  }

  unpublished(): this {
    this.data.isPublished = false;
    return this;
  }

  trashed(): this {
    this.data.isTrashed = true;
    this.data.trashedAt = new Date();
    return this;
  }

  notTrashed(): this {
    this.data.isTrashed = false;
    this.data.trashedAt = null;
    return this;
  }

  withCreatedAt(date: Date): this {
    this.data.createdAt = date;
    return this;
  }

  /**
   * Returns the content string if `.withContent()` was called, otherwise
   * generates a default. Useful when you need the actual text for assertions.
   */
  getContent(): string {
    if (this._content !== null) return this._content;
    return generateContent(this.data.title);
  }

  protected clone(): this {
    const seq = nextSequence();
    const slug = faker.helpers.slugify(this.data.title).toLowerCase();
    const cloned = new NoteBuilder({
      ...this.data,
      id: generateId(),
      path: `${slug}-${seq}.md`,
    }) as this;
    (cloned as unknown as { _content: string | null })._content = this._content;
    return cloned;
  }
}

// ─── Factory Function ───────────────────────────────────────────────────────

export function createNote(overrides?: Partial<NoteFixture>): NoteBuilder {
  const seq = nextSequence();
  const title = faker.lorem.words({ min: 2, max: 5 });
  const slug = faker.helpers.slugify(title).toLowerCase();
  const content = generateContent(title);
  const now = new Date();
  const userId = generateId();

  const defaults: NoteFixture = {
    id: generateId(),
    workspaceId: generateId(),
    path: `${slug}-${seq}.md`,
    title,
    contentHash: sha256(content),
    wordCount: wordCount(content),
    frontmatter: {},
    isPublished: false,
    isTrashed: false,
    trashedAt: null,
    createdById: userId,
    lastEditedById: userId,
    createdAt: now,
    updatedAt: now,
  };

  const builder = new NoteBuilder(defaults);
  if (overrides) {
    builder.with(overrides);
  }
  return builder;
}
