/**
 * Test Factory Barrel Export
 *
 * Provides builder-pattern factories for all Prisma models. Each factory
 * generates realistic data via @faker-js/faker and supports method chaining.
 *
 * Usage:
 *   import { createUser, createNote, createWorkspace, resetSequence } from '../factories';
 *
 *   beforeEach(() => resetSequence());
 *
 *   it('should do something', () => {
 *     const user = createUser().admin().verified().build();
 *     const workspace = createWorkspace().public().build();
 *     const note = createNote()
 *       .inWorkspace(workspace.id)
 *       .createdBy(user.id)
 *       .withTitle('Test Note')
 *       .build();
 *   });
 */

// ── Base utilities ──────────────────────────────────────────────────────────
export { generateId, nextSequence, resetSequence, sha256, fakePasswordHash } from './base';

// ── Model factories ─────────────────────────────────────────────────────────
export { createUser, type UserFixture } from './user.factory';
export { createWorkspace, type WorkspaceFixture } from './workspace.factory';
export { createWorkspaceMember, type WorkspaceMemberFixture } from './workspace-member.factory';
export { createNote, type NoteFixture } from './note.factory';
export { createNoteLink, type NoteLinkFixture } from './note-link.factory';
export { createTag, createSeedTags, type TagFixture, type PresetTagName } from './tag.factory';
export { createComment, type CommentFixture } from './comment.factory';
