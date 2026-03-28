/**
 * Database Seed Script
 *
 * Populates the database with deterministic fixture data for development
 * and staging environments. All operations use upserts so the script is
 * **idempotent** — safe to run multiple times without duplicating data.
 *
 * Usage:
 *   npx prisma db seed                  # default: development
 *   NODE_ENV=staging npx prisma db seed # staging mode (random passwords)
 *
 * Environment awareness:
 *   - development: uses fixed password "Notesaner123!" for all users
 *   - staging:     generates random passwords and prints them to stdout
 *   - production:  seed script refuses to run (safety guard)
 */

import { PrismaClient } from '@prisma/client';
import { getUserUpserts } from './fixtures/users';
import { getWorkspaceUpserts, getWorkspaceMemberUpserts } from './fixtures/workspaces';
import {
  getNoteUpserts,
  getTagUpserts,
  getNoteTagData,
  getNoteLinkUpserts,
} from './fixtures/notes';

// ─── Environment Detection ───────────────────────────────────────────────────

type SeedEnv = 'development' | 'staging';

function detectEnvironment(): SeedEnv {
  const env = process.env['NODE_ENV'] ?? 'development';

  if (env === 'production') {
    console.error(
      '\n  ERROR: Refusing to seed a production database.\n' +
        '  Set NODE_ENV to "development" or "staging" to run seeds.\n',
    );
    process.exit(1);
  }

  // When SEED_DATA env var is set, it must be "true" to proceed.
  // This allows CI scripts to conditionally opt-in to seeding.
  const seedDataFlag = process.env['SEED_DATA'];
  if (seedDataFlag !== undefined && seedDataFlag !== 'true') {
    console.log('\n  SEED_DATA is set but not "true" — skipping seed.\n');
    process.exit(0);
  }

  if (env === 'staging') return 'staging';
  return 'development';
}

// ─── Seed Runner ─────────────────────────────────────────────────────────────

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const env = detectEnvironment();
  const startMs = Date.now();

  console.log(`\n  Seeding database (env: ${env})\n`);

  // ── 1. Users ─────────────────────────────────────────────────────────────
  console.log('  [1/6] Users...');
  const userUpserts = await getUserUpserts(env);
  for (const args of userUpserts) {
    await prisma.user.upsert(args);
  }
  console.log(`         ${userUpserts.length} users upserted`);

  // ── 2. Workspaces ────────────────────────────────────────────────────────
  console.log('  [2/6] Workspaces...');
  const wsUpserts = getWorkspaceUpserts();
  for (const args of wsUpserts) {
    await prisma.workspace.upsert(args);
  }
  console.log(`         ${wsUpserts.length} workspaces upserted`);

  // ── 3. Workspace Members ─────────────────────────────────────────────────
  console.log('  [3/6] Workspace members...');
  const memberUpserts = getWorkspaceMemberUpserts();
  for (const args of memberUpserts) {
    await prisma.workspaceMember.upsert(args);
  }
  console.log(`         ${memberUpserts.length} members upserted`);

  // ── 4. Tags ──────────────────────────────────────────────────────────────
  console.log('  [4/6] Tags...');
  const tagUpserts = getTagUpserts();
  for (const args of tagUpserts) {
    await prisma.tag.upsert(args);
  }
  console.log(`         ${tagUpserts.length} tags upserted`);

  // ── 5. Notes ─────────────────────────────────────────────────────────────
  console.log('  [5/6] Notes...');
  const noteUpserts = getNoteUpserts();
  for (const args of noteUpserts) {
    await prisma.note.upsert(args);
  }
  console.log(`         ${noteUpserts.length} notes upserted`);

  // ── 5b. Note-Tag associations ────────────────────────────────────────────
  // Composite PK tables do not support upsert, so we delete+create.
  const noteTagData = getNoteTagData();
  const noteIds = [...new Set(noteTagData.map((nt) => nt.noteId))];
  await prisma.noteTag.deleteMany({
    where: { noteId: { in: noteIds } },
  });
  await prisma.noteTag.createMany({
    data: noteTagData,
    skipDuplicates: true,
  });
  console.log(`         ${noteTagData.length} note-tag associations set`);

  // ── 5c. Update denormalised tag counts ───────────────────────────────────
  for (const tag of tagUpserts) {
    const count = noteTagData.filter((nt) => nt.tagId === tag.create.id).length;
    await prisma.tag.update({
      where: { id: tag.create.id },
      data: { noteCount: count },
    });
  }

  // ── 6. Note Links ───────────────────────────────────────────────────────
  console.log('  [6/6] Note links...');
  const linkUpserts = getNoteLinkUpserts();
  for (const args of linkUpserts) {
    // NoteLink composite unique may have null blockId, which Prisma cannot
    // upsert against. Use a create-or-update via try/catch.
    try {
      await prisma.noteLink.create({ data: args.create });
    } catch {
      // Link already exists — update context only
      await prisma.noteLink.updateMany({
        where: {
          sourceNoteId: args.create.sourceNoteId,
          targetNoteId: args.create.targetNoteId,
          linkType: args.create.linkType,
        },
        data: { context: args.create.context },
      });
    }
  }
  console.log(`         ${linkUpserts.length} note links upserted`);

  // ── Done ─────────────────────────────────────────────────────────────────
  const durationMs = Date.now() - startMs;
  console.log(`\n  Seed complete in ${durationMs}ms\n`);

  if (env === 'development') {
    console.log('  Dev credentials:');
    console.log('    admin@notesaner.local / Notesaner123!');
    console.log('    alice@notesaner.local / Notesaner123!');
    console.log('    bob@notesaner.local   / Notesaner123!');
    console.log('    guest@notesaner.local / Notesaner123!');
    console.log('');
  }
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
