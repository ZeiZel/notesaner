// ─── Fixture Barrel Export ────────────────────────────────────────────────────
//
// All fixture data for seeding the development and staging databases.
// Import from this module when you need seed IDs in tests or scripts.

export { USER_IDS, type SeedUserId, buildUsers, getUserUpserts } from './users';

export {
  WORKSPACE_IDS,
  type SeedWorkspaceId,
  MEMBER_IDS,
  buildWorkspaces,
  buildWorkspaceMembers,
  getWorkspaceUpserts,
  getWorkspaceMemberUpserts,
} from './workspaces';

export {
  NOTE_IDS,
  TAG_IDS,
  LINK_IDS,
  buildNotes,
  buildTags,
  buildNoteTags,
  buildNoteLinks,
  getNoteUpserts,
  getTagUpserts,
  getNoteTagData,
  getNoteLinkUpserts,
} from './notes';
