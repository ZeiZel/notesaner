/**
 * NoteLink factory for generating test fixtures.
 *
 * Usage:
 *   createNoteLink().build()                                  // random link
 *   createNoteLink().from('src-id').to('tgt-id').build()       // specific link
 *   createNoteLink().wiki().build()                            // [[wiki]] link
 *   createNoteLink().embed().build()                           // ![[embed]]
 *   createNoteLink().blockRef('abc123').build()                // [[note#^abc123]]
 *   createNoteLink().many(5)                                   // array of 5
 */

import { faker } from '@faker-js/faker';
import { LinkType } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { FactoryBuilder, generateId, nextSequence } from './base';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface NoteLinkFixture {
  id: string;
  sourceNoteId: string;
  targetNoteId: string;
  linkType: LinkType;
  blockId: string | null;
  context: string | null;
  position: Prisma.InputJsonValue | null;
}

// ─── Builder ────────────────────────────────────────────────────────────────

class NoteLinkBuilder extends FactoryBuilder<NoteLinkFixture> {
  withId(id: string): this {
    this.data.id = id;
    return this;
  }

  from(sourceNoteId: string): this {
    this.data.sourceNoteId = sourceNoteId;
    return this;
  }

  to(targetNoteId: string): this {
    this.data.targetNoteId = targetNoteId;
    return this;
  }

  /** [[wiki link]] type */
  wiki(): this {
    this.data.linkType = LinkType.WIKI;
    return this;
  }

  /** [markdown](link) type */
  markdown(): this {
    this.data.linkType = LinkType.MARKDOWN;
    return this;
  }

  /** ![[embed]] type */
  embed(): this {
    this.data.linkType = LinkType.EMBED;
    return this;
  }

  /** [[note#^blockId]] type */
  blockRef(blockId: string): this {
    this.data.linkType = LinkType.BLOCK_REF;
    this.data.blockId = blockId;
    return this;
  }

  withContext(context: string): this {
    this.data.context = context;
    return this;
  }

  withPosition(line: number, col: number): this {
    this.data.position = { line, col } as unknown as Prisma.InputJsonValue;
    return this;
  }

  protected clone(): this {
    return new NoteLinkBuilder({
      ...this.data,
      id: generateId(),
    }) as this;
  }
}

// ─── Factory Function ───────────────────────────────────────────────────────

export function createNoteLink(overrides?: Partial<NoteLinkFixture>): NoteLinkBuilder {
  nextSequence();

  const defaults: NoteLinkFixture = {
    id: generateId(),
    sourceNoteId: generateId(),
    targetNoteId: generateId(),
    linkType: LinkType.WIKI,
    blockId: null,
    context: `See also: [[${faker.lorem.words(2)}]]`,
    position: null,
  };

  const builder = new NoteLinkBuilder(defaults);
  if (overrides) {
    builder.with(overrides);
  }
  return builder;
}
