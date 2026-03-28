/**
 * Comment factory for generating test fixtures.
 *
 * Usage:
 *   createComment().build()                              // random comment
 *   createComment().onNote('note-id').build()              // specific note
 *   createComment().byUser('user-id').build()              // specific author
 *   createComment().resolved().build()                     // resolved comment
 *   createComment().replyTo('parent-id').build()           // threaded reply
 *   createComment().withPosition({ line: 5, col: 0 }).build()
 *   createComment().many(3)                                // array of 3
 */

import { faker } from '@faker-js/faker';
import type { Prisma } from '@prisma/client';
import { FactoryBuilder, generateId, nextSequence } from './base';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CommentFixture {
  id: string;
  noteId: string;
  userId: string;
  content: string;
  position: Prisma.InputJsonValue | null;
  isResolved: boolean;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Builder ────────────────────────────────────────────────────────────────

class CommentBuilder extends FactoryBuilder<CommentFixture> {
  withId(id: string): this {
    this.data.id = id;
    return this;
  }

  onNote(noteId: string): this {
    this.data.noteId = noteId;
    return this;
  }

  byUser(userId: string): this {
    this.data.userId = userId;
    return this;
  }

  withContent(content: string): this {
    this.data.content = content;
    return this;
  }

  /** Attach a position anchor (line/col in the note) */
  withPosition(position: { line: number; col: number }): this {
    this.data.position = position as unknown as Prisma.InputJsonValue;
    return this;
  }

  /** Mark comment as resolved */
  resolved(): this {
    this.data.isResolved = true;
    return this;
  }

  /** Mark comment as unresolved (default) */
  unresolved(): this {
    this.data.isResolved = false;
    return this;
  }

  /** Make this comment a reply to another comment */
  replyTo(parentId: string): this {
    this.data.parentId = parentId;
    return this;
  }

  /** Make this a top-level comment (default) */
  topLevel(): this {
    this.data.parentId = null;
    return this;
  }

  withCreatedAt(date: Date): this {
    this.data.createdAt = date;
    return this;
  }

  protected clone(): this {
    return new CommentBuilder({
      ...this.data,
      id: generateId(),
    }) as this;
  }
}

// ─── Factory Function ───────────────────────────────────────────────────────

export function createComment(overrides?: Partial<CommentFixture>): CommentBuilder {
  nextSequence();
  const now = new Date();

  const defaults: CommentFixture = {
    id: generateId(),
    noteId: generateId(),
    userId: generateId(),
    content: faker.lorem.sentence({ min: 3, max: 15 }),
    position: null,
    isResolved: false,
    parentId: null,
    createdAt: now,
    updatedAt: now,
  };

  const builder = new CommentBuilder(defaults);
  if (overrides) {
    builder.with(overrides);
  }
  return builder;
}
