# Server Build Errors — Full List

All errors from `cd apps/server && npx tsc -p tsconfig.build.json --noEmit`

## Category 1: Zod v4 Compatibility (safeParse return type changes)

The project uses Zod 4.3.6. The `$ZodIssue` type's `path` is `PropertyKey[]` (includes `symbol`) but our `parseOrThrow` helper expects `(string | number)[]`. Also `errors` vs `issues` API changed.

Files affected:

- `src/modules/auth/admin-auth-providers.service.ts` (lines 54, 85, 93, 105, 114, 140) — parseOrThrow calls with Zod schemas
- `src/modules/auth/auth.service.ts` (lines 280, 381, 472, 513) — parseOrThrow calls
- `src/modules/auth/dto/auth-provider.dto.ts` (line 126) — `required_error` not valid in Zod 4, use `error` or `message`
- `src/config/validation.ts` (lines 123-124) — `.error.errors` doesn't exist in Zod 4, use `.error.issues`

## Category 2: Pino Logger Type Mismatch

- `src/common/logger/logger.module.ts` (line 22) — `genReqId` return type. The `GenReqId` type expects `(req: IncomingMessage) => ...` but we use `(req: IncomingMessage & { id?: string }) => string`. The `id` property conflicts with `ReqId` type which can be `number`.

Fix: Cast the function or adjust the signature.

## Category 3: Missing Prisma Schema Fields

- `src/modules/notes/link-types.service.ts` — references `prisma.linkRelationshipType` and `relationshipTypeId` which don't exist in Prisma schema. Also imports `LinkRelationshipType` from `@prisma/client`.
- `src/modules/notes/note-alias.service.ts` (lines 119, 153) — `alias` property doesn't exist in Note update type
- `src/modules/notes/block-references.service.ts` (line 347) — type mismatch on NoteLinkCreateManyInput
- `src/modules/notes/content-hash.service.ts` (line 297) — Expected 3 arguments, got 4

## Category 4: Missing npm Type Declarations

- `src/modules/auth/strategies/oidc.strategy.ts` (line 19) — Cannot find module 'openid-client'
- `src/modules/backup/backup.service.ts` (lines 591, 637) — Cannot find module '@aws-sdk/client-s3'
- `src/modules/files/attachment.controller.ts` (line 29) — No declaration for 'multer'
- `src/modules/files/attachment.controller.ts` (line 88) / `attachment.service.ts` (line 97) — `Express.Multer` namespace missing

## Category 5: Various Type Errors

- `src/modules/api-v1/api-v1-notes.controller.ts` (line 86) — 'folder' not in list query type
- `src/modules/audit/csv-export.ts` (line 16) — missing 'metadata' property
- `src/modules/backup/backup.service.ts` (line 670) — `BackupVerifyJobResult` not found (did you mean `BackupJobResult`?)
- `src/modules/email/email.controller.ts` (line 145) — missing return statement
- `src/modules/notes/export.service.ts` (lines 855, 861, 865) — `Dirent<string>[]` vs `Dirent<NonSharedBuffer>[]`
- `src/modules/notes/import.controller.ts` (lines 152, 200, 250) — SchemaObject type mismatch
- `src/modules/notes/import.service.ts` (line 34) — unused import `_UploadedFile`
- `src/modules/publish/public-vault.service.ts` (line 11) / `publish.service.ts` (line 6) — `renderToHtml` not exported from `@notesaner/markdown`
- `src/modules/search/search.controller.ts` (lines 61, 88, 108, 126) — missing methods on SearchService
- `src/modules/sync/conflict-resolution.service.ts` (line 229) — unused `workspaceId`
- `src/modules/sync/presence.gateway.ts` (line 173) — unused `client`

## Test Failures

2 tests fail in `src/modules/auth/__tests__/admin-auth-providers.service.test.ts`:

- `filters by workspaceId` — passes UUID `'00000000-0000-0000-0000-000000000001'` but Zod rejects it as "Invalid UUID"
- `creates with explicit workspaceId` — same issue

Root cause: Zod 4's `.uuid()` validation may have changed, OR the `parseOrThrow` helper is corrupting the validation somehow.
