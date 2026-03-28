/**
 * Tests for the test factory system.
 *
 * Validates that factories produce well-formed fixtures with correct types,
 * builder chaining works as expected, and .many() generates unique instances.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createUser,
  createWorkspace,
  createWorkspaceMember,
  createNote,
  createNoteLink,
  createTag,
  createSeedTags,
  createComment,
  resetSequence,
  sha256,
  fakePasswordHash,
} from './index';

beforeEach(() => {
  resetSequence();
});

// ─── User Factory ───────────────────────────────────────────────────────────

describe('createUser', () => {
  it('should build a user with all required fields', () => {
    const user = createUser().build();

    expect(user.id).toBeDefined();
    expect(user.email).toContain('@');
    expect(user.passwordHash).toBeDefined();
    expect(user.displayName).toBeDefined();
    expect(user.isActive).toBe(true);
    expect(user.isEmailVerified).toBe(true);
    expect(user.isSuperAdmin).toBe(false);
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.updatedAt).toBeInstanceOf(Date);
  });

  it('should support admin() convenience method', () => {
    const admin = createUser().admin().build();
    expect(admin.isSuperAdmin).toBe(true);
    expect(admin.isEmailVerified).toBe(true);
  });

  it('should support ssoOnly() (null passwordHash)', () => {
    const ssoUser = createUser().ssoOnly().build();
    expect(ssoUser.passwordHash).toBeNull();
  });

  it('should support inactive() flag', () => {
    const user = createUser().inactive().build();
    expect(user.isActive).toBe(false);
  });

  it('should support chaining multiple setters', () => {
    const user = createUser()
      .withEmail('test@example.com')
      .withDisplayName('Test User')
      .admin()
      .build();

    expect(user.email).toBe('test@example.com');
    expect(user.displayName).toBe('Test User');
    expect(user.isSuperAdmin).toBe(true);
  });

  it('should generate unique IDs for each build()', () => {
    const user1 = createUser().build();
    const user2 = createUser().build();
    expect(user1.id).not.toBe(user2.id);
  });

  it('should generate unique emails for each factory call', () => {
    const user1 = createUser().build();
    const user2 = createUser().build();
    expect(user1.email).not.toBe(user2.email);
  });

  it('should support many() for batch creation', () => {
    const users = createUser().many(5);
    expect(users).toHaveLength(5);

    const ids = new Set(users.map((u) => u.id));
    expect(ids.size).toBe(5); // all unique
  });

  it('should support many() with customiser', () => {
    const users = createUser().many(3, (b, i) => b.withEmail(`user${i}@test.com`));

    expect(users[0].email).toBe('user0@test.com');
    expect(users[1].email).toBe('user1@test.com');
    expect(users[2].email).toBe('user2@test.com');
  });

  it('should accept overrides in constructor', () => {
    const user = createUser({ email: 'override@test.com' }).build();
    expect(user.email).toBe('override@test.com');
  });

  it('should return frozen objects from build()', () => {
    const user = createUser().build();
    expect(() => {
      (user as Record<string, unknown>).email = 'mutated@test.com';
    }).toThrow();
  });
});

// ─── Workspace Factory ──────────────────────────────────────────────────────

describe('createWorkspace', () => {
  it('should build a workspace with all required fields', () => {
    const ws = createWorkspace().build();

    expect(ws.id).toBeDefined();
    expect(ws.name).toBeDefined();
    expect(ws.slug).toBeDefined();
    expect(ws.storagePath).toContain(ws.slug);
    expect(ws.isPublic).toBe(false);
    expect(ws.publicSlug).toBeNull();
    expect(ws.settings).toBeDefined();
  });

  it('should support public() convenience', () => {
    const ws = createWorkspace().public().build();
    expect(ws.isPublic).toBe(true);
    expect(ws.publicSlug).toBe(ws.slug);
  });

  it('should support many()', () => {
    const workspaces = createWorkspace().many(3);
    expect(workspaces).toHaveLength(3);

    const slugs = new Set(workspaces.map((w) => w.slug));
    expect(slugs.size).toBe(3);
  });

  it('should support custom settings', () => {
    const ws = createWorkspace().withSettings({ theme: 'dark', language: 'en' }).build();

    expect(ws.settings).toEqual({ theme: 'dark', language: 'en' });
  });
});

// ─── WorkspaceMember Factory ────────────────────────────────────────────────

describe('createWorkspaceMember', () => {
  it('should default to EDITOR role', () => {
    const member = createWorkspaceMember().build();
    expect(member.role).toBe('EDITOR');
  });

  it('should support role shortcuts', () => {
    expect(createWorkspaceMember().owner().build().role).toBe('OWNER');
    expect(createWorkspaceMember().admin().build().role).toBe('ADMIN');
    expect(createWorkspaceMember().editor().build().role).toBe('EDITOR');
    expect(createWorkspaceMember().viewer().build().role).toBe('VIEWER');
  });

  it('should accept workspace and user IDs', () => {
    const member = createWorkspaceMember()
      .inWorkspace('ws-123')
      .forUser('user-456')
      .owner()
      .build();

    expect(member.workspaceId).toBe('ws-123');
    expect(member.userId).toBe('user-456');
    expect(member.role).toBe('OWNER');
  });
});

// ─── Note Factory ───────────────────────────────────────────────────────────

describe('createNote', () => {
  it('should build a note with all required fields', () => {
    const note = createNote().build();

    expect(note.id).toBeDefined();
    expect(note.workspaceId).toBeDefined();
    expect(note.path).toMatch(/\.md$/);
    expect(note.title).toBeDefined();
    expect(note.contentHash).toMatch(/^[0-9a-f]{64}$/); // SHA-256
    expect(note.wordCount).toBeGreaterThan(0);
    expect(note.isPublished).toBe(false);
    expect(note.isTrashed).toBe(false);
    expect(note.trashedAt).toBeNull();
    expect(note.createdById).toBeDefined();
    expect(note.lastEditedById).toBe(note.createdById);
  });

  it('should support withContent() and auto-compute hash', () => {
    const content = '# Test\n\nHello world';
    const note = createNote().withContent(content).build();

    expect(note.contentHash).toBe(sha256(content));
    expect(note.wordCount).toBe(4); // "#", "Test", "Hello", "world"
  });

  it('should support trashed()', () => {
    const note = createNote().trashed().build();
    expect(note.isTrashed).toBe(true);
    expect(note.trashedAt).toBeInstanceOf(Date);
  });

  it('should support published()', () => {
    const note = createNote().published().build();
    expect(note.isPublished).toBe(true);
  });

  it('should support inFolder()', () => {
    const note = createNote().inFolder('inbox').build();
    expect(note.path).toMatch(/^inbox\//);
  });

  it('should support inWorkspace() and createdBy() chaining', () => {
    const note = createNote()
      .inWorkspace('ws-123')
      .createdBy('user-456')
      .lastEditedBy('user-789')
      .build();

    expect(note.workspaceId).toBe('ws-123');
    expect(note.createdById).toBe('user-456');
    expect(note.lastEditedById).toBe('user-789');
  });

  it('should generate unique paths for each factory call', () => {
    const note1 = createNote().build();
    const note2 = createNote().build();
    expect(note1.path).not.toBe(note2.path);
  });

  it('should support many() with unique data', () => {
    const notes = createNote().many(5);
    expect(notes).toHaveLength(5);

    const paths = new Set(notes.map((n) => n.path));
    expect(paths.size).toBe(5);
  });
});

// ─── NoteLink Factory ───────────────────────────────────────────────────────

describe('createNoteLink', () => {
  it('should build a link defaulting to WIKI type', () => {
    const link = createNoteLink().build();

    expect(link.id).toBeDefined();
    expect(link.sourceNoteId).toBeDefined();
    expect(link.targetNoteId).toBeDefined();
    expect(link.linkType).toBe('WIKI');
    expect(link.blockId).toBeNull();
    expect(link.context).toBeDefined();
  });

  it('should support from/to chaining', () => {
    const link = createNoteLink()
      .from('note-a')
      .to('note-b')
      .wiki()
      .withContext('See [[Other Note]]')
      .build();

    expect(link.sourceNoteId).toBe('note-a');
    expect(link.targetNoteId).toBe('note-b');
    expect(link.linkType).toBe('WIKI');
    expect(link.context).toBe('See [[Other Note]]');
  });

  it('should support blockRef()', () => {
    const link = createNoteLink().blockRef('abc123').build();
    expect(link.linkType).toBe('BLOCK_REF');
    expect(link.blockId).toBe('abc123');
  });

  it('should support embed()', () => {
    const link = createNoteLink().embed().build();
    expect(link.linkType).toBe('EMBED');
  });
});

// ─── Tag Factory ────────────────────────────────────────────────────────────

describe('createTag', () => {
  it('should build a tag with all required fields', () => {
    const tag = createTag().build();

    expect(tag.id).toBeDefined();
    expect(tag.workspaceId).toBeDefined();
    expect(tag.name).toBeDefined();
    expect(tag.noteCount).toBe(0);
  });

  it('should support preset()', () => {
    const tag = createTag().preset('project').build();
    expect(tag.name).toBe('project');
    expect(tag.color).toBe('#3b82f6');
  });

  it('should support inWorkspace()', () => {
    const tag = createTag().inWorkspace('ws-123').build();
    expect(tag.workspaceId).toBe('ws-123');
  });

  it('should support withNoteCount()', () => {
    const tag = createTag().withNoteCount(42).build();
    expect(tag.noteCount).toBe(42);
  });
});

describe('createSeedTags', () => {
  it('should create project, idea, todo, reference tags for a workspace', () => {
    const tags = createSeedTags('ws-123');

    expect(tags.project.name).toBe('project');
    expect(tags.idea.name).toBe('idea');
    expect(tags.todo.name).toBe('todo');
    expect(tags.reference.name).toBe('reference');

    // All should share the same workspace ID
    for (const tag of Object.values(tags)) {
      expect(tag.workspaceId).toBe('ws-123');
    }
  });
});

// ─── Comment Factory ────────────────────────────────────────────────────────

describe('createComment', () => {
  it('should build a comment with all required fields', () => {
    const comment = createComment().build();

    expect(comment.id).toBeDefined();
    expect(comment.noteId).toBeDefined();
    expect(comment.userId).toBeDefined();
    expect(comment.content).toBeDefined();
    expect(comment.isResolved).toBe(false);
    expect(comment.parentId).toBeNull();
  });

  it('should support resolved()', () => {
    const comment = createComment().resolved().build();
    expect(comment.isResolved).toBe(true);
  });

  it('should support replyTo()', () => {
    const parent = createComment().build();
    const reply = createComment().replyTo(parent.id).build();

    expect(reply.parentId).toBe(parent.id);
  });

  it('should support onNote() and byUser()', () => {
    const comment = createComment().onNote('note-123').byUser('user-456').build();

    expect(comment.noteId).toBe('note-123');
    expect(comment.userId).toBe('user-456');
  });

  it('should support withPosition()', () => {
    const comment = createComment().withPosition({ line: 10, col: 5 }).build();

    expect(comment.position).toEqual({ line: 10, col: 5 });
  });

  it('should support many()', () => {
    const comments = createComment().many(3);
    expect(comments).toHaveLength(3);
  });
});

// ─── Utility Functions ──────────────────────────────────────────────────────

describe('utility functions', () => {
  it('sha256 should produce consistent 64-char hex hashes', () => {
    const hash = sha256('hello');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(sha256('hello')).toBe(hash); // deterministic
    expect(sha256('world')).not.toBe(hash); // different input
  });

  it('fakePasswordHash should produce salt:hash format', () => {
    const hash = fakePasswordHash('Test123!');
    expect(hash).toContain(':');
    const [salt, derived] = hash.split(':');
    expect(salt).toMatch(/^[0-9a-f]{16}$/); // 8 bytes hex
    expect(derived).toMatch(/^[0-9a-f]{64}$/); // SHA-256 hex
  });
});

// ─── Integration: building a complete scenario ──────────────────────────────

describe('integration: complete scenario', () => {
  it('should build a full workspace with owner, notes, tags, and comments', () => {
    const owner = createUser().admin().verified().build();
    const editor = createUser().verified().build();

    const workspace = createWorkspace().withName('Test Vault').withSlug('test-vault').build();

    const ownerMember = createWorkspaceMember()
      .inWorkspace(workspace.id)
      .forUser(owner.id)
      .owner()
      .build();

    const editorMember = createWorkspaceMember()
      .inWorkspace(workspace.id)
      .forUser(editor.id)
      .editor()
      .build();

    const tags = createSeedTags(workspace.id);

    const note1 = createNote()
      .inWorkspace(workspace.id)
      .createdBy(owner.id)
      .withTitle('Project Plan')
      .inFolder('projects')
      .withContent('# Project Plan\n\nSome content here.')
      .build();

    const note2 = createNote()
      .inWorkspace(workspace.id)
      .createdBy(editor.id)
      .withTitle('Quick Thought')
      .inFolder('inbox')
      .build();

    const link = createNoteLink()
      .from(note1.id)
      .to(note2.id)
      .wiki()
      .withContext('See [[Quick Thought]]')
      .build();

    const comment = createComment()
      .onNote(note1.id)
      .byUser(editor.id)
      .withContent('Looks good!')
      .build();

    // Assertions
    expect(ownerMember.role).toBe('OWNER');
    expect(editorMember.role).toBe('EDITOR');
    expect(note1.workspaceId).toBe(workspace.id);
    expect(note1.createdById).toBe(owner.id);
    expect(note1.path).toMatch(/^projects\//);
    expect(note2.path).toMatch(/^inbox\//);
    expect(link.sourceNoteId).toBe(note1.id);
    expect(link.targetNoteId).toBe(note2.id);
    expect(comment.noteId).toBe(note1.id);
    expect(comment.userId).toBe(editor.id);
    expect(tags.project.workspaceId).toBe(workspace.id);
  });
});
