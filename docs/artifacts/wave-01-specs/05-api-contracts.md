# Notesaner — Complete API Contract Specification

**Version**: 1.0.0
**Status**: Authoritative — Single Source of Truth
**Audience**: Frontend developers, backend developers, plugin developers
**Last Updated**: 2026-03-25

---

## Table of Contents

1. [Global Conventions](#1-global-conventions)
2. [Pagination Contract](#2-pagination-contract)
3. [REST API Catalog](#3-rest-api-catalog)
   - [Auth](#31-auth)
   - [Users](#32-users)
   - [Workspaces](#33-workspaces)
   - [Notes](#34-notes)
   - [Tags](#35-tags)
   - [Search](#36-search)
   - [Graph](#37-graph)
   - [Files & Attachments](#38-files--attachments)
   - [Plugins](#39-plugins)
   - [Publishing](#310-publishing)
   - [Layouts](#311-layouts)
   - [Comments](#312-comments)
   - [Admin](#313-admin)
   - [Health](#314-health)
4. [WebSocket Events](#4-websocket-events)
5. [Error Code Catalog](#5-error-code-catalog)
6. [Zod Validation Schemas](#6-zod-validation-schemas)
7. [Plugin API Contract (SDK)](#7-plugin-api-contract-sdk)
8. [Sync Protocol Specification](#8-sync-protocol-specification)

---

## 1. Global Conventions

### Base URL

```
Production:  https://api.notesaner.example.com
Staging:     https://api.staging.notesaner.example.com
Local:       http://localhost:3001
```

All REST endpoints are prefixed with `/api`.

### Authentication

All authenticated endpoints require a Bearer token in the `Authorization` header:

```
Authorization: Bearer <accessToken>
```

Access tokens are short-lived JWTs (15 minutes). Refresh tokens are stored as `httpOnly` cookies with 7-day TTL. Token refresh is automatic via `POST /api/auth/refresh`.

### Content Types

All request and response bodies use `application/json` unless noted (e.g., file uploads use `multipart/form-data`).

### Request ID

Every response includes `X-Request-Id` for distributed tracing. Include this header in bug reports.

### Date Formats

All timestamps are ISO 8601 strings in UTC: `"2024-01-15T10:30:00.000Z"`.

### ID Format

All resource IDs are UUIDs (v4). Example: `"550e8400-e29b-41d4-a716-446655440000"`.

### Workspace Scoping

Most resources are scoped to a workspace. The workspace ID is embedded in the URL path as `/:workspaceId/`. Accessing a workspace resource with a workspace ID the authenticated user does not belong to returns `403 FORBIDDEN`.

---

## 2. Pagination Contract

### PaginatedResponse

```typescript
interface PaginatedResponse<T> {
  data: T[];
  total: number;       // total matching records (for page count calculation)
  page: number;        // current page (1-indexed)
  pageSize: number;    // records per page
  hasMore: boolean;    // true if page * pageSize < total
}
```

### PaginationQuery

```typescript
interface PaginationQuery {
  page?: number;      // default: 1, minimum: 1
  pageSize?: number;  // default: 20, max: 100
  sortBy?: string;    // field name; resource-specific valid values listed per endpoint
  sortOrder?: 'asc' | 'desc';  // default: 'desc'
}
```

### Pagination Example

```
GET /api/workspaces/ws-id/notes?page=2&pageSize=20&sortBy=updatedAt&sortOrder=desc

Response:
{
  "data": [...],
  "total": 150,
  "page": 2,
  "pageSize": 20,
  "hasMore": true
}
```

---

## 3. REST API Catalog

### 3.1 Auth

#### POST /api/auth/register

Register a new user account (local auth only).

```
Request:
  Body: {
    email: string          // required, valid email
    password: string       // required, min 8 chars
    displayName: string    // required, max 100 chars
  }

Response 201:
  {
    accessToken: string
    refreshToken: string
    expiresIn: number        // seconds until accessToken expires (900)
    user: UserDto
  }

Auth: public
Rate Limit: 3/minute per IP
Errors:
  400 VALIDATION_ERROR         — invalid email, weak password, missing fields
  409 EMAIL_ALREADY_EXISTS     — email is already registered
  403 REGISTRATION_DISABLED    — server has disabled local registration
```

#### POST /api/auth/login

Authenticate with email and password.

```
Request:
  Body: {
    email: string
    password: string
    totpCode?: string        // required if 2FA is enabled for this account
  }

Response 200:
  {
    accessToken: string
    refreshToken: string
    expiresIn: number        // 900
    user: UserDto
  }
  Set-Cookie: refreshToken=<token>; HttpOnly; Secure; SameSite=Strict; Max-Age=604800

Auth: public
Rate Limit: 5/minute per IP
Errors:
  400 VALIDATION_ERROR
  401 INVALID_CREDENTIALS
  401 TOTP_REQUIRED          — 2FA is enabled; provide totpCode
  401 TOTP_INVALID           — provided totpCode is incorrect
  403 ACCOUNT_DISABLED       — account is deactivated
  429 TOO_MANY_REQUESTS
```

#### POST /api/auth/refresh

Exchange a refresh token for a new access token.

```
Request:
  Cookie: refreshToken=<token>   // httpOnly cookie
  — OR —
  Body: { refreshToken: string } // for clients that cannot use cookies

Response 200:
  {
    accessToken: string
    expiresIn: number
  }

Auth: public (uses refresh token)
Rate Limit: 30/minute per IP
Errors:
  401 TOKEN_EXPIRED
  401 TOKEN_INVALID
  401 SESSION_REVOKED
```

#### POST /api/auth/logout

Revoke the current session.

```
Request:
  Body: {} (empty)

Response 204: (no body)

Auth: required (Bearer)
Errors:
  401 UNAUTHORIZED
```

#### POST /api/auth/logout-all

Revoke all active sessions for the authenticated user.

```
Request:
  Body: {} (empty)

Response 204: (no body)

Auth: required (Bearer)
Errors:
  401 UNAUTHORIZED
```

#### GET /api/auth/me

Get the currently authenticated user.

```
Response 200:
  {
    data: UserDto
  }

Auth: required (Bearer)
Errors:
  401 UNAUTHORIZED
```

#### GET /api/auth/sessions

List all active sessions for the authenticated user.

```
Response 200:
  {
    data: SessionDto[]
  }

Auth: required (Bearer)
```

#### DELETE /api/auth/sessions/:sessionId

Revoke a specific session.

```
Response 204: (no body)

Auth: required (Bearer)
Errors:
  404 SESSION_NOT_FOUND
  403 FORBIDDEN            — session belongs to another user
```

#### GET /api/auth/providers

List all enabled authentication providers.

```
Response 200:
  {
    data: AuthProviderDto[]
  }

Auth: public
```

#### POST /api/auth/2fa/setup

Begin 2FA setup — returns TOTP secret and QR code URI.

```
Response 200:
  {
    secret: string           // base32 TOTP secret
    otpAuthUri: string       // otpauth:// URI for QR code apps
    backupCodes: string[]    // 8 single-use backup codes
  }

Auth: required (Bearer)
Errors:
  409 TWO_FA_ALREADY_ENABLED
```

#### POST /api/auth/2fa/confirm

Confirm 2FA setup with a TOTP code from the authenticator app.

```
Request:
  Body: {
    totpCode: string    // 6-digit code
  }

Response 200:
  {
    enabled: true
  }

Auth: required (Bearer)
Errors:
  400 VALIDATION_ERROR
  401 TOTP_INVALID
```

#### DELETE /api/auth/2fa

Disable 2FA for the authenticated user.

```
Request:
  Body: {
    password: string    // confirm with password
  }

Response 204: (no body)

Auth: required (Bearer)
Errors:
  401 INVALID_CREDENTIALS
  404 TWO_FA_NOT_ENABLED
```

#### POST /api/auth/2fa/backup

Use a backup code to authenticate (when TOTP device is lost).

```
Request:
  Body: {
    backupCode: string
  }

Response 200:
  {
    accessToken: string
    expiresIn: number
  }

Auth: public
Rate Limit: 5/minute per IP
Errors:
  401 BACKUP_CODE_INVALID
  401 BACKUP_CODE_USED
```

#### GET /api/auth/saml/:providerId/metadata

Get SAML SP metadata XML for this provider.

```
Response 200:
  Content-Type: application/xml
  <EntityDescriptor ...>...</EntityDescriptor>

Auth: public
```

#### POST /api/auth/saml/:providerId/callback

SAML assertion callback (IdP-initiated or SP-initiated).

```
Request:
  Content-Type: application/x-www-form-urlencoded
  Body: SAMLResponse=<base64>&RelayState=<state>

Response 302:
  Location: /app?token=<accessToken>    // redirect to app with token in query

Auth: public
Errors:
  401 SAML_ASSERTION_INVALID
  403 SAML_USER_NOT_PROVISIONED
  500 SAML_PROVIDER_ERROR
```

#### GET /api/auth/oidc/:providerId/authorize

Begin OIDC authorization code flow. Redirects to the IdP.

```
Response 302:
  Location: <idp-authorization-url>

Auth: public
```

#### GET /api/auth/oidc/:providerId/callback

OIDC authorization code callback.

```
Query Params:
  code: string
  state: string

Response 302:
  Location: /app?token=<accessToken>

Auth: public
Errors:
  401 OIDC_CODE_INVALID
  403 OIDC_USER_NOT_PROVISIONED
  500 OIDC_PROVIDER_ERROR
```

#### POST /api/auth/forgot-password

Request a password reset email.

```
Request:
  Body: {
    email: string
  }

Response 200:
  { message: "If that email exists, a reset link was sent." }

Auth: public
Rate Limit: 3/minute per IP
Note: Always returns 200 to prevent email enumeration.
```

#### POST /api/auth/reset-password

Reset password using the token from the reset email.

```
Request:
  Body: {
    token: string       // from email link
    password: string    // new password, min 8 chars
  }

Response 200:
  { message: "Password reset successfully." }

Auth: public
Errors:
  400 VALIDATION_ERROR
  401 TOKEN_INVALID
  401 TOKEN_EXPIRED
```

---

### 3.2 Users

#### GET /api/users/me

Alias for GET /api/auth/me. Returns the current user profile.

```
Response 200:
  { data: UserDto }

Auth: required (Bearer)
```

#### PATCH /api/users/me

Update the authenticated user's profile.

```
Request:
  Body: {
    displayName?: string    // max 100 chars
    avatarUrl?: string      // valid URL
  }

Response 200:
  { data: UserDto }

Auth: required (Bearer)
Errors:
  400 VALIDATION_ERROR
```

#### POST /api/users/me/avatar

Upload a new avatar image.

```
Request:
  Content-Type: multipart/form-data
  Body: FormData { avatar: File }  // JPEG, PNG, or WebP, max 5MB

Response 200:
  {
    data: {
      avatarUrl: string     // CDN URL of the uploaded avatar
    }
  }

Auth: required (Bearer)
Errors:
  400 INVALID_FILE_TYPE
  413 FILE_TOO_LARGE
```

#### DELETE /api/users/me/avatar

Remove the user's avatar, resetting to the default.

```
Response 204: (no body)

Auth: required (Bearer)
```

#### GET /api/users/me/settings

Get the authenticated user's application settings.

```
Response 200:
  {
    data: {
      theme: 'light' | 'dark' | 'system'
      editorFont: string
      editorFontSize: number
      lineHeight: number
      vimMode: boolean
      spellCheck: boolean
      locale: string
      keyboardShortcuts: Record<string, string>
      notificationPreferences: {
        comments: boolean
        mentions: boolean
        workspaceInvites: boolean
      }
    }
  }

Auth: required (Bearer)
```

#### PATCH /api/users/me/settings

Update the authenticated user's application settings (partial update).

```
Request:
  Body: Partial<UserSettings>

Response 200:
  { data: UserSettings }

Auth: required (Bearer)
Errors:
  400 VALIDATION_ERROR
```

#### GET /api/users/:userId

Get a user's public profile by ID. Accessible to workspace members only.

```
Response 200:
  {
    data: {
      id: string
      displayName: string
      avatarUrl: string | null
    }
  }

Auth: required (Bearer)
Errors:
  404 USER_NOT_FOUND
  403 FORBIDDEN
```

#### GET /api/users

List users. Super-admin only.

```
Query Params (PaginationQuery):
  page, pageSize, sortBy ('createdAt' | 'email' | 'displayName'), sortOrder
  search?: string    // search by email or displayName
  isActive?: boolean

Response 200: PaginatedResponse<UserDto>

Auth: required (Bearer, superAdmin)
Errors:
  403 FORBIDDEN
```

#### POST /api/users/invite

Invite a user to the platform via email (super-admin or workspace admin).

```
Request:
  Body: {
    email: string
    workspaceId?: string    // optionally invite directly into a workspace
    role?: WorkspaceRole    // role in the workspace
  }

Response 201:
  {
    data: {
      inviteId: string
      email: string
      expiresAt: string
    }
  }

Auth: required (Bearer, admin or superAdmin)
Errors:
  400 VALIDATION_ERROR
  409 EMAIL_ALREADY_EXISTS
  409 USER_ALREADY_MEMBER
```

---

### 3.3 Workspaces

#### GET /api/workspaces

List all workspaces the authenticated user is a member of.

```
Response 200:
  {
    data: Array<WorkspaceDto & { role: WorkspaceRole }>
  }

Auth: required (Bearer)
```

#### POST /api/workspaces

Create a new workspace.

```
Request:
  Body: {
    name: string          // required, max 100 chars
    slug: string          // required, 3-50 chars, URL-safe [a-z0-9-]
    description?: string  // max 500 chars
  }

Response 201:
  {
    data: WorkspaceDto
  }
  Headers:
    Location: /api/workspaces/<id>

Auth: required (Bearer)
Errors:
  400 VALIDATION_ERROR
  409 SLUG_ALREADY_EXISTS
```

#### GET /api/workspaces/:workspaceId

Get workspace details.

```
Response 200:
  {
    data: WorkspaceDto & {
      memberCount: number
      noteCount: number
      role: WorkspaceRole    // authenticated user's role
    }
  }

Auth: required (Bearer, workspace member)
Errors:
  404 WORKSPACE_NOT_FOUND
  403 FORBIDDEN
```

#### PATCH /api/workspaces/:workspaceId

Update workspace settings. Requires ADMIN or OWNER role.

```
Request:
  Body: {
    name?: string
    description?: string
    settings?: {
      defaultNoteTemplate?: string
      autoSaveInterval?: number    // milliseconds, default 500
      versioningEnabled?: boolean
      versionRetentionDays?: number
    }
  }

Response 200:
  { data: WorkspaceDto }

Auth: required (Bearer, ADMIN or OWNER)
Errors:
  400 VALIDATION_ERROR
  403 FORBIDDEN
  404 WORKSPACE_NOT_FOUND
```

#### DELETE /api/workspaces/:workspaceId

Delete a workspace and all its data. OWNER only.

```
Request:
  Body: {
    confirmSlug: string    // must match workspace slug to confirm
  }

Response 204: (no body)

Auth: required (Bearer, OWNER)
Errors:
  400 CONFIRMATION_MISMATCH
  403 FORBIDDEN
  404 WORKSPACE_NOT_FOUND
```

#### POST /api/workspaces/:workspaceId/transfer

Transfer workspace ownership to another member.

```
Request:
  Body: {
    newOwnerId: string    // must be existing workspace member
  }

Response 200:
  { data: WorkspaceMemberDto }  // updated membership for new owner

Auth: required (Bearer, OWNER)
Errors:
  400 VALIDATION_ERROR
  403 FORBIDDEN
  404 USER_NOT_FOUND
  404 WORKSPACE_NOT_FOUND
  422 USER_NOT_MEMBER
```

#### GET /api/workspaces/:workspaceId/members

List workspace members.

```
Query Params:
  page, pageSize
  role?: WorkspaceRole
  search?: string    // search by displayName or email

Response 200: PaginatedResponse<WorkspaceMemberDto>

Auth: required (Bearer, workspace member)
Errors:
  403 FORBIDDEN
  404 WORKSPACE_NOT_FOUND
```

#### POST /api/workspaces/:workspaceId/members

Add a user to the workspace (by email or userId).

```
Request:
  Body: {
    email?: string     // invite by email (creates invite if not registered)
    userId?: string    // add existing user directly
    role: WorkspaceRole
  }

Response 201:
  { data: WorkspaceMemberDto }

Auth: required (Bearer, ADMIN or OWNER)
Errors:
  400 VALIDATION_ERROR
  403 FORBIDDEN
  404 USER_NOT_FOUND
  409 USER_ALREADY_MEMBER
```

#### PATCH /api/workspaces/:workspaceId/members/:userId

Update a member's role.

```
Request:
  Body: {
    role: WorkspaceRole
  }

Response 200:
  { data: WorkspaceMemberDto }

Auth: required (Bearer, ADMIN or OWNER; cannot change OWNER's role)
Errors:
  400 VALIDATION_ERROR
  403 FORBIDDEN
  404 MEMBER_NOT_FOUND
  422 CANNOT_CHANGE_OWNER_ROLE
```

#### DELETE /api/workspaces/:workspaceId/members/:userId

Remove a member from the workspace.

```
Response 204: (no body)

Auth: required (Bearer, ADMIN or OWNER; OWNER cannot remove themselves)
Errors:
  403 FORBIDDEN
  404 MEMBER_NOT_FOUND
  422 CANNOT_REMOVE_OWNER
```

#### POST /api/workspaces/:workspaceId/leave

Leave a workspace (authenticated user removes themselves).

```
Response 204: (no body)

Auth: required (Bearer, workspace member)
Errors:
  403 FORBIDDEN
  422 OWNER_CANNOT_LEAVE    — transfer ownership first
```

#### GET /api/workspaces/:workspaceId/settings

Get workspace-level settings including auth providers.

```
Response 200:
  {
    data: {
      defaultNoteTemplate: string | null
      autoSaveInterval: number
      versioningEnabled: boolean
      versionRetentionDays: number
      allowedAuthProviders: string[]    // provider IDs
      requireSso: boolean
    }
  }

Auth: required (Bearer, ADMIN or OWNER)
```

#### GET /api/workspaces/:workspaceId/stats

Get workspace storage and usage statistics.

```
Response 200:
  {
    data: {
      noteCount: number
      trashedNoteCount: number
      totalAttachmentSize: number    // bytes
      attachmentCount: number
      memberCount: number
      lastActivityAt: string
    }
  }

Auth: required (Bearer, ADMIN or OWNER)
```

---

### 3.4 Notes

#### GET /api/workspaces/:workspaceId/notes

List notes in a workspace. Excludes trashed notes by default.

```
Query Params (PaginationQuery +:
  sortBy: 'updatedAt' | 'createdAt' | 'title'     // default: updatedAt
  folder?: string        // filter by folder path prefix
  tags?: string[]        // comma-separated tag names
  isPublished?: boolean
  isTrashed?: boolean    // default: false; set true to list trash
  createdAfter?: string  // ISO date
  createdBefore?: string
  createdBy?: string     // userId

Response 200: PaginatedResponse<NoteDto>

Auth: required (Bearer, workspace member)
Errors:
  403 FORBIDDEN
  404 WORKSPACE_NOT_FOUND
```

#### POST /api/workspaces/:workspaceId/notes

Create a new note.

```
Request:
  Body: {
    path: string          // required; relative path e.g. "folder/my-note.md"
    title: string         // required; max 500 chars
    content?: string      // initial markdown content
    tags?: string[]       // tag names (created if they don't exist)
    frontmatter?: Record<string, unknown>
  }

Response 201:
  { data: NoteDto }
  Headers:
    Location: /api/workspaces/<workspaceId>/notes/<noteId>

Auth: required (Bearer, EDITOR or above)
Errors:
  400 VALIDATION_ERROR
  403 FORBIDDEN
  409 NOTE_PATH_CONFLICT    — a note already exists at this path
  413 NOTE_TOO_LARGE
```

#### GET /api/workspaces/:workspaceId/notes/:noteId

Get note metadata (not content; content is loaded via WebSocket sync).

```
Response 200:
  { data: NoteDto }

Auth: required (Bearer, workspace member)
Errors:
  403 FORBIDDEN
  404 NOTE_NOT_FOUND
```

#### PATCH /api/workspaces/:workspaceId/notes/:noteId

Update note metadata fields. Does not update content (content is managed by Yjs sync).

```
Request:
  Body: {
    title?: string
    path?: string           // rename/move the note
    isPublished?: boolean
    frontmatter?: Record<string, unknown>
    tags?: string[]
  }

Response 200:
  { data: NoteDto }

Auth: required (Bearer, EDITOR or above)
Errors:
  400 VALIDATION_ERROR
  403 FORBIDDEN
  404 NOTE_NOT_FOUND
  409 NOTE_PATH_CONFLICT
```

#### DELETE /api/workspaces/:workspaceId/notes/:noteId

Move a note to trash (soft delete). Use ?permanent=true to permanently delete.

```
Query Params:
  permanent?: boolean    // default: false (trash); true = permanent deletion

Response 204: (no body)

Auth: required (Bearer, EDITOR or above for trash; ADMIN for permanent)
Errors:
  403 FORBIDDEN
  404 NOTE_NOT_FOUND
```

#### POST /api/workspaces/:workspaceId/notes/:noteId/restore

Restore a trashed note.

```
Response 200:
  { data: NoteDto }

Auth: required (Bearer, EDITOR or above)
Errors:
  403 FORBIDDEN
  404 NOTE_NOT_FOUND
  422 NOTE_NOT_TRASHED
```

#### GET /api/workspaces/:workspaceId/notes/:noteId/content

Get the raw markdown content of a note. Used for export and direct access; collaborative editing uses WebSocket.

```
Response 200:
  Content-Type: text/markdown
  Body: <markdown content string>

Auth: required (Bearer, workspace member)
Errors:
  403 FORBIDDEN
  404 NOTE_NOT_FOUND
```

#### PUT /api/workspaces/:workspaceId/notes/:noteId/content

Replace note content directly (non-collaborative write; triggers Yjs document reset on active sessions).

```
Request:
  Content-Type: text/plain or application/json
  Body: { content: string } or raw markdown string

Response 200:
  {
    data: {
      contentHash: string
      wordCount: number
      updatedAt: string
    }
  }

Auth: required (Bearer, EDITOR or above)
Errors:
  400 VALIDATION_ERROR
  403 FORBIDDEN
  404 NOTE_NOT_FOUND
  413 NOTE_TOO_LARGE        — content exceeds 10MB limit
  409 CONCURRENT_EDIT       — active collaborative session exists (warn client)
```

#### GET /api/workspaces/:workspaceId/notes/:noteId/versions

List version history for a note.

```
Query Params (PaginationQuery):
  sortBy: 'version' | 'createdAt'    // default: version desc

Response 200: PaginatedResponse<NoteVersionDto>

Auth: required (Bearer, workspace member)
Errors:
  403 FORBIDDEN
  404 NOTE_NOT_FOUND
```

#### GET /api/workspaces/:workspaceId/notes/:noteId/versions/:versionId

Get a specific version snapshot.

```
Response 200:
  { data: NoteVersionDto }    // includes full content

Auth: required (Bearer, workspace member)
Errors:
  403 FORBIDDEN
  404 NOTE_NOT_FOUND
  404 VERSION_NOT_FOUND
```

#### POST /api/workspaces/:workspaceId/notes/:noteId/versions/:versionId/restore

Restore a specific version as the current content.

```
Response 200:
  { data: NoteDto }    // updated note metadata

Auth: required (Bearer, EDITOR or above)
Errors:
  403 FORBIDDEN
  404 NOTE_NOT_FOUND
  404 VERSION_NOT_FOUND
```

#### GET /api/workspaces/:workspaceId/notes/:noteId/links

Get all outgoing links from a note.

```
Response 200:
  {
    data: NoteLinkDto[]
  }

Auth: required (Bearer, workspace member)
Errors:
  403 FORBIDDEN
  404 NOTE_NOT_FOUND
```

#### GET /api/workspaces/:workspaceId/notes/:noteId/backlinks

Get all incoming links to a note (backlinks).

```
Query Params:
  includeUnlinkedMentions?: boolean    // default: false

Response 200:
  {
    data: {
      links: NoteLinkDto[]
      unlinkedMentions?: Array<{
        noteId: string
        title: string
        context: string
      }>
    }
  }

Auth: required (Bearer, workspace member)
Errors:
  403 FORBIDDEN
  404 NOTE_NOT_FOUND
```

#### POST /api/workspaces/:workspaceId/notes/:noteId/move

Move or rename a note.

```
Request:
  Body: {
    newPath: string       // new relative path including filename
    updateLinks?: boolean // default: true — update all wiki links pointing to this note
  }

Response 200:
  {
    data: {
      note: NoteDto
      updatedLinkCount: number
    }
  }

Auth: required (Bearer, EDITOR or above)
Errors:
  400 VALIDATION_ERROR
  403 FORBIDDEN
  404 NOTE_NOT_FOUND
  409 NOTE_PATH_CONFLICT
```

#### POST /api/workspaces/:workspaceId/notes/bulk

Bulk operations on notes.

```
Request:
  Body: {
    operation: 'trash' | 'restore' | 'delete' | 'move' | 'tag' | 'untag'
    noteIds: string[]
    // operation-specific fields:
    targetFolder?: string    // for 'move'
    tagNames?: string[]      // for 'tag' / 'untag'
  }

Response 200:
  {
    data: {
      succeeded: string[]    // noteIds that succeeded
      failed: Array<{ noteId: string; error: string }>
    }
  }

Auth: required (Bearer, EDITOR or above)
Errors:
  400 VALIDATION_ERROR
  403 FORBIDDEN
```

#### GET /api/workspaces/:workspaceId/notes/:noteId/export

Export a note in a specified format.

```
Query Params:
  format: 'markdown' | 'html' | 'pdf' | 'docx'

Response 200:
  Content-Type: (varies by format)
  Content-Disposition: attachment; filename="<note-title>.<ext>"
  Body: <file content>

Auth: required (Bearer, workspace member)
Errors:
  400 INVALID_FORMAT
  403 FORBIDDEN
  404 NOTE_NOT_FOUND
  503 EXPORT_SERVICE_UNAVAILABLE
```

---

### 3.5 Tags

#### GET /api/workspaces/:workspaceId/tags

List all tags in a workspace.

```
Query Params:
  page, pageSize
  sortBy: 'name' | 'noteCount'    // default: noteCount desc
  search?: string

Response 200: PaginatedResponse<TagDto>

Auth: required (Bearer, workspace member)
Errors:
  403 FORBIDDEN
  404 WORKSPACE_NOT_FOUND
```

#### POST /api/workspaces/:workspaceId/tags

Create a new tag.

```
Request:
  Body: {
    name: string      // required, max 100 chars, no leading # allowed
    color?: string    // hex color code e.g. "#FF5733"
  }

Response 201:
  { data: TagDto }

Auth: required (Bearer, EDITOR or above)
Errors:
  400 VALIDATION_ERROR
  403 FORBIDDEN
  409 TAG_ALREADY_EXISTS
```

#### PATCH /api/workspaces/:workspaceId/tags/:tagId

Update a tag's name or color.

```
Request:
  Body: {
    name?: string
    color?: string
  }

Response 200:
  { data: TagDto }

Auth: required (Bearer, EDITOR or above)
Errors:
  400 VALIDATION_ERROR
  403 FORBIDDEN
  404 TAG_NOT_FOUND
  409 TAG_ALREADY_EXISTS
```

#### DELETE /api/workspaces/:workspaceId/tags/:tagId

Delete a tag and remove it from all notes.

```
Response 204: (no body)

Auth: required (Bearer, ADMIN or above)
Errors:
  403 FORBIDDEN
  404 TAG_NOT_FOUND
```

#### POST /api/workspaces/:workspaceId/tags/:tagId/assign

Assign a tag to one or more notes.

```
Request:
  Body: {
    noteIds: string[]    // required, at least 1
  }

Response 200:
  {
    data: {
      assignedCount: number
    }
  }

Auth: required (Bearer, EDITOR or above)
Errors:
  400 VALIDATION_ERROR
  403 FORBIDDEN
  404 TAG_NOT_FOUND
```

#### POST /api/workspaces/:workspaceId/tags/:tagId/unassign

Remove a tag from one or more notes.

```
Request:
  Body: {
    noteIds: string[]
  }

Response 200:
  {
    data: {
      removedCount: number
    }
  }

Auth: required (Bearer, EDITOR or above)
Errors:
  400 VALIDATION_ERROR
  403 FORBIDDEN
  404 TAG_NOT_FOUND
```

#### POST /api/workspaces/:workspaceId/tags/merge

Merge one tag into another, reassigning all notes.

```
Request:
  Body: {
    sourceTagId: string    // tag to merge (will be deleted)
    targetTagId: string    // tag to merge into
  }

Response 200:
  {
    data: {
      movedNoteCount: number
      deletedTag: TagDto
    }
  }

Auth: required (Bearer, ADMIN or above)
Errors:
  400 VALIDATION_ERROR
  403 FORBIDDEN
  404 TAG_NOT_FOUND
  422 CANNOT_MERGE_SAME_TAG
```

---

### 3.6 Search

#### GET /api/workspaces/:workspaceId/search

Full-text and fuzzy search across notes.

```
Query Params:
  q: string              // required, min 1 char, max 200 chars
  tags?: string[]        // comma-separated tag names to filter
  folder?: string        // filter to this folder path prefix
  createdAfter?: string  // ISO date
  createdBefore?: string
  updatedAfter?: string
  createdBy?: string     // userId
  isTrashed?: boolean    // default: false
  searchIn?: ('title' | 'content' | 'frontmatter')[]   // default: all
  mode?: 'fulltext' | 'fuzzy' | 'hybrid'  // default: hybrid
  limit?: number         // max: 50, default: 20
  offset?: number        // default: 0

Response 200:
  {
    data: {
      results: Array<{
        note: NoteDto
        score: number        // relevance score 0-1
        highlights: {
          title?: string[]   // matched snippets with <mark> tags
          content?: string[] // matched content snippets
        }
      }>
      total: number
      query: string
      took: number           // milliseconds
    }
  }

Auth: required (Bearer, workspace member)
Rate Limit: 30/minute per user
Errors:
  400 VALIDATION_ERROR     — query too short/long
  403 FORBIDDEN
```

#### GET /api/workspaces/:workspaceId/search/suggestions

Get search suggestions based on partial query (for instant search dropdown).

```
Query Params:
  q: string     // partial query, min 2 chars

Response 200:
  {
    data: {
      suggestions: Array<{
        type: 'note' | 'tag' | 'folder'
        id?: string
        label: string
        path?: string
      }>
    }
  }

Auth: required (Bearer, workspace member)
Rate Limit: 60/minute per user
Errors:
  400 VALIDATION_ERROR
```

#### GET /api/workspaces/:workspaceId/search/recent

Get recently searched queries for the authenticated user.

```
Response 200:
  {
    data: {
      recent: Array<{
        query: string
        searchedAt: string
      }>
    }
  }

Auth: required (Bearer, workspace member)
```

#### DELETE /api/workspaces/:workspaceId/search/recent

Clear recent search history.

```
Response 204: (no body)

Auth: required (Bearer, workspace member)
```

---

### 3.7 Graph

#### GET /api/workspaces/:workspaceId/graph

Get the full knowledge graph (all nodes and edges).

```
Query Params:
  tags?: string[]        // filter to notes with these tags
  folder?: string        // filter to folder prefix
  linkTypes?: ('WIKI' | 'MARKDOWN' | 'EMBED' | 'BLOCK_REF')[]
  excludeOrphans?: boolean   // default: false
  depth?: number             // max traversal depth from seeds, default unlimited

Response 200:
  {
    data: GraphData    // { nodes: GraphNode[], edges: GraphEdge[] }
    meta: {
      nodeCount: number
      edgeCount: number
      generatedAt: string
    }
  }

Auth: required (Bearer, workspace member)
Rate Limit: 10/minute per user
Errors:
  403 FORBIDDEN
  404 WORKSPACE_NOT_FOUND
```

#### GET /api/workspaces/:workspaceId/graph/local/:noteId

Get the local graph for a specific note (note and its neighbors).

```
Query Params:
  depth?: number    // traversal depth, default: 2, max: 5

Response 200:
  {
    data: GraphData
    meta: {
      centerNoteId: string
      depth: number
    }
  }

Auth: required (Bearer, workspace member)
Errors:
  403 FORBIDDEN
  404 NOTE_NOT_FOUND
```

#### GET /api/workspaces/:workspaceId/graph/clusters

Get semantic clusters of the graph for layout hints.

```
Response 200:
  {
    data: {
      clusters: Array<{
        id: string
        label: string
        nodeIds: string[]
        centroid: { x: number; y: number }
      }>
    }
  }

Auth: required (Bearer, workspace member)
```

#### POST /api/workspaces/:workspaceId/graph/layout

Save graph node positions for a persistent layout.

```
Request:
  Body: {
    layoutName: string
    positions: Record<string, { x: number; y: number }>   // noteId -> position
  }

Response 200:
  {
    data: {
      layoutId: string
      savedAt: string
    }
  }

Auth: required (Bearer, workspace member)
Errors:
  400 VALIDATION_ERROR
```

#### POST /api/workspaces/:workspaceId/graph/links

Create a link between two notes by drawing an edge in the graph.

```
Request:
  Body: {
    sourceNoteId: string
    targetNoteId: string
    linkType: 'WIKI' | 'MARKDOWN'
  }

Response 201:
  { data: NoteLinkDto }

Auth: required (Bearer, EDITOR or above)
Errors:
  400 VALIDATION_ERROR
  403 FORBIDDEN
  404 NOTE_NOT_FOUND
  409 LINK_ALREADY_EXISTS
```

---

### 3.8 Files & Attachments

#### POST /api/workspaces/:workspaceId/notes/:noteId/attachments

Upload a file attachment to a note.

```
Request:
  Content-Type: multipart/form-data
  Body: FormData {
    file: File
    altText?: string    // for image accessibility
  }

Response 201:
  { data: AttachmentDto }
  Headers:
    Location: /api/workspaces/<workspaceId>/notes/<noteId>/attachments/<id>

Auth: required (Bearer, EDITOR or above)
Rate Limit: 20 uploads/minute per user
Errors:
  400 INVALID_FILE_TYPE
  403 FORBIDDEN
  404 NOTE_NOT_FOUND
  413 FILE_TOO_LARGE        — exceeds 50MB per file limit
  507 STORAGE_QUOTA_EXCEEDED
```

#### GET /api/workspaces/:workspaceId/notes/:noteId/attachments

List all attachments for a note.

```
Response 200:
  { data: AttachmentDto[] }

Auth: required (Bearer, workspace member)
Errors:
  403 FORBIDDEN
  404 NOTE_NOT_FOUND
```

#### GET /api/workspaces/:workspaceId/attachments/:attachmentId

Download or serve a file attachment.

```
Query Params:
  download?: boolean    // default false — inline; true adds Content-Disposition: attachment

Response 200:
  Content-Type: <mimeType>
  Body: <file bytes>

Auth: required (Bearer, workspace member) OR valid public-share token
Errors:
  403 FORBIDDEN
  404 ATTACHMENT_NOT_FOUND
```

#### DELETE /api/workspaces/:workspaceId/attachments/:attachmentId

Delete an attachment.

```
Response 204: (no body)

Auth: required (Bearer, EDITOR or above)
Errors:
  403 FORBIDDEN
  404 ATTACHMENT_NOT_FOUND
```

#### GET /api/workspaces/:workspaceId/attachments

List all attachments in a workspace.

```
Query Params (PaginationQuery):
  mimeType?: string    // filter by MIME type prefix, e.g. "image/"
  noteId?: string      // filter by note

Response 200: PaginatedResponse<AttachmentDto>

Auth: required (Bearer, ADMIN or above)
```

---

### 3.9 Plugins

#### GET /api/plugins/search

Search the global plugin registry (GitHub-sourced).

```
Query Params:
  q?: string           // search by name, description
  tags?: string[]      // filter by tags (comma-separated)
  limit?: number       // default: 20, max: 50
  offset?: number

Response 200:
  {
    data: {
      plugins: PluginRegistryEntry[]
      total: number
    }
  }

Auth: public
Rate Limit: 30/minute per IP
```

#### GET /api/plugins/:pluginId

Get details about a plugin from the registry.

```
Response 200:
  {
    data: PluginRegistryEntry & {
      manifest: PluginManifest
      releases: Array<{
        version: string
        releaseDate: string
        changelog: string
      }>
      readme: string    // raw markdown
    }
  }

Auth: public
Errors:
  404 PLUGIN_NOT_FOUND
```

#### GET /api/workspaces/:workspaceId/plugins

List installed plugins in a workspace.

```
Response 200:
  { data: InstalledPluginDto[] }

Auth: required (Bearer, workspace member)
Errors:
  403 FORBIDDEN
```

#### POST /api/workspaces/:workspaceId/plugins/install

Install a plugin from the registry.

```
Request:
  Body: {
    pluginId: string      // plugin registry ID
    version?: string      // default: latest
  }

Response 201:
  { data: InstalledPluginDto }

Auth: required (Bearer, ADMIN or OWNER)
Rate Limit: 10/minute per workspace
Errors:
  400 VALIDATION_ERROR
  403 FORBIDDEN
  404 PLUGIN_NOT_FOUND
  409 PLUGIN_ALREADY_INSTALLED
  422 INCOMPATIBLE_APP_VERSION   — plugin requires higher app version
  503 REGISTRY_UNAVAILABLE
```

#### DELETE /api/workspaces/:workspaceId/plugins/:pluginId

Uninstall a plugin from the workspace.

```
Query Params:
  preserveData?: boolean    // default: true — keep plugin's stored settings

Response 204: (no body)

Auth: required (Bearer, ADMIN or OWNER)
Errors:
  403 FORBIDDEN
  404 PLUGIN_NOT_INSTALLED
```

#### POST /api/workspaces/:workspaceId/plugins/:pluginId/toggle

Enable or disable an installed plugin.

```
Request:
  Body: {
    enabled: boolean
  }

Response 200:
  { data: InstalledPluginDto }

Auth: required (Bearer, ADMIN or OWNER)
Errors:
  403 FORBIDDEN
  404 PLUGIN_NOT_INSTALLED
```

#### GET /api/workspaces/:workspaceId/plugins/:pluginId/settings

Get the current settings for an installed plugin.

```
Response 200:
  {
    data: {
      schema: PluginSettingsSchema
      values: Record<string, unknown>
    }
  }

Auth: required (Bearer, ADMIN or OWNER)
Errors:
  403 FORBIDDEN
  404 PLUGIN_NOT_INSTALLED
```

#### PATCH /api/workspaces/:workspaceId/plugins/:pluginId/settings

Update plugin settings.

```
Request:
  Body: Record<string, unknown>    // partial settings update

Response 200:
  {
    data: {
      values: Record<string, unknown>
    }
  }

Auth: required (Bearer, ADMIN or OWNER)
Errors:
  400 VALIDATION_ERROR   — value fails plugin schema validation
  403 FORBIDDEN
  404 PLUGIN_NOT_INSTALLED
```

#### POST /api/workspaces/:workspaceId/plugins/:pluginId/upgrade

Upgrade a plugin to a newer version.

```
Request:
  Body: {
    version?: string    // default: latest
  }

Response 200:
  { data: InstalledPluginDto }

Auth: required (Bearer, ADMIN or OWNER)
Errors:
  400 VALIDATION_ERROR
  403 FORBIDDEN
  404 PLUGIN_NOT_INSTALLED
  422 ALREADY_LATEST_VERSION
  503 REGISTRY_UNAVAILABLE
```

---

### 3.10 Publishing

#### GET /api/workspaces/:workspaceId/publish

Get the current publish configuration for a workspace.

```
Response 200:
  {
    data: {
      isPublic: boolean
      publicSlug: string | null
      customDomain: string | null
      theme: string
      enableSearch: boolean
      enableGraph: boolean
      enableComments: boolean
      showBacklinks: boolean
      analyticsEnabled: boolean
      footerContent: string | null
      faviconUrl: string | null
    }
  }

Auth: required (Bearer, ADMIN or OWNER)
Errors:
  403 FORBIDDEN
```

#### PUT /api/workspaces/:workspaceId/publish

Update publish configuration.

```
Request:
  Body: {
    isPublic?: boolean
    publicSlug?: string       // URL-safe, 3-50 chars
    customDomain?: string     // domain must be verified first
    theme?: string
    enableSearch?: boolean
    enableGraph?: boolean
    enableComments?: boolean
    showBacklinks?: boolean
    analyticsEnabled?: boolean
    footerContent?: string
  }

Response 200:
  { data: PublishConfigDto }

Auth: required (Bearer, ADMIN or OWNER)
Errors:
  400 VALIDATION_ERROR
  403 FORBIDDEN
  409 PUBLIC_SLUG_TAKEN
  422 DOMAIN_NOT_VERIFIED
```

#### POST /api/workspaces/:workspaceId/publish/notes/:noteId

Toggle publish status for a specific note.

```
Request:
  Body: {
    isPublished: boolean
    customSlug?: string    // optional custom URL slug for this note
  }

Response 200:
  { data: NoteDto }

Auth: required (Bearer, EDITOR or above)
Errors:
  400 VALIDATION_ERROR
  403 FORBIDDEN
  404 NOTE_NOT_FOUND
  422 WORKSPACE_NOT_PUBLIC    — workspace must be public first
```

#### GET /api/workspaces/:workspaceId/publish/notes

List all published notes in a workspace.

```
Query Params (PaginationQuery)

Response 200: PaginatedResponse<NoteDto>

Auth: required (Bearer, workspace member)
Errors:
  403 FORBIDDEN
```

#### POST /api/workspaces/:workspaceId/publish/domain/verify

Initiate custom domain verification.

```
Request:
  Body: {
    domain: string    // e.g. "docs.example.com"
  }

Response 200:
  {
    data: {
      domain: string
      verificationToken: string    // add as TXT DNS record
      instructions: string
    }
  }

Auth: required (Bearer, OWNER)
Errors:
  400 VALIDATION_ERROR
  403 FORBIDDEN
```

#### POST /api/workspaces/:workspaceId/publish/domain/confirm

Confirm DNS TXT record was added and verify the domain.

```
Response 200:
  {
    data: {
      domain: string
      verified: boolean
      verifiedAt: string | null
    }
  }

Auth: required (Bearer, OWNER)
Errors:
  403 FORBIDDEN
  422 DNS_VERIFICATION_FAILED
```

#### GET /public/:publicSlug

Serve the public vault index page (SSR).

```
Response 200: HTML (server-rendered)

Auth: public
```

#### GET /public/:publicSlug/:notePath

Serve a specific published note (SSR).

```
Response 200: HTML (server-rendered)
Response 301: if note has been moved
Response 404: if note is not published

Auth: public
```

#### GET /api/public/:publicSlug/notes

API for public vault — list published notes (used by public search).

```
Query Params:
  q?: string     // search query
  page, pageSize

Response 200: PaginatedResponse<PublicNoteDto>

Auth: public
Rate Limit: 60/minute per IP
```

#### GET /api/workspaces/:workspaceId/analytics

Get view analytics for published notes.

```
Query Params:
  from?: string    // ISO date
  to?: string
  granularity?: 'day' | 'week' | 'month'

Response 200:
  {
    data: {
      totalViews: number
      uniqueVisitors: number
      topNotes: Array<{
        noteId: string
        title: string
        views: number
      }>
      timeSeries: Array<{
        date: string
        views: number
        visitors: number
      }>
    }
  }

Auth: required (Bearer, ADMIN or OWNER)
```

---

### 3.11 Layouts

#### GET /api/workspaces/:workspaceId/layouts

List saved workspace layouts for the authenticated user.

```
Response 200:
  { data: LayoutDto[] }

Auth: required (Bearer, workspace member)
Errors:
  403 FORBIDDEN
```

#### POST /api/workspaces/:workspaceId/layouts

Save a new layout.

```
Request:
  Body: {
    name: string
    config: LayoutConfig
    isDefault?: boolean    // set as default; unsets previous default
  }

Response 201:
  { data: LayoutDto }

Auth: required (Bearer, workspace member)
Errors:
  400 VALIDATION_ERROR
  403 FORBIDDEN
```

#### GET /api/workspaces/:workspaceId/layouts/:layoutId

Get a specific layout.

```
Response 200:
  { data: LayoutDto }

Auth: required (Bearer, workspace member)
Errors:
  403 FORBIDDEN
  404 LAYOUT_NOT_FOUND
```

#### PATCH /api/workspaces/:workspaceId/layouts/:layoutId

Update a layout.

```
Request:
  Body: {
    name?: string
    config?: LayoutConfig
    isDefault?: boolean
  }

Response 200:
  { data: LayoutDto }

Auth: required (Bearer, workspace member)
Errors:
  400 VALIDATION_ERROR
  403 FORBIDDEN
  404 LAYOUT_NOT_FOUND
```

#### DELETE /api/workspaces/:workspaceId/layouts/:layoutId

Delete a layout.

```
Response 204: (no body)

Auth: required (Bearer, workspace member; layouts are user-scoped)
Errors:
  403 FORBIDDEN
  404 LAYOUT_NOT_FOUND
```

---

### 3.12 Comments

#### GET /api/workspaces/:workspaceId/notes/:noteId/comments

List top-level comments (threads) for a note.

```
Query Params:
  isResolved?: boolean    // default: false (show open only)
  page, pageSize

Response 200: PaginatedResponse<CommentDto>    // includes replies[] for each

Auth: required (Bearer, workspace member)
Errors:
  403 FORBIDDEN
  404 NOTE_NOT_FOUND
```

#### POST /api/workspaces/:workspaceId/notes/:noteId/comments

Create a new comment or reply.

```
Request:
  Body: {
    content: string      // required, max 5000 chars; markdown supported
    position?: {
      from: number       // character offset start
      to: number         // character offset end
    }
    parentId?: string    // for replies — ID of the parent comment
  }

Response 201:
  { data: CommentDto }

Auth: required (Bearer, workspace member; VIEWER cannot comment)
Errors:
  400 VALIDATION_ERROR
  403 FORBIDDEN
  404 NOTE_NOT_FOUND
  404 PARENT_COMMENT_NOT_FOUND
```

#### PATCH /api/workspaces/:workspaceId/notes/:noteId/comments/:commentId

Update a comment's content.

```
Request:
  Body: {
    content: string
  }

Response 200:
  { data: CommentDto }

Auth: required (Bearer; only comment author or ADMIN)
Errors:
  400 VALIDATION_ERROR
  403 FORBIDDEN
  404 COMMENT_NOT_FOUND
```

#### DELETE /api/workspaces/:workspaceId/notes/:noteId/comments/:commentId

Delete a comment.

```
Response 204: (no body)

Auth: required (Bearer; comment author or ADMIN or OWNER)
Errors:
  403 FORBIDDEN
  404 COMMENT_NOT_FOUND
```

#### POST /api/workspaces/:workspaceId/notes/:noteId/comments/:commentId/resolve

Mark a comment thread as resolved.

```
Response 200:
  { data: CommentDto }

Auth: required (Bearer, EDITOR or above)
Errors:
  403 FORBIDDEN
  404 COMMENT_NOT_FOUND
  422 COMMENT_IS_REPLY    — only top-level threads can be resolved
```

#### POST /api/workspaces/:workspaceId/notes/:noteId/comments/:commentId/reopen

Reopen a resolved comment thread.

```
Response 200:
  { data: CommentDto }

Auth: required (Bearer, EDITOR or above)
Errors:
  403 FORBIDDEN
  404 COMMENT_NOT_FOUND
  422 COMMENT_NOT_RESOLVED
```

---

### 3.13 Admin

> All admin endpoints require `isSuperAdmin: true` on the authenticated user unless otherwise noted.

#### GET /api/admin/users

List all users in the system.

```
Query Params (PaginationQuery):
  search?: string
  isActive?: boolean
  isSuperAdmin?: boolean

Response 200: PaginatedResponse<UserDto>

Auth: required (Bearer, superAdmin)
```

#### PATCH /api/admin/users/:userId

Update a user (activate, deactivate, grant/revoke superAdmin).

```
Request:
  Body: {
    isActive?: boolean
    isSuperAdmin?: boolean
    displayName?: string
  }

Response 200:
  { data: UserDto }

Auth: required (Bearer, superAdmin)
Errors:
  400 VALIDATION_ERROR
  403 FORBIDDEN
  404 USER_NOT_FOUND
```

#### DELETE /api/admin/users/:userId

Permanently delete a user and all their data.

```
Request:
  Body: {
    confirmEmail: string    // must match user's email
  }

Response 204: (no body)

Auth: required (Bearer, superAdmin)
Errors:
  400 CONFIRMATION_MISMATCH
  403 FORBIDDEN
  404 USER_NOT_FOUND
```

#### GET /api/admin/auth-providers

List all configured authentication providers system-wide.

```
Response 200:
  { data: AuthProviderDto[] }

Auth: required (Bearer, superAdmin)
```

#### POST /api/admin/auth-providers

Create a new auth provider.

```
Request:
  Body: {
    type: 'SAML' | 'OIDC'
    name: string
    config: SAMLConfig | OIDCConfig
    workspaceId?: string    // null = global provider
    isEnabled?: boolean     // default: true
  }

Response 201:
  { data: AuthProviderDto }

Auth: required (Bearer, superAdmin)
Errors:
  400 VALIDATION_ERROR
```

#### PATCH /api/admin/auth-providers/:providerId

Update an auth provider configuration.

```
Request:
  Body: {
    name?: string
    config?: Partial<SAMLConfig | OIDCConfig>
    isEnabled?: boolean
  }

Response 200:
  { data: AuthProviderDto }

Auth: required (Bearer, superAdmin)
Errors:
  400 VALIDATION_ERROR
  404 AUTH_PROVIDER_NOT_FOUND
```

#### DELETE /api/admin/auth-providers/:providerId

Delete an auth provider.

```
Response 204: (no body)

Auth: required (Bearer, superAdmin)
Errors:
  404 AUTH_PROVIDER_NOT_FOUND
```

#### GET /api/admin/system/settings

Get system-level configuration.

```
Response 200:
  {
    data: {
      registrationEnabled: boolean
      requireEmailVerification: boolean
      maxWorkspacesPerUser: number
      maxNoteSizeMb: number
      maxAttachmentSizeMb: number
      storageQuotaGb: number | null
      smtpConfigured: boolean
      version: string
      buildHash: string
    }
  }

Auth: required (Bearer, superAdmin)
```

#### PATCH /api/admin/system/settings

Update system settings.

```
Request:
  Body: Partial<SystemSettings>

Response 200:
  { data: SystemSettings }

Auth: required (Bearer, superAdmin)
Errors:
  400 VALIDATION_ERROR
```

#### GET /api/admin/system/storage

Get system storage usage statistics.

```
Response 200:
  {
    data: {
      totalNotesSize: number        // bytes
      totalAttachmentsSize: number
      totalSize: number
      workspaceBreakdown: Array<{
        workspaceId: string
        workspaceName: string
        size: number
      }>
    }
  }

Auth: required (Bearer, superAdmin)
```

#### GET /api/admin/workspaces

List all workspaces in the system.

```
Query Params (PaginationQuery):
  search?: string
  isPublic?: boolean

Response 200: PaginatedResponse<WorkspaceDto & { memberCount: number; noteCount: number }>

Auth: required (Bearer, superAdmin)
```

---

### 3.14 Health

#### GET /api/health

Server health check.

```
Response 200:
  {
    status: 'ok' | 'degraded' | 'down'
    timestamp: string
    version: string
    services: {
      database: { status: 'ok' | 'error'; latencyMs?: number }
      cache: { status: 'ok' | 'error'; latencyMs?: number }
      filesystem: { status: 'ok' | 'error' }
      queue: { status: 'ok' | 'error' }
    }
  }

Auth: public
```

#### GET /api/health/websocket

WebSocket server health check.

```
Response 200:
  {
    status: 'ok' | 'error'
    activeConnections: number
    activeDocuments: number
  }

Auth: public
```

---

## 4. WebSocket Events

The Notesaner WebSocket server implements two protocols over a single WebSocket connection:

1. **Yjs sync protocol** — binary messages for CRDT document synchronization
2. **Application events** — JSON messages for presence, notifications, and meta-events

### Connection URL

```
ws://localhost:3001/sync?token=<accessToken>
```

The `token` query parameter must contain a valid JWT access token. Connection is rejected with close code `4401` if missing or expired.

### Message Format

All JSON application messages use an envelope:

```typescript
interface WsMessage {
  type: string;
  payload: unknown;
  requestId?: string;    // optional; echoed back in responses for request-response pairs
}
```

Binary messages are raw Yjs protocol bytes (no envelope). The server differentiates by checking the first byte.

---

### 4.1 Client → Server Events

#### ws:join-document

Join a document room to begin collaborative editing and receive Yjs sync.

```typescript
{
  type: 'ws:join-document',
  payload: {
    noteId: string        // UUID of the note
    workspaceId: string
  }
}
```

Server will respond with `ws:document-joined` or `ws:error`.

#### ws:leave-document

Leave a document room.

```typescript
{
  type: 'ws:leave-document',
  payload: {
    noteId: string
  }
}
```

#### ws:yjs-update

Send a Yjs incremental update. This is a binary message — raw `Uint8Array` from `Y.encodeStateAsUpdateV2(doc, origin)`. The server prepends a 4-byte big-endian length and a 1-byte message type (`0x00` = Yjs update).

```
Binary format:
  [0x00]                   — 1 byte: message type (Yjs update)
  [noteId-length: uint8]   — 1 byte
  [noteId: utf8 bytes]     — variable
  [yjs-update: bytes]      — rest of message
```

#### ws:awareness-update

Send awareness state (cursor position, selection, user presence).

```typescript
{
  type: 'ws:awareness-update',
  payload: {
    noteId: string
    state: {
      cursor?: {
        anchor: { type: string; index: number }
        head: { type: string; index: number }
      }
      selection?: {
        from: number
        to: number
      }
      user: {
        id: string
        displayName: string
        color: string       // hex color assigned per session
        avatarUrl: string | null
      }
    }
  }
}
```

#### ws:ping

Client-initiated keepalive.

```typescript
{
  type: 'ws:ping',
  payload: { timestamp: number }
}
```

#### ws:cursor-move

Send cursor position for real-time cursor display.

```typescript
{
  type: 'ws:cursor-move',
  payload: {
    noteId: string
    position: {
      from: number
      to: number
    }
  }
}
```

#### ws:presence-update

Update the authenticated user's current presence state.

```typescript
{
  type: 'ws:presence-update',
  payload: {
    status: 'online' | 'away' | 'editing'
    noteId: string | null     // currently viewed note
    workspaceId: string
  }
}
```

---

### 4.2 Server → Client Events

#### ws:document-joined

Confirms successful join. Yjs initial state follows immediately after as binary.

```typescript
{
  type: 'ws:document-joined',
  payload: {
    noteId: string
    users: UserPresence[]
  }
}

interface UserPresence {
  userId: string
  displayName: string
  avatarUrl: string | null
  color: string           // unique color assigned per session
  cursor: CursorPosition | null
}
```

#### ws:document-left

Another user left the document.

```typescript
{
  type: 'ws:document-left',
  payload: {
    noteId: string
    userId: string
  }
}
```

#### ws:yjs-sync

Initial Yjs document state sent after join. Binary message format identical to `ws:yjs-update` but with message type byte `0x01` (sync step 1) and `0x02` (sync step 2).

The Yjs sync protocol follows the y-websocket protocol:
- Sync step 1: server sends current state vector
- Sync step 2: client sends missing updates
- Server applies and broadcasts

#### ws:awareness-broadcast

Broadcast another user's awareness state to all subscribers of a document.

```typescript
{
  type: 'ws:awareness-broadcast',
  payload: {
    noteId: string
    userId: string
    state: AwarenessState    // same shape as ws:awareness-update payload.state
  }
}
```

#### ws:note-saved

Server persisted the note to disk and database.

```typescript
{
  type: 'ws:note-saved',
  payload: {
    noteId: string
    contentHash: string
    wordCount: number
    updatedAt: string
  }
}
```

#### ws:note-metadata-changed

Note metadata was changed via REST API while a collaborative session was active.

```typescript
{
  type: 'ws:note-metadata-changed',
  payload: {
    noteId: string
    changes: Partial<NoteDto>
  }
}
```

#### ws:user-joined-workspace

A workspace member connected.

```typescript
{
  type: 'ws:user-joined-workspace',
  payload: {
    workspaceId: string
    user: {
      id: string
      displayName: string
      avatarUrl: string | null
      currentNoteId: string | null
    }
  }
}
```

#### ws:user-left-workspace

A workspace member disconnected.

```typescript
{
  type: 'ws:user-left-workspace',
  payload: {
    workspaceId: string
    userId: string
  }
}
```

#### ws:comment-created

A new comment was posted on a note the client is viewing.

```typescript
{
  type: 'ws:comment-created',
  payload: {
    noteId: string
    comment: CommentDto
  }
}
```

#### ws:comment-resolved

A comment thread was resolved.

```typescript
{
  type: 'ws:comment-resolved',
  payload: {
    noteId: string
    commentId: string
    resolvedBy: string     // userId
  }
}
```

#### ws:note-deleted

A note was deleted or moved to trash while a user was viewing it.

```typescript
{
  type: 'ws:note-deleted',
  payload: {
    noteId: string
    isTrashed: boolean    // true = soft delete; false = permanent
  }
}
```

#### ws:plugin-event

Broadcasts a custom event emitted by a plugin on another user's session.

```typescript
{
  type: 'ws:plugin-event',
  payload: {
    pluginId: string
    eventName: string
    data: unknown
    sourceUserId: string
  }
}
```

#### ws:pong

Server response to client `ws:ping`.

```typescript
{
  type: 'ws:pong',
  payload: { timestamp: number }
}
```

#### ws:error

Error notification. Does not close the connection unless `fatal: true`.

```typescript
{
  type: 'ws:error',
  payload: {
    code: string
    message: string
    fatal: boolean
    requestId?: string     // echoed from request if applicable
  }
}
```

### 4.3 Close Codes

| Code | Meaning |
|------|---------|
| 1000 | Normal closure |
| 4401 | Unauthorized — invalid or expired token |
| 4403 | Forbidden — not a workspace member |
| 4404 | Note not found |
| 4429 | Rate limited |
| 4500 | Internal server error |

---

## 5. Error Code Catalog

Every error response follows this envelope:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description",
    "details": [],
    "requestId": "req_abc123",
    "documentationUrl": "https://docs.notesaner.example.com/errors#ERROR_CODE"
  }
}
```

### 5.1 Auth Errors

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_CREDENTIALS` | 401 | Email or password is incorrect |
| `TOKEN_EXPIRED` | 401 | JWT access token has expired |
| `TOKEN_INVALID` | 401 | JWT is malformed or signature invalid |
| `TOKEN_MISSING` | 401 | Authorization header or refresh token is absent |
| `SESSION_REVOKED` | 401 | Refresh token has been revoked (logout) |
| `TOTP_REQUIRED` | 401 | 2FA is enabled; provide totpCode |
| `TOTP_INVALID` | 401 | TOTP code is incorrect or expired |
| `BACKUP_CODE_INVALID` | 401 | Backup code is invalid |
| `BACKUP_CODE_USED` | 401 | Backup code has already been used |
| `ACCOUNT_DISABLED` | 403 | User account is deactivated |
| `REGISTRATION_DISABLED` | 403 | Self-registration is disabled by admin |
| `SAML_ASSERTION_INVALID` | 401 | SAML assertion signature failed validation |
| `SAML_USER_NOT_PROVISIONED` | 403 | SAML user not allowed to access this instance |
| `SAML_PROVIDER_ERROR` | 500 | IdP returned an unexpected error |
| `OIDC_CODE_INVALID` | 401 | OIDC authorization code is invalid or expired |
| `OIDC_USER_NOT_PROVISIONED` | 403 | OIDC user not allowed |
| `OIDC_PROVIDER_ERROR` | 500 | OIDC provider returned an error |

### 5.2 Validation Errors

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request body or query params failed validation. `details` array contains per-field errors |
| `INVALID_FILE_TYPE` | 400 | Uploaded file MIME type is not allowed |
| `INVALID_FORMAT` | 400 | A field value has an invalid format (not field-specific) |
| `CONFIRMATION_MISMATCH` | 400 | Confirmation value (e.g. slug, email) does not match |

### 5.3 Authorization Errors

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `FORBIDDEN` | 403 | Authenticated but lacks required role or permission |
| `UNAUTHORIZED` | 401 | Not authenticated |

### 5.4 Resource Not Found Errors

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `USER_NOT_FOUND` | 404 | User does not exist |
| `WORKSPACE_NOT_FOUND` | 404 | Workspace does not exist or user lacks access |
| `NOTE_NOT_FOUND` | 404 | Note does not exist in this workspace |
| `VERSION_NOT_FOUND` | 404 | Note version does not exist |
| `TAG_NOT_FOUND` | 404 | Tag does not exist in this workspace |
| `PLUGIN_NOT_FOUND` | 404 | Plugin not found in registry |
| `PLUGIN_NOT_INSTALLED` | 404 | Plugin is not installed in this workspace |
| `ATTACHMENT_NOT_FOUND` | 404 | Attachment does not exist |
| `COMMENT_NOT_FOUND` | 404 | Comment does not exist |
| `PARENT_COMMENT_NOT_FOUND` | 404 | Parent comment for reply does not exist |
| `SESSION_NOT_FOUND` | 404 | Auth session not found |
| `LAYOUT_NOT_FOUND` | 404 | Layout does not exist |
| `MEMBER_NOT_FOUND` | 404 | Workspace member not found |
| `AUTH_PROVIDER_NOT_FOUND` | 404 | Auth provider not found |

### 5.5 Conflict Errors

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `EMAIL_ALREADY_EXISTS` | 409 | Email is already registered |
| `SLUG_ALREADY_EXISTS` | 409 | Workspace slug is already taken |
| `PUBLIC_SLUG_TAKEN` | 409 | Public vault slug is already in use |
| `NOTE_PATH_CONFLICT` | 409 | A note already exists at the requested path |
| `TAG_ALREADY_EXISTS` | 409 | Tag with this name already exists in workspace |
| `USER_ALREADY_MEMBER` | 409 | User is already a workspace member |
| `PLUGIN_ALREADY_INSTALLED` | 409 | Plugin is already installed in this workspace |
| `TWO_FA_ALREADY_ENABLED` | 409 | 2FA is already enabled for this account |
| `LINK_ALREADY_EXISTS` | 409 | Note link already exists |
| `CONCURRENT_EDIT` | 409 | Cannot write content directly while collaborative session is active |

### 5.6 Semantic / Business Logic Errors

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `CANNOT_CHANGE_OWNER_ROLE` | 422 | Cannot change the OWNER's role without transferring ownership |
| `CANNOT_REMOVE_OWNER` | 422 | Cannot remove workspace OWNER; transfer ownership first |
| `OWNER_CANNOT_LEAVE` | 422 | OWNER cannot leave; transfer ownership first |
| `NOTE_NOT_TRASHED` | 422 | Cannot restore a note that is not in trash |
| `COMMENT_IS_REPLY` | 422 | Only top-level comments can be resolved |
| `COMMENT_NOT_RESOLVED` | 422 | Comment thread is not in a resolved state |
| `WORKSPACE_NOT_PUBLIC` | 422 | Workspace must be public before publishing notes |
| `DNS_VERIFICATION_FAILED` | 422 | DNS TXT record was not found |
| `DOMAIN_NOT_VERIFIED` | 422 | Custom domain must be verified before use |
| `CANNOT_MERGE_SAME_TAG` | 422 | Source and target tag must be different |
| `ALREADY_LATEST_VERSION` | 422 | Plugin is already at the latest version |
| `INCOMPATIBLE_APP_VERSION` | 422 | Plugin requires a higher app version |
| `USER_NOT_MEMBER` | 422 | User is not a member of the workspace |
| `TWO_FA_NOT_ENABLED` | 404 | 2FA is not enabled for this account |

### 5.7 Size / Rate Errors

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `NOTE_TOO_LARGE` | 413 | Note content exceeds 10MB limit |
| `FILE_TOO_LARGE` | 413 | Attachment exceeds 50MB limit |
| `STORAGE_QUOTA_EXCEEDED` | 507 | Workspace storage quota is full |
| `TOO_MANY_REQUESTS` | 429 | Rate limit exceeded; see `Retry-After` header |

### 5.8 Server Errors

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INTERNAL_ERROR` | 500 | Unexpected server error; include `requestId` in bug reports |
| `DATABASE_ERROR` | 500 | Database operation failed |
| `FILESYSTEM_ERROR` | 500 | File system operation failed |
| `REGISTRY_UNAVAILABLE` | 503 | GitHub plugin registry is unreachable |
| `EXPORT_SERVICE_UNAVAILABLE` | 503 | Export service is temporarily unavailable |
| `SAML_PROVIDER_ERROR` | 500 | SAML IdP returned an unexpected response |
| `OIDC_PROVIDER_ERROR` | 500 | OIDC provider returned an unexpected response |

---

## 6. Zod Validation Schemas

All schemas use `zod` v3. Import from `@notesaner/contracts/schemas`.

```typescript
import { z } from 'zod';

// ─── Primitives ───────────────────────────────────────────────────

export const uuidSchema = z.string().uuid('Must be a valid UUID');

export const isoDateSchema = z.string().datetime({ offset: true });

export const slugSchema = z
  .string()
  .min(3, 'Slug must be at least 3 characters')
  .max(50, 'Slug must be at most 50 characters')
  .regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers, and hyphens');

export const hexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color (e.g. #FF5733)')
  .optional();

// ─── Auth ─────────────────────────────────────────────────────────

export const registerSchema = z.object({
  email: z.string().email('Must be a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
  displayName: z
    .string()
    .min(1, 'Display name is required')
    .max(100, 'Display name must be at most 100 characters')
    .trim(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
  totpCode: z
    .string()
    .length(6, 'TOTP code must be exactly 6 digits')
    .regex(/^\d{6}$/, 'TOTP code must be numeric')
    .optional(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128),
});

export const totpConfirmSchema = z.object({
  totpCode: z
    .string()
    .length(6)
    .regex(/^\d{6}$/),
});

// ─── Users ────────────────────────────────────────────────────────

export const updateProfileSchema = z.object({
  displayName: z
    .string()
    .min(1)
    .max(100)
    .trim()
    .optional(),
  avatarUrl: z
    .string()
    .url('Must be a valid URL')
    .optional()
    .nullable(),
});

export const userSettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  editorFont: z.string().max(100).optional(),
  editorFontSize: z.number().int().min(10).max(32).optional(),
  lineHeight: z.number().min(1.0).max(3.0).optional(),
  vimMode: z.boolean().optional(),
  spellCheck: z.boolean().optional(),
  locale: z.string().max(10).optional(),
  notificationPreferences: z
    .object({
      comments: z.boolean(),
      mentions: z.boolean(),
      workspaceInvites: z.boolean(),
    })
    .partial()
    .optional(),
});

// ─── Workspaces ───────────────────────────────────────────────────

export const createWorkspaceSchema = z.object({
  name: z
    .string()
    .min(1, 'Workspace name is required')
    .max(100, 'Workspace name must be at most 100 characters')
    .trim(),
  slug: slugSchema,
  description: z.string().max(500).optional(),
});

export const updateWorkspaceSchema = z
  .object({
    name: z.string().min(1).max(100).trim(),
    description: z.string().max(500).nullable(),
    settings: z
      .object({
        defaultNoteTemplate: z.string().nullable(),
        autoSaveInterval: z.number().int().min(100).max(10000),
        versioningEnabled: z.boolean(),
        versionRetentionDays: z.number().int().min(1).max(365),
      })
      .partial(),
  })
  .partial();

export const workspaceRoleSchema = z.enum(['OWNER', 'ADMIN', 'EDITOR', 'VIEWER']);

export const addMemberSchema = z.object({
  email: z.string().email().optional(),
  userId: uuidSchema.optional(),
  role: workspaceRoleSchema,
}).refine(
  (data) => data.email !== undefined || data.userId !== undefined,
  { message: 'Either email or userId must be provided' }
);

// ─── Notes ────────────────────────────────────────────────────────

export const notePathSchema = z
  .string()
  .min(1, 'Path is required')
  .max(1000, 'Path is too long')
  .regex(
    /^[^<>:"|?*\0]+\.md$/,
    'Path must end in .md and not contain invalid characters'
  );

export const createNoteSchema = z.object({
  path: notePathSchema,
  title: z
    .string()
    .min(1, 'Title is required')
    .max(500, 'Title must be at most 500 characters')
    .trim(),
  content: z.string().max(10 * 1024 * 1024, 'Content exceeds 10MB limit').optional(),
  tags: z.array(z.string().min(1).max(100)).max(50).optional(),
  frontmatter: z.record(z.unknown()).optional(),
});

export const updateNoteSchema = z
  .object({
    title: z.string().min(1).max(500).trim(),
    path: notePathSchema,
    isPublished: z.boolean(),
    frontmatter: z.record(z.unknown()),
    tags: z.array(z.string().min(1).max(100)).max(50),
  })
  .partial();

export const moveNoteSchema = z.object({
  newPath: notePathSchema,
  updateLinks: z.boolean().default(true),
});

export const bulkNoteOperationSchema = z.object({
  operation: z.enum(['trash', 'restore', 'delete', 'move', 'tag', 'untag']),
  noteIds: z
    .array(uuidSchema)
    .min(1, 'At least one note ID is required')
    .max(500, 'Cannot bulk operate on more than 500 notes at once'),
  targetFolder: z.string().optional(),
  tagNames: z.array(z.string()).optional(),
});

// ─── Tags ─────────────────────────────────────────────────────────

export const createTagSchema = z.object({
  name: z
    .string()
    .min(1, 'Tag name is required')
    .max(100, 'Tag name must be at most 100 characters')
    .regex(/^[^#]/, 'Tag name must not start with #'),
  color: hexColorSchema,
});

export const updateTagSchema = z
  .object({
    name: z.string().min(1).max(100),
    color: hexColorSchema,
  })
  .partial();

// ─── Search ───────────────────────────────────────────────────────

export const searchQuerySchema = z.object({
  q: z
    .string()
    .min(1, 'Query is required')
    .max(200, 'Query must be at most 200 characters'),
  tags: z.array(z.string()).optional(),
  folder: z.string().optional(),
  createdAfter: isoDateSchema.optional(),
  createdBefore: isoDateSchema.optional(),
  updatedAfter: isoDateSchema.optional(),
  createdBy: uuidSchema.optional(),
  isTrashed: z.boolean().default(false),
  searchIn: z.array(z.enum(['title', 'content', 'frontmatter'])).optional(),
  mode: z.enum(['fulltext', 'fuzzy', 'hybrid']).default('hybrid'),
  limit: z.number().int().min(1).max(50).default(20),
  offset: z.number().int().min(0).default(0),
});

// ─── Comments ─────────────────────────────────────────────────────

export const createCommentSchema = z.object({
  content: z
    .string()
    .min(1, 'Comment content is required')
    .max(5000, 'Comment must be at most 5000 characters'),
  position: z
    .object({
      from: z.number().int().min(0),
      to: z.number().int().min(0),
    })
    .refine((p) => p.to >= p.from, { message: '"to" must be >= "from"' })
    .optional(),
  parentId: uuidSchema.optional(),
});

// ─── Layouts ──────────────────────────────────────────────────────

export const panelTypeSchema = z.enum([
  'editor', 'graph', 'kanban', 'calendar', 'excalidraw', 'settings', 'plugin'
]);

export const tabConfigSchema = z.object({
  id: z.string().uuid(),
  noteId: uuidSchema.optional(),
  pluginId: z.string().optional(),
  title: z.string().max(200),
  isActive: z.boolean(),
});

export const panelConfigSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    id: z.string().uuid(),
    type: panelTypeSchema,
    size: z.number().min(0).max(100),
    tabs: z.array(tabConfigSchema).optional(),
    children: z
      .object({
        panels: z.array(panelConfigSchema),
        orientation: z.enum(['horizontal', 'vertical']),
      })
      .optional(),
  })
);

export const layoutConfigSchema = z.object({
  panels: z.array(panelConfigSchema).min(1),
  orientation: z.enum(['horizontal', 'vertical']),
});

export const saveLayoutSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  config: layoutConfigSchema,
  isDefault: z.boolean().optional(),
});

// ─── Plugins ──────────────────────────────────────────────────────

export const installPluginSchema = z.object({
  pluginId: z.string().min(1).max(100),
  version: z.string().optional(),
});

export const pluginPermissionSchema = z.enum([
  'editor:insert-block',
  'editor:modify-content',
  'editor:register-extension',
  'ui:register-view',
  'ui:register-sidebar',
  'ui:register-command',
  'ui:show-modal',
  'ui:show-notice',
  'storage:local',
  'storage:notes-read',
  'storage:notes-write',
  'network:fetch',
]);

// ─── Pagination ───────────────────────────────────────────────────

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
```

---

## 7. Plugin API Contract (SDK)

The Plugin SDK is exposed to plugins via the `@notesaner/plugin-sdk` package. Plugins interact with the host application through a postMessage bridge — the SDK abstracts this into typed method calls.

### 7.1 Plugin Entry Point

Every plugin must export a default function:

```typescript
import type { PluginContext } from '@notesaner/plugin-sdk';

export default function main(ctx: PluginContext): void | Promise<void> {
  // Registration happens here
}

// Optional: exported for cleanup on disable/uninstall
export function onUnload(ctx: PluginContext): void | Promise<void> {
  // Clean up listeners, timers, DOM, etc.
}
```

### 7.2 Full PluginContext Interface

```typescript
interface PluginContext {
  /** Plugin manifest (read-only) */
  readonly manifest: PluginManifest;

  /** Workspace the plugin is installed in */
  readonly workspace: WorkspaceContextApi;

  /** Editor integration API */
  readonly editor: EditorContextApi;

  /** Persistent key-value storage */
  readonly storage: StorageApi;

  /** Plugin settings (auto-generated from settings schema) */
  readonly settings: SettingsApi;

  /** Event bus */
  readonly events: EventsApi;

  /** Notes data access */
  readonly notes: NotesApi;

  /** UI integration API */
  readonly ui: UiApi;

  /** Network API (requires 'network:fetch' permission) */
  readonly http: HttpApi;

  /** Logger */
  readonly logger: Logger;
}
```

### 7.3 EditorContextApi

```typescript
interface EditorContextApi {
  /**
   * Register a TipTap extension.
   * Requires permission: 'editor:register-extension'
   * Called once at plugin activation; extension persists until plugin is disabled.
   */
  registerExtension(extension: TipTapExtension): Unsubscribe;

  /**
   * Register a custom React component to render a ProseMirror node view.
   * Requires permission: 'editor:register-extension'
   */
  registerNodeView(
    nodeName: string,
    component: React.ComponentType<NodeViewProps>,
    options?: NodeViewOptions
  ): Unsubscribe;

  /**
   * Register a markdown-it rule or serializer for custom syntax.
   * Requires permission: 'editor:register-extension'
   */
  registerMarkdownSerializer(
    name: string,
    serializer: MarkdownSerializer
  ): Unsubscribe;

  /**
   * Programmatically insert a block into the active editor at the cursor position.
   * Requires permission: 'editor:insert-block'
   */
  insertBlock(type: string, attrs?: Record<string, unknown>): Promise<void>;

  /**
   * Replace the selected text range with provided content.
   * Requires permission: 'editor:modify-content'
   */
  replaceSelection(content: string): Promise<void>;

  /**
   * Get the current editor's ProseMirror state (read-only snapshot).
   * Requires permission: 'storage:notes-read'
   */
  getEditorState(): Promise<EditorStateSnapshot>;
}

interface NodeViewOptions {
  atom?: boolean;        // whether this node is an atom (no children)
  inline?: boolean;
  draggable?: boolean;
}

interface EditorStateSnapshot {
  noteId: string | null;
  selection: { from: number; to: number };
  wordCount: number;
  characterCount: number;
}

type Unsubscribe = () => void;
```

### 7.4 WorkspaceContextApi

```typescript
interface WorkspaceContextApi {
  readonly id: string;
  readonly name: string;
  readonly slug: string;

  /**
   * Register a new top-level view (accessible from the ribbon or command palette).
   * Requires permission: 'ui:register-view'
   */
  registerView(
    viewId: string,
    component: React.ComponentType<ViewProps>,
    options: ViewOptions
  ): Unsubscribe;

  /**
   * Register a sidebar panel (right or left sidebar).
   * Requires permission: 'ui:register-sidebar'
   */
  registerSidebarPanel(
    panelId: string,
    component: React.ComponentType<SidebarPanelProps>,
    options: SidebarPanelOptions
  ): Unsubscribe;

  /**
   * Add an item to the status bar (bottom bar).
   */
  registerStatusBarItem(
    itemId: string,
    component: React.ComponentType
  ): Unsubscribe;

  /**
   * Register a command palette command.
   * Requires permission: 'ui:register-command'
   */
  registerCommand(command: PluginCommand): Unsubscribe;

  /**
   * Register a keyboard shortcut.
   * Requires permission: 'ui:register-command'
   */
  registerKeybinding(keybinding: PluginKeybinding): Unsubscribe;

  /**
   * Add an icon to the left ribbon.
   */
  registerRibbonIcon(options: RibbonIconOptions): Unsubscribe;
}

interface ViewOptions {
  title: string;
  icon: string;              // icon name from the icon set
  defaultLocation: 'main' | 'sidebar' | 'floating';
  singleton?: boolean;       // default: true — only one instance at a time
}

interface SidebarPanelOptions {
  title: string;
  icon: string;
  side: 'left' | 'right';
  defaultOpen?: boolean;
}

interface PluginCommand {
  id: string;               // must be unique within the plugin's namespace
  name: string;             // display name in command palette
  description?: string;
  icon?: string;
  callback: () => void | Promise<void>;
  checkCallback?: () => boolean;  // return false to hide command in palette
}

interface PluginKeybinding {
  key: string;              // e.g. 'Ctrl+Shift+E'
  commandId: string;        // references a registered command
  when?: string;            // context expression e.g. 'editorFocus'
}

interface RibbonIconOptions {
  icon: string;
  title: string;
  onClick: () => void;
}
```

### 7.5 StorageApi

```typescript
interface StorageApi {
  /**
   * Get a stored value by key.
   * Requires permission: 'storage:local'
   * Scoped to the plugin's namespace in the workspace.
   */
  get<T = unknown>(key: string): Promise<T | null>;

  /**
   * Set a value for a key.
   * Requires permission: 'storage:local'
   * Maximum value size: 1MB. Maximum total storage: 50MB per plugin.
   */
  set<T = unknown>(key: string, value: T): Promise<void>;

  /**
   * Delete a key.
   * Requires permission: 'storage:local'
   */
  delete(key: string): Promise<void>;

  /**
   * List all keys in the plugin's storage namespace.
   * Requires permission: 'storage:local'
   */
  keys(): Promise<string[]>;

  /**
   * Clear all stored data for this plugin.
   * Requires permission: 'storage:local'
   */
  clear(): Promise<void>;
}
```

### 7.6 SettingsApi

```typescript
interface SettingsApi {
  /**
   * Register the settings schema. Must be called once during onLoad.
   * Schema is used to auto-generate the settings UI.
   */
  register(schema: PluginSettingsSchema): void;

  /**
   * Get the current value of a setting.
   * Returns the default value if the setting has not been customized.
   */
  get<T = unknown>(key: string): T;

  /**
   * Subscribe to changes for a specific setting key.
   * @returns Unsubscribe function
   */
  onChange<T = unknown>(
    key: string,
    callback: (newValue: T, oldValue: T) => void
  ): Unsubscribe;

  /**
   * Get all current settings as a flat object.
   */
  getAll(): Record<string, unknown>;
}
```

### 7.7 EventsApi

```typescript
type PluginEvent =
  | 'note:opened'           // { noteId: string }
  | 'note:closed'           // { noteId: string }
  | 'note:saved'            // { noteId: string; contentHash: string }
  | 'note:created'          // { noteId: string }
  | 'note:deleted'          // { noteId: string }
  | 'note:renamed'          // { noteId: string; oldPath: string; newPath: string }
  | 'editor:change'         // { noteId: string; changeType: 'insert' | 'delete' | 'format' }
  | 'editor:cursor-move'    // { position: { from: number; to: number } }
  | 'workspace:member-joined' // { userId: string }
  | 'workspace:member-left'   // { userId: string }
  | 'layout:changed'        // { layoutId: string }
  | 'plugin:message'        // { sourcePluginId: string; data: unknown } — inter-plugin events
  | string;                 // custom plugin events

interface EventsApi {
  /**
   * Subscribe to an application or custom event.
   * @returns Unsubscribe function
   */
  on<T = unknown>(
    event: PluginEvent,
    handler: (data: T) => void
  ): Unsubscribe;

  /**
   * Unsubscribe a specific handler.
   */
  off<T = unknown>(
    event: PluginEvent,
    handler: (data: T) => void
  ): void;

  /**
   * Emit a custom event. Only 'plugin:message' events are broadcast to other plugins.
   * Own custom events are local to this plugin.
   */
  emit(event: string, data?: unknown): void;
}
```

### 7.8 NotesApi

```typescript
interface NotesApi {
  /**
   * Get the currently active (focused) note.
   * Returns null if no note is open.
   * Requires permission: 'storage:notes-read'
   */
  getActive(): NoteDto | null;

  /**
   * Get a note by ID.
   * Requires permission: 'storage:notes-read'
   */
  getById(noteId: string): Promise<NoteDto>;

  /**
   * Get note content (raw markdown).
   * Requires permission: 'storage:notes-read'
   */
  getContent(noteId: string): Promise<string>;

  /**
   * Search notes in the workspace.
   * Requires permission: 'storage:notes-read'
   */
  search(
    query: string,
    options?: {
      tags?: string[];
      folder?: string;
      limit?: number;
    }
  ): Promise<NoteDto[]>;

  /**
   * Create a new note.
   * Requires permission: 'storage:notes-write'
   */
  create(options: {
    path: string;
    title: string;
    content?: string;
    tags?: string[];
    frontmatter?: Record<string, unknown>;
  }): Promise<NoteDto>;

  /**
   * Update a note's content.
   * Requires permission: 'storage:notes-write'
   */
  updateContent(noteId: string, content: string): Promise<void>;

  /**
   * Open a note in the editor (navigates the active panel to the note).
   */
  open(noteId: string, options?: { newTab?: boolean; split?: boolean }): void;

  /**
   * Get frontmatter of a note as a parsed object.
   * Requires permission: 'storage:notes-read'
   */
  getFrontmatter(noteId: string): Promise<Record<string, unknown>>;

  /**
   * Update specific frontmatter keys on a note.
   * Requires permission: 'storage:notes-write'
   */
  updateFrontmatter(
    noteId: string,
    updates: Record<string, unknown>
  ): Promise<void>;
}
```

### 7.9 UiApi

```typescript
interface NoticeOptions {
  duration?: number;    // milliseconds; 0 = persistent until dismissed
  type?: 'info' | 'success' | 'warning' | 'error';
  actions?: Array<{
    label: string;
    onClick: () => void;
  }>;
}

interface ModalOptions {
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'fullscreen';
  closable?: boolean;
  onClose?: () => void;
}

interface UiApi {
  /**
   * Show a toast notification.
   * Requires permission: 'ui:show-notice'
   */
  showNotice(message: string, options?: NoticeOptions): {
    close: () => void;
    update: (message: string) => void;
  };

  /**
   * Show a modal dialog with a custom React component.
   * Requires permission: 'ui:show-modal'
   */
  showModal(
    component: React.ComponentType<{ onClose: () => void }>,
    options?: ModalOptions
  ): {
    close: () => void;
  };

  /**
   * Open a confirmation dialog.
   */
  confirm(
    message: string,
    options?: {
      title?: string;
      confirmLabel?: string;
      cancelLabel?: string;
      danger?: boolean;
    }
  ): Promise<boolean>;

  /**
   * Show a text input prompt dialog.
   */
  prompt(
    message: string,
    options?: {
      title?: string;
      placeholder?: string;
      defaultValue?: string;
      confirmLabel?: string;
    }
  ): Promise<string | null>;
}
```

### 7.10 HttpApi

```typescript
interface HttpRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: string | FormData | ArrayBuffer;
  timeout?: number;    // milliseconds, default: 30000
}

interface HttpResponse {
  status: number;
  headers: Record<string, string>;
  text(): Promise<string>;
  json<T = unknown>(): Promise<T>;
  arrayBuffer(): Promise<ArrayBuffer>;
}

interface HttpApi {
  /**
   * Make an HTTP request to an external URL.
   * Requires permission: 'network:fetch'
   * CORS is enforced. Internal notesaner API URLs are blocked (use notes API instead).
   */
  fetch(url: string, options?: HttpRequestOptions): Promise<HttpResponse>;
}
```

### 7.11 Logger

```typescript
interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}
```

### 7.12 Permission Enforcement

Calling an API method without the required permission throws a `PermissionDeniedError`:

```typescript
class PermissionDeniedError extends Error {
  readonly requiredPermission: PluginPermission;
  constructor(permission: PluginPermission) {
    super(`Plugin lacks required permission: ${permission}`);
    this.name = 'PermissionDeniedError';
    this.requiredPermission = permission;
  }
}
```

Permission checks happen at the SDK bridge layer before any message is sent to the host, so they fail fast and synchronously.

---

## 8. Sync Protocol Specification

The Notesaner sync protocol is built on top of the [y-websocket](https://github.com/yjs/y-websocket) protocol with extensions for persistence awareness and application-level events.

### 8.1 Protocol Overview

```
Client                                Server
  │                                     │
  │── WebSocket Connect ───────────────►│
  │   ?token=<jwt>                      │
  │◄── Connection Accepted ─────────────│
  │                                     │
  │── ws:join-document ────────────────►│
  │   { noteId, workspaceId }           │
  │                                     │  1. Validate membership
  │                                     │  2. Load or create Y.Doc from filesystem
  │                                     │  3. Get current awareness states
  │◄── ws:document-joined ──────────────│
  │   { users: UserPresence[] }         │
  │                                     │
  │◄── [Binary] Sync Step 1 ────────────│  Current state vector
  │── [Binary] Sync Step 2 ────────────►│  Client's missing updates
  │◄── [Binary] Sync Step 2 reply ──────│  Server's missing updates
  │                                     │
  │   ... collaborative editing ...     │
  │                                     │
  │── [Binary] Yjs Update ─────────────►│
  │◄── [Binary] Yjs Update (broadcast) ─│  To all other clients in document
  │                                     │  (after 500ms debounce)
  │                                     │  → Persist to filesystem
  │                                     │  → Update PostgreSQL metadata
  │◄── ws:note-saved ───────────────────│
  │   { contentHash, wordCount }        │
```

### 8.2 Binary Message Format

All Yjs protocol messages are binary. Message types follow the y-websocket spec:

| Byte (first) | Message Type | Direction | Description |
|---|---|---|---|
| `0` | `messageSync` | both | Yjs sync messages (wrapped) |
| `1` | `messageAwareness` | both | Awareness state updates |
| `2` | `messageAuth` | server→client | Auth challenge (unused, auth via token) |

Within `messageSync` (first byte `0`), the second byte is the sync step:

| Byte (second) | Sync Step | Description |
|---|---|---|
| `0` | `syncStep1` | State vector from sender |
| `1` | `syncStep2` | Missing updates from sender |
| `2` | `syncUpdate` | Incremental update |

After the two-byte header, the message contains a 4-byte big-endian unsigned integer indicating the byte length of the note ID, followed by the note ID as UTF-8, then the Yjs-encoded payload.

### 8.3 Connection Handshake

1. Client opens WebSocket to `ws://<host>/sync?token=<accessToken>`
2. Server validates the JWT token
   - Invalid or expired token: close with code `4401`
   - Valid: proceed
3. Client sends `ws:join-document` JSON message
4. Server validates workspace membership
   - Not a member: close with code `4403`
   - Note not found: close with code `4404`
5. Server loads the Y.Doc:
   - If a Y.Doc is already in memory for this note: use it
   - Otherwise: read the MD file from filesystem, encode it as a Y.Doc, cache in memory (ValKey)
6. Server sends `ws:document-joined` JSON
7. Server immediately sends Sync Step 1 binary message

### 8.4 Initial State Exchange

The initial state exchange follows the y-websocket protocol precisely:

1. **Server → Client**: `[0, 0, <stateVector bytes>]` — sync step 1 with server's state vector
2. **Client → Server**: `[0, 1, <missingUpdates bytes>]` — sync step 2 with updates the server is missing (may be empty if this is a new client)
3. **Server → Client**: `[0, 1, <missingUpdates bytes>]` — sync step 2 with updates the client is missing
4. Both sides are now synchronized. Future edits are sent as sync step 2 (`[0, 2, ...]`) incremental updates.

### 8.5 Incremental Updates

Once synchronized, every client-side Yjs edit generates an update:

1. TipTap editor change → Yjs generates an incremental update
2. Client sends: `[0, 2, <update bytes>]` binary WebSocket message
3. Server:
   - Applies the update to the in-memory Y.Doc
   - Broadcasts the raw update bytes to all other clients subscribed to the same `noteId`
   - Resets the debounce timer (500ms)
4. On debounce expiry, server:
   - Serializes Y.Doc → Markdown string
   - Writes MD file to filesystem (atomic write via temp file + rename)
   - Updates PostgreSQL: `contentHash`, `wordCount`, `updatedAt`, `lastEditedById`
   - Extracts and updates `NoteLink` records from parsed markdown
   - Creates a `NoteVersion` snapshot if configured interval elapsed
   - Sends `ws:note-saved` JSON message to all clients in the document

### 8.6 Awareness Updates

Awareness (presence, cursors) uses the Yjs awareness protocol:

1. Client sends: `[1, <encoded awareness update>]` binary message
2. Server:
   - Updates the awareness state for this client
   - Broadcasts the awareness update to all other clients in the same document
3. Awareness state is automatically cleaned up when a client disconnects

### 8.7 Offline Editing Queue

The client uses `y-indexeddb` to persist the Y.Doc state locally:

1. On first load: client loads state from IndexedDB (if exists), then syncs with server
2. During offline period: edits accumulate in the in-memory Y.Doc and are persisted to IndexedDB by `y-indexeddb` provider
3. On reconnect:
   - Client reconnects WebSocket
   - Re-sends `ws:join-document`
   - The normal sync handshake (steps 1-3 in section 8.4) automatically merges the offline edits — Yjs CRDTs guarantee convergence
4. If the client was offline for more than 24 hours, the server sends a `ws:note-saved` event after sync to confirm the merged state was persisted

### 8.8 Reconnection Protocol

The client implements exponential backoff reconnection:

```typescript
interface ReconnectConfig {
  initialDelayMs: number;    // 1000
  maxDelayMs: number;        // 30000
  backoffFactor: number;     // 2.0
  jitterMs: number;          // 500 random jitter to avoid thundering herd
  maxAttempts: number | null; // null = infinite
}
```

On each reconnect:
1. Re-send `ws:join-document`
2. Perform full Yjs sync handshake (catches any updates missed during disconnection)
3. Re-send current awareness state

The server maintains the Y.Doc in memory for 5 minutes after the last client disconnects, then evicts it (the doc was already persisted to disk via the debounce mechanism). This means fast reconnects (< 5 min) avoid reloading from disk.

### 8.9 Server-Side Persistence Triggers

The following events trigger immediate (non-debounced) persistence:

| Event | Reason |
|-------|--------|
| Last client leaves a document | Ensure no data is lost when room empties |
| Server graceful shutdown | Flush all in-memory docs |
| `PUT /api/.../content` REST call | Direct write; reset Yjs doc to new content |
| Note version creation via REST | Snapshot must reflect current Y.Doc state |
| Note publish toggle | Public page must reflect latest content |

### 8.10 Conflict Resolution

Yjs CRDTs are designed to produce meaningful merges without conflicts. However, the following edge cases are handled:

- **REST write + active Yjs session**: The `PUT .../content` endpoint emits a `ws:note-metadata-changed` event and sends a new sync step 1 to reset the Yjs doc. Active clients receive the updated state vector and their subsequent edits will be applied on top of the new content.
- **File system external change** (admin edited file directly): The file watcher detects the change, reads the new file, creates a new Y.Doc from it, and sends `ws:note-metadata-changed` to active clients. This is a non-CRDT overwrite — clients should show a "Note was modified externally" banner.
- **Server-generated NoteVersion conflicts**: Version numbers are assigned server-side atomically via a database sequence. No conflict possible.

### 8.11 Document Room Lifecycle

```
ws:join-document received
        │
        ▼
Room exists in memory?
        │
    No ──► Load Y.Doc from filesystem
        │         │
        │         ▼
        │   Cache in ValKey (TTL: 5 min after last client)
        │
    Yes ──► Use existing in-memory Y.Doc
        │
        ▼
Add client to room subscriber list
        │
        ▼
Send ws:document-joined + Sync Step 1
        │
        ... clients edit ...
        │
        ▼
ws:leave-document OR WebSocket close
        │
        ▼
Remove client from subscriber list
        │
No clients left in room?
        │
    Yes ──► Immediate persist to filesystem
            Start 5-minute eviction timer
        │
    No  ──► Continue serving room
```

---

*End of API Contract Specification*

*This document is the authoritative contract. Any deviation by either the frontend or backend from the specifications herein requires a PR updating this document first. Breaking changes to existing endpoints must follow the deprecation policy: new version alongside old version for a minimum of 2 sprint cycles before removal.*
