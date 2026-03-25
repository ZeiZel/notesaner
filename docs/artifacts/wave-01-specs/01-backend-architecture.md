# Notesaner — Backend Architecture Specification

**Version**: 1.0.0
**Date**: 2026-03-25
**Scope**: NestJS server (`apps/server`), all modules, REST + WebSocket APIs

This document is the authoritative implementation guide for the Notesaner backend. Developers can implement directly from this spec without additional clarification.

---

## Table of Contents

1. [NestJS Module Map](#1-nestjs-module-map)
2. [API Specification (REST)](#2-api-specification-rest)
3. [WebSocket Protocol](#3-websocket-protocol)
4. [Database Design Deep Dive](#4-database-design-deep-dive)
5. [File System Service](#5-file-system-service)
6. [Auth Architecture](#6-auth-architecture)
7. [Plugin Backend](#7-plugin-backend)
8. [Caching Strategy](#8-caching-strategy)
9. [Security](#9-security)
10. [Error Handling](#10-error-handling)
11. [Open-Source Code to Leverage](#11-open-source-code-to-leverage)

---

## 1. NestJS Module Map

### Application Bootstrap

```typescript
// apps/server/src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  app.useLogger(app.get(Logger));
  app.use(helmet({ contentSecurityPolicy: false })); // CSP configured per-route
  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,         // strip unknown properties
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Global prefix except health and public routes
  app.setGlobalPrefix('api', { exclude: ['/health', '/public/(.*)'] });

  // WebSocket server shares the same HTTP server
  const port = process.env.PORT ?? 3001;
  await app.listen(port);
}
bootstrap();
```

```typescript
// apps/server/src/app.module.ts
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateConfig }),
    LoggerModule.forRootAsync({ useFactory: pinoConfig }),
    PrismaModule,
    ValKeyModule,        // ioredis + cache-manager wrapper
    BullMQModule,        // job queues
    AuthModule,
    UsersModule,
    WorkspacesModule,
    NotesModule,
    FilesModule,
    SearchModule,
    SyncModule,
    PluginsModule,
    PublishingModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ResponseTransformInterceptor },
  ],
})
export class AppModule {}
```

---

### 1.1 Auth Module

```
Module: AuthModule
Path: apps/server/src/modules/auth/
```

**Module definition:**

```typescript
@Module({
  imports: [
    PassportModule.register({ session: false }),
    JwtModule.registerAsync({
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: { expiresIn: '15m', algorithm: 'HS256' },
      }),
      inject: [ConfigService],
    }),
    UsersModule,
    ValKeyModule,
  ],
  controllers: [AuthController, SamlController, OidcController],
  providers: [
    AuthService,
    TokenService,
    SessionService,
    LocalStrategy,
    JwtStrategy,
    JwtRefreshStrategy,
    SamlStrategy,
    OidcStrategy,
    SamlProviderService,
    OidcProviderService,
  ],
  exports: [AuthService, TokenService, JwtStrategy],
})
export class AuthModule {}
```

**Service Interfaces:**

```typescript
interface IAuthService {
  loginLocal(email: string, password: string): Promise<AuthTokens>;
  register(dto: RegisterDto): Promise<UserDto>;
  refreshTokens(refreshToken: string): Promise<AuthTokens>;
  logout(sessionId: string): Promise<void>;
  revokeAllSessions(userId: string): Promise<void>;
  validateUser(email: string, password: string): Promise<User | null>;
  handleSamlCallback(profile: SamlProfile): Promise<AuthTokens>;
  handleOidcCallback(profile: OidcProfile): Promise<AuthTokens>;
  enableTotp(userId: string): Promise<{ secret: string; qrCode: string }>;
  verifyTotp(userId: string, token: string): Promise<boolean>;
}

interface ITokenService {
  generateAccessToken(payload: JwtPayload): string;
  generateRefreshToken(): string;
  verifyAccessToken(token: string): JwtPayload;
  blacklistToken(jti: string, ttl: number): Promise<void>;
  isBlacklisted(jti: string): Promise<boolean>;
}

interface ISessionService {
  createSession(userId: string, refreshToken: string, meta: SessionMeta): Promise<Session>;
  getSession(refreshToken: string): Promise<Session | null>;
  deleteSession(sessionId: string): Promise<void>;
  getUserSessions(userId: string): Promise<Session[]>;
  deleteExpiredSessions(): Promise<void>;  // called by BullMQ job
}

interface ISamlProviderService {
  getProvider(workspaceId: string | null): Promise<SamlProvider | null>;
  generateServiceProviderMetadata(providerId: string): string;
  validateAssertion(providerId: string, body: Record<string, unknown>): Promise<SamlProfile>;
}

interface IOidcProviderService {
  getClient(providerId: string): Promise<OidcClient>;
  generateAuthUrl(providerId: string, state: string, nonce: string): string;
  exchangeCode(providerId: string, code: string, state: string): Promise<OidcTokenSet>;
  getUserInfo(tokenSet: OidcTokenSet): Promise<OidcProfile>;
}
```

**Guards:**

```typescript
// JwtAuthGuard — applied globally via APP_GUARD or per-route
// RefreshJwtGuard — used only on POST /auth/refresh
// LocalAuthGuard — used on POST /auth/login
// SamlAuthGuard — used on POST /auth/saml/:providerId/callback
// OidcAuthGuard — used on GET /auth/oidc/:providerId/callback
// RolesGuard — checks WorkspaceRole from request context
// WorkspaceGuard — validates :workspaceId param and attaches membership to request
```

**Decorators:**

```typescript
@Public()         // skips JwtAuthGuard
@Roles(...roles)  // requires specific workspace roles
@CurrentUser()    // extracts user from request
@CurrentWorkspace() // extracts validated workspace + membership
```

---

### 1.2 Users Module

```
Module: UsersModule
Path: apps/server/src/modules/users/
```

```typescript
@Module({
  imports: [PrismaModule],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  exports: [UsersService, UsersRepository],
})
export class UsersModule {}
```

**Service Interface:**

```typescript
interface IUsersService {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(dto: RegisterDto): Promise<User>;
  update(id: string, dto: UpdateUserDto): Promise<User>;
  updatePassword(id: string, currentPassword: string, newPassword: string): Promise<void>;
  updateAvatar(id: string, filePath: string): Promise<User>;
  deactivate(id: string): Promise<void>;
  // Admin operations
  listAll(params: PaginationParams): Promise<PaginatedResult<UserDto>>;
  promoteToSuperAdmin(id: string): Promise<void>;
}

interface IUsersRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(data: Prisma.UserCreateInput): Promise<User>;
  update(id: string, data: Prisma.UserUpdateInput): Promise<User>;
  delete(id: string): Promise<void>;
  findMany(args: Prisma.UserFindManyArgs): Promise<User[]>;
  count(args: Prisma.UserCountArgs): Promise<number>;
}
```

**Controllers:** `UsersController` — CRUD on `/api/users/me`, admin at `/api/admin/users`

---

### 1.3 Workspaces Module

```
Module: WorkspacesModule
Path: apps/server/src/modules/workspaces/
```

```typescript
@Module({
  imports: [PrismaModule, FilesModule],
  controllers: [WorkspacesController, WorkspaceMembersController, LayoutsController],
  providers: [WorkspacesService, WorkspaceMembersService, LayoutsService, WorkspacesRepository],
  exports: [WorkspacesService],
})
export class WorkspacesModule {}
```

**Service Interface:**

```typescript
interface IWorkspacesService {
  create(userId: string, dto: CreateWorkspaceDto): Promise<WorkspaceDto>;
  findById(id: string): Promise<WorkspaceDto | null>;
  findBySlug(slug: string): Promise<WorkspaceDto | null>;
  findForUser(userId: string): Promise<WorkspaceDto[]>;
  update(id: string, dto: UpdateWorkspaceDto): Promise<WorkspaceDto>;
  delete(id: string): Promise<void>;
  getUserRole(workspaceId: string, userId: string): Promise<WorkspaceRole | null>;
}

interface IWorkspaceMembersService {
  invite(workspaceId: string, email: string, role: WorkspaceRole): Promise<WorkspaceMemberDto>;
  updateRole(workspaceId: string, userId: string, role: WorkspaceRole): Promise<WorkspaceMemberDto>;
  remove(workspaceId: string, userId: string): Promise<void>;
  listMembers(workspaceId: string): Promise<WorkspaceMemberDto[]>;
}

interface ILayoutsService {
  save(workspaceId: string, userId: string, dto: SaveLayoutDto): Promise<LayoutDto>;
  list(workspaceId: string, userId: string): Promise<LayoutDto[]>;
  setDefault(id: string, userId: string): Promise<void>;
  delete(id: string): Promise<void>;
}
```

---

### 1.4 Notes Module

```
Module: NotesModule
Path: apps/server/src/modules/notes/
```

```typescript
@Module({
  imports: [
    PrismaModule,
    FilesModule,
    BullMQModule.registerQueue({ name: 'notes' }),
  ],
  controllers: [NotesController, NoteVersionsController, NoteLinksController, TagsController],
  providers: [
    NotesService,
    NoteLinksService,
    NoteVersionsService,
    TagsService,
    NotesRepository,
    NoteLinksRepository,
    NoteVersionsRepository,
    TagsRepository,
    NotePersistenceProcessor,  // BullMQ processor
  ],
  exports: [NotesService, NoteLinksService, TagsService],
})
export class NotesModule {}
```

**Service Interface:**

```typescript
interface INotesService {
  create(workspaceId: string, userId: string, dto: CreateNoteDto): Promise<NoteDto>;
  findById(workspaceId: string, noteId: string): Promise<NoteDto | null>;
  findByPath(workspaceId: string, path: string): Promise<NoteDto | null>;
  list(workspaceId: string, params: NoteListParams): Promise<PaginatedResult<NoteDto>>;
  update(workspaceId: string, noteId: string, userId: string, dto: UpdateNoteDto): Promise<NoteDto>;
  delete(workspaceId: string, noteId: string): Promise<void>;  // soft delete → trash
  trash(workspaceId: string, noteId: string): Promise<void>;
  restore(workspaceId: string, noteId: string): Promise<void>;
  permanentDelete(workspaceId: string, noteId: string): Promise<void>;
  getContent(workspaceId: string, noteId: string): Promise<string>;  // reads from FS
  persistContent(noteId: string, content: string, userId: string): Promise<void>;
  getGraphData(workspaceId: string): Promise<GraphData>;
  bulkMove(workspaceId: string, noteIds: string[], targetFolder: string): Promise<void>;
  renameWithLinkUpdate(workspaceId: string, noteId: string, newPath: string): Promise<void>;
}

interface INoteLinksService {
  extractAndSave(noteId: string, content: string): Promise<void>;
  getBacklinks(noteId: string): Promise<NoteLinkDto[]>;
  getOutgoingLinks(noteId: string): Promise<NoteLinkDto[]>;
  findUnlinkedMentions(workspaceId: string, noteId: string): Promise<NoteDto[]>;
  repairBrokenLinks(workspaceId: string): Promise<{ repaired: number; broken: number }>;
}

interface INoteVersionsService {
  createVersion(noteId: string, content: string, userId: string, message?: string): Promise<NoteVersionDto>;
  listVersions(noteId: string): Promise<NoteVersionDto[]>;
  getVersion(noteId: string, version: number): Promise<NoteVersionDto | null>;
  revertToVersion(noteId: string, version: number, userId: string): Promise<void>;
}

interface ITagsService {
  listForWorkspace(workspaceId: string): Promise<TagDto[]>;
  addToNote(noteId: string, tagNames: string[]): Promise<void>;
  removeFromNote(noteId: string, tagId: string): Promise<void>;
  upsert(workspaceId: string, name: string): Promise<Tag>;
}
```

**Event Handlers:**

```typescript
// NotesModule listens to file system events from FilesModule
@OnEvent('file.changed')
async handleFileChanged(event: FileChangedEvent): Promise<void>

@OnEvent('file.deleted')
async handleFileDeleted(event: FileDeletedEvent): Promise<void>

@OnEvent('file.renamed')
async handleFileRenamed(event: FileRenamedEvent): Promise<void>
```

**BullMQ Processor:**

```typescript
@Processor('notes')
class NotePersistenceProcessor {
  @Process('persist-note')
  async handlePersistNote(job: Job<PersistNoteJob>): Promise<void>
  // Debounced: writes Yjs doc → MD → filesystem → DB metadata
}
```

---

### 1.5 Files Module

```
Module: FilesModule
Path: apps/server/src/modules/files/
```

```typescript
@Module({
  imports: [PrismaModule, BullMQModule.registerQueue({ name: 'files' })],
  controllers: [FilesController, AttachmentsController],
  providers: [
    FilesService,
    FileWatcherService,
    AttachmentsService,
    PathValidationService,
  ],
  exports: [FilesService, AttachmentsService],
})
export class FilesModule {}
```

**Service Interface:**

```typescript
interface IFilesService {
  readFile(workspaceId: string, relativePath: string): Promise<string>;
  writeFile(workspaceId: string, relativePath: string, content: string): Promise<void>;
  deleteFile(workspaceId: string, relativePath: string): Promise<void>;
  moveFile(workspaceId: string, fromPath: string, toPath: string): Promise<void>;
  listDirectory(workspaceId: string, relativePath: string): Promise<FileTreeNode[]>;
  createDirectory(workspaceId: string, relativePath: string): Promise<void>;
  deleteDirectory(workspaceId: string, relativePath: string): Promise<void>;
  atomicWrite(absolutePath: string, content: string): Promise<void>;
  getWorkspaceRoot(workspaceId: string): string;
  resolveSafePath(workspaceId: string, relativePath: string): string;  // traversal prevention
}

interface IFileWatcherService {
  watchWorkspace(workspaceId: string, storagePath: string): void;
  unwatchWorkspace(workspaceId: string): void;
  isWatching(workspaceId: string): boolean;
}

interface IAttachmentsService {
  upload(noteId: string, file: Express.Multer.File): Promise<AttachmentDto>;
  getAttachment(attachmentId: string): Promise<Attachment | null>;
  delete(attachmentId: string): Promise<void>;
  getStoragePath(noteId: string, filename: string): string;
}

interface IPathValidationService {
  validate(workspaceId: string, relativePath: string): void;  // throws on traversal attempt
  sanitize(filename: string): string;
  isMarkdownFile(path: string): boolean;
}
```

---

### 1.6 Search Module

```
Module: SearchModule
Path: apps/server/src/modules/search/
```

```typescript
@Module({
  imports: [PrismaModule, ValKeyModule],
  controllers: [SearchController],
  providers: [SearchService, SearchIndexService],
  exports: [SearchService],
})
export class SearchModule {}
```

**Service Interface:**

```typescript
interface ISearchService {
  search(workspaceId: string, params: NoteSearchParams): Promise<NoteSearchResult>;
  // Full-text + fuzzy combined, ranked
  suggest(workspaceId: string, prefix: string): Promise<string[]>;
  // Typeahead suggestions from title index
  indexNote(noteId: string, title: string, content: string): Promise<void>;
  // Called after every note persist
  removeFromIndex(noteId: string): Promise<void>;
}

interface ISearchIndexService {
  rebuildIndex(workspaceId: string): Promise<void>;  // admin operation
  updateTsVector(noteId: string, content: string): Promise<void>;
}
```

---

### 1.7 Sync Module (WebSocket / Yjs)

```
Module: SyncModule
Path: apps/server/src/modules/sync/
```

```typescript
@Module({
  imports: [
    NotesModule,
    AuthModule,
    ValKeyModule,
    BullMQModule.registerQueue({ name: 'sync' }),
  ],
  providers: [
    SyncGateway,       // @WebSocketGateway
    YjsRoomManager,
    SyncPersistenceService,
    AwarenessService,
    SyncAuthService,
  ],
  exports: [SyncGateway],
})
export class SyncModule {}
```

**Service Interface:**

```typescript
interface IYjsRoomManager {
  getOrCreateRoom(docId: string): YjsRoom;
  getRoom(docId: string): YjsRoom | null;
  destroyRoom(docId: string): void;
  getRoomClientCount(docId: string): number;
  broadcastUpdate(docId: string, update: Uint8Array, excludeClientId?: string): void;
}

interface ISyncPersistenceService {
  loadDocument(workspaceId: string, noteId: string): Promise<Uint8Array | null>;
  // Reads initial Yjs state from filesystem (MD → Yjs)
  persistDocument(workspaceId: string, noteId: string, doc: Y.Doc): Promise<void>;
  // Serializes Yjs doc → MD → filesystem + updates DB metadata
  scheduleDebounced(workspaceId: string, noteId: string, doc: Y.Doc): void;
  // Enqueues a debounced persist job (500ms window)
}

interface IAwarenessService {
  updateAwareness(docId: string, clientId: string, state: AwarenessState): void;
  getAwarenessStates(docId: string): Map<string, AwarenessState>;
  removeClient(docId: string, clientId: string): void;
}
```

**Gateway:**

```typescript
@WebSocketGateway({
  namespace: '/sync',
  cors: { origin: process.env.ALLOWED_ORIGINS?.split(','), credentials: true },
  transports: ['websocket'],
})
@UseGuards(WsJwtGuard)
class SyncGateway implements OnGatewayConnection, OnGatewayDisconnect {
  handleConnection(client: AuthenticatedSocket): void
  handleDisconnect(client: AuthenticatedSocket): void

  @SubscribeMessage('join')
  handleJoin(client: AuthenticatedSocket, payload: JoinPayload): WsResponse

  @SubscribeMessage('leave')
  handleLeave(client: AuthenticatedSocket, payload: LeavePayload): void

  @SubscribeMessage('sync-step1')
  handleSyncStep1(client: AuthenticatedSocket, payload: SyncStep1Payload): void

  @SubscribeMessage('sync-step2')
  handleSyncStep2(client: AuthenticatedSocket, payload: SyncStep2Payload): void

  @SubscribeMessage('update')
  handleUpdate(client: AuthenticatedSocket, payload: UpdatePayload): void

  @SubscribeMessage('awareness')
  handleAwareness(client: AuthenticatedSocket, payload: AwarenessPayload): void
}
```

---

### 1.8 Plugins Module

```
Module: PluginsModule
Path: apps/server/src/modules/plugins/
```

```typescript
@Module({
  imports: [
    PrismaModule,
    FilesModule,
    ValKeyModule,
    BullMQModule.registerQueue({ name: 'plugins' }),
  ],
  controllers: [PluginsController, PluginRegistryController],
  providers: [
    PluginsService,
    PluginRegistryService,
    PluginDownloadService,
    PluginManifestValidator,
    PluginInstallProcessor,  // BullMQ
  ],
  exports: [PluginsService],
})
export class PluginsModule {}
```

**Service Interface:**

```typescript
interface IPluginsService {
  install(workspaceId: string, repository: string, version?: string): Promise<InstalledPluginDto>;
  uninstall(workspaceId: string, pluginId: string): Promise<void>;
  toggle(workspaceId: string, pluginId: string, enabled: boolean): Promise<void>;
  listInstalled(workspaceId: string): Promise<InstalledPluginDto[]>;
  updateSettings(workspaceId: string, pluginId: string, settings: Record<string, unknown>): Promise<void>;
  getSettings(workspaceId: string, pluginId: string): Promise<Record<string, unknown>>;
  checkForUpdates(workspaceId: string): Promise<PluginUpdateInfo[]>;
}

interface IPluginRegistryService {
  search(params: PluginSearchParams): Promise<PluginSearchResult>;
  // Queries GitHub API for repos with "notesaner-plugin" topic
  getManifest(repository: string, version?: string): Promise<PluginManifest>;
  // Fetches manifest.json from GitHub release
  refreshCache(): Promise<void>;
  // BullMQ job: fetches all plugins from GitHub, caches in ValKey
}

interface IPluginDownloadService {
  downloadRelease(repository: string, version: string, targetDir: string): Promise<void>;
  // Downloads release tarball from GitHub, extracts to targetDir
  getReleaseTarballUrl(repository: string, version: string): Promise<string>;
}

interface IPluginManifestValidator {
  validate(manifest: unknown): PluginManifest;
  // Throws ValidationException on invalid manifest
  checkPermissions(manifest: PluginManifest, allowed: PluginPermission[]): void;
}
```

---

### 1.9 Publishing Module

```
Module: PublishingModule
Path: apps/server/src/modules/publishing/
```

```typescript
@Module({
  imports: [PrismaModule, NotesModule, ValKeyModule],
  controllers: [PublishController, PublicVaultController],
  providers: [PublishService, PublicRenderService, PublicSearchService],
  exports: [PublishService],
})
export class PublishingModule {}
```

**Service Interface:**

```typescript
interface IPublishService {
  publishNote(workspaceId: string, noteId: string): Promise<void>;
  unpublishNote(workspaceId: string, noteId: string): Promise<void>;
  setPublicVault(workspaceId: string, config: PublicVaultConfig): Promise<void>;
  getPublicVaultConfig(workspaceId: string): Promise<PublicVaultConfig | null>;
  getPublicNavigation(publicSlug: string): Promise<NavNode[]>;
  // Auto-generated from folder structure of published notes
  invalidateCache(workspaceId: string): Promise<void>;
}

interface IPublicRenderService {
  renderNote(publicSlug: string, notePath: string): Promise<RenderedNote>;
  // Reads from FS, parses MD → HTML, caches in ValKey
  renderVaultIndex(publicSlug: string): Promise<RenderedVaultIndex>;
  getGraphData(publicSlug: string): Promise<GraphData>;
  // Only published notes
}
```

---

### 1.10 Health Module

```
Module: HealthModule
Path: apps/server/src/modules/health/
```

```typescript
@Module({
  imports: [TerminusModule, PrismaModule, ValKeyModule],
  controllers: [HealthController],
  providers: [PrismaHealthIndicator, ValKeyHealthIndicator],
})
export class HealthModule {}
```

**Endpoints:** `GET /health` (public), `GET /health/ready`, `GET /health/live`

---

## 2. API Specification (REST)

### Authentication conventions

All routes require `Authorization: Bearer <access_token>` unless marked `[PUBLIC]`.
Admin routes require `isSuperAdmin: true` on the JWT payload.
Owner/Admin/Editor/Viewer denotes required workspace role.

### Pagination

All list endpoints use cursor-based pagination by default for performance. Offset pagination is supported for compatibility.

Request params: `limit` (default 20, max 100), `cursor` (opaque string from previous response), `offset` (alternative to cursor).

Response envelope:

```json
{
  "data": [...],
  "pagination": {
    "total": 1500,
    "limit": 20,
    "cursor": "eyJpZCI6Inh4eCJ9",
    "hasMore": true
  }
}
```

---

### 2.1 Auth Endpoints

#### POST /api/auth/login `[PUBLIC]`

Rate limit: 10/min per IP.

Request:
```typescript
class LoginDto {
  @IsEmail() email: string;
  @IsString() @MinLength(8) password: string;
  @IsOptional() @IsString() totpCode?: string;
}
```

Response `200`:
```typescript
{
  user: UserDto;
  accessToken: string;       // JWT, 15m TTL
  expiresIn: 900;
  // refreshToken set as httpOnly cookie: refresh_token
}
```

Errors: `401 INVALID_CREDENTIALS`, `401 TOTP_REQUIRED`, `401 TOTP_INVALID`, `429 RATE_LIMITED`

#### POST /api/auth/register `[PUBLIC]`

Rate limit: 5/min per IP. Disabled if `ALLOW_REGISTRATION=false` env var.

Request:
```typescript
class RegisterDto {
  @IsEmail() email: string;
  @IsString() @MinLength(8) @MaxLength(72) password: string;
  @IsString() @MinLength(1) @MaxLength(100) displayName: string;
}
```

Response `201`: `{ user: UserDto, accessToken: string, expiresIn: number }`

#### POST /api/auth/refresh `[PUBLIC]`

Reads `refresh_token` from httpOnly cookie. Rate limit: 30/min per IP.

Response `200`: `{ accessToken: string, expiresIn: 900 }`

Errors: `401 REFRESH_TOKEN_INVALID`, `401 REFRESH_TOKEN_EXPIRED`

#### POST /api/auth/logout

Deletes session, rotates/invalidates refresh token cookie.

Response `204`

#### GET /api/auth/me

Response `200`: `UserDto`

#### GET /api/auth/sessions

Returns all active sessions for the current user.

Response `200`: `SessionDto[]`

#### DELETE /api/auth/sessions/:sessionId

Revoke a specific session.

Response `204`

#### GET /api/auth/providers `[PUBLIC]`

Returns enabled auth providers for login page display.

Response `200`:
```json
{
  "providers": [
    { "id": "uuid", "type": "SAML", "name": "Corporate SSO", "loginUrl": "/api/auth/saml/uuid/init" },
    { "id": "uuid", "type": "OIDC", "name": "Authentik", "loginUrl": "/api/auth/oidc/uuid/init" }
  ],
  "localEnabled": true
}
```

#### GET /api/auth/saml/:providerId/init `[PUBLIC]`

Redirects to IdP SSO URL (SP-initiated flow).

#### POST /api/auth/saml/:providerId/callback `[PUBLIC]`

Handles SAML assertion from IdP. Sets cookies, redirects to app.

#### GET /api/auth/saml/:providerId/metadata `[PUBLIC]`

Returns SP metadata XML for IdP configuration.

#### GET /api/auth/oidc/:providerId/init `[PUBLIC]`

Redirects to OIDC authorization endpoint.

#### GET /api/auth/oidc/:providerId/callback `[PUBLIC]`

Handles OIDC authorization code exchange. Sets cookies, redirects to app.

#### POST /api/auth/totp/enable

Response `200`: `{ secret: string, qrCodeDataUrl: string }`

#### POST /api/auth/totp/verify

Request: `{ token: string }` — Response `200`: `{ enabled: true }`

#### DELETE /api/auth/totp

Disables TOTP for current user.

---

### 2.2 Users Endpoints

#### GET /api/users/me

Response `200`: `UserDto`

#### PATCH /api/users/me

Rate limit: 10/min.

Request:
```typescript
class UpdateProfileDto {
  @IsOptional() @IsString() @MaxLength(100) displayName?: string;
  @IsOptional() @IsUrl() avatarUrl?: string;
}
```

Response `200`: `UserDto`

#### PATCH /api/users/me/password

```typescript
class ChangePasswordDto {
  @IsString() currentPassword: string;
  @IsString() @MinLength(8) newPassword: string;
}
```

Response `204`

#### POST /api/users/me/avatar

`multipart/form-data`, field `file`, max 5MB, MIME: `image/jpeg, image/png, image/webp`.

Response `200`: `{ avatarUrl: string }`

#### GET /api/admin/users `[SuperAdmin]`

Query: `?limit=20&cursor=&search=`

Response `200`: Paginated `UserDto[]`

#### PATCH /api/admin/users/:userId `[SuperAdmin]`

```typescript
class AdminUpdateUserDto {
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsBoolean() isSuperAdmin?: boolean;
}
```

Response `200`: `UserDto`

---

### 2.3 Workspaces Endpoints

#### GET /api/workspaces

Returns workspaces the current user is a member of.

Response `200`: `WorkspaceDto[]`

#### POST /api/workspaces

Rate limit: 5/hour per user.

```typescript
class CreateWorkspaceDto {
  @IsString() @MinLength(1) @MaxLength(100) name: string;
  @IsString() @Matches(/^[a-z0-9-]+$/) @MinLength(2) @MaxLength(50) slug: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
}
```

Response `201`: `WorkspaceDto`

Errors: `409 SLUG_TAKEN`

#### GET /api/workspaces/:workspaceId `[Viewer+]`

Response `200`: `WorkspaceDto`

#### PATCH /api/workspaces/:workspaceId `[Owner|Admin]`

```typescript
class UpdateWorkspaceDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() isPublic?: boolean;
  @IsOptional() @IsString() publicSlug?: string;
  @IsOptional() settings?: Record<string, unknown>;
}
```

Response `200`: `WorkspaceDto`

#### DELETE /api/workspaces/:workspaceId `[Owner]`

Soft-deletes all notes, removes filesystem directory (async BullMQ job). Response `204`.

#### GET /api/workspaces/:workspaceId/members `[Viewer+]`

Response `200`: `WorkspaceMemberDto[]`

#### POST /api/workspaces/:workspaceId/members `[Owner|Admin]`

```typescript
class InviteMemberDto {
  @IsEmail() email: string;
  @IsEnum(WorkspaceRole) role: WorkspaceRole;
}
```

Response `201`: `WorkspaceMemberDto`

#### PATCH /api/workspaces/:workspaceId/members/:userId `[Owner|Admin]`

```typescript
class UpdateMemberRoleDto {
  @IsEnum(WorkspaceRole) role: WorkspaceRole;
}
```

Response `200`: `WorkspaceMemberDto`

#### DELETE /api/workspaces/:workspaceId/members/:userId `[Owner|Admin]`

Response `204`

#### GET /api/workspaces/:workspaceId/layouts `[Viewer+]`

Returns layouts for current user in workspace.

Response `200`: `LayoutDto[]`

#### POST /api/workspaces/:workspaceId/layouts `[Editor+]`

```typescript
class SaveLayoutDto {
  @IsString() name: string;
  @IsObject() config: LayoutConfig;
  @IsBoolean() @IsOptional() isDefault?: boolean;
}
```

Response `201`: `LayoutDto`

#### DELETE /api/workspaces/:workspaceId/layouts/:layoutId `[Editor+]`

Response `204`

---

### 2.4 Notes Endpoints

#### GET /api/workspaces/:workspaceId/notes `[Viewer+]`

Query params:
- `folder` — filter by folder prefix (e.g. `projects/`)
- `isTrashed` — boolean (default false)
- `limit`, `cursor`, `offset`

Response `200`: Paginated `NoteDto[]`

#### POST /api/workspaces/:workspaceId/notes `[Editor+]`

Rate limit: 60/min per user.

```typescript
class CreateNoteDto {
  @IsString() @Matches(/^[^<>:"|?*\\]+\.md$/) path: string;
  @IsString() @MaxLength(500) title: string;
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
}
```

Response `201`: `NoteDto`

Errors: `409 NOTE_PATH_EXISTS`, `400 INVALID_PATH`

#### GET /api/workspaces/:workspaceId/notes/:noteId `[Viewer+]`

Response `200`: `NoteDto`

#### PATCH /api/workspaces/:workspaceId/notes/:noteId `[Editor+]`

Rate limit: 120/min per user.

```typescript
class UpdateNoteDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() path?: string;  // triggers rename + link update
  @IsOptional() @IsBoolean() isPublished?: boolean;
  @IsOptional() @IsArray() tags?: string[];
  @IsOptional() frontmatter?: Record<string, unknown>;
}
```

Note: Content updates do NOT go through this endpoint — content is managed exclusively via WebSocket Yjs sync. This endpoint handles metadata only.

Response `200`: `NoteDto`

#### DELETE /api/workspaces/:workspaceId/notes/:noteId `[Editor+]`

Soft-delete (moves to trash). Permanent delete requires `?permanent=true` and `Owner|Admin` role.

Response `204`

#### POST /api/workspaces/:workspaceId/notes/:noteId/restore `[Editor+]`

Restores trashed note.

Response `200`: `NoteDto`

#### GET /api/workspaces/:workspaceId/notes/:noteId/content `[Viewer+]`

Returns raw markdown content from filesystem.

Response `200`: `{ content: string, contentHash: string }`

#### GET /api/workspaces/:workspaceId/notes/:noteId/versions `[Viewer+]`

Query: `?limit=20&offset=0`

Response `200`: `{ versions: NoteVersionDto[], total: number }`

#### GET /api/workspaces/:workspaceId/notes/:noteId/versions/:version `[Viewer+]`

Response `200`: `NoteVersionDto`

#### POST /api/workspaces/:workspaceId/notes/:noteId/versions/:version/revert `[Editor+]`

Response `200`: `NoteDto`

#### GET /api/workspaces/:workspaceId/notes/:noteId/links `[Viewer+]`

Response `200`: `{ links: NoteLinkDto[] }`

#### GET /api/workspaces/:workspaceId/notes/:noteId/backlinks `[Viewer+]`

Response `200`: `{ backlinks: NoteLinkDto[] }`

#### GET /api/workspaces/:workspaceId/notes/:noteId/comments `[Viewer+]`

Response `200`: `{ comments: CommentDto[], total: number }`

#### POST /api/workspaces/:workspaceId/notes/:noteId/comments `[Editor+]`

```typescript
class CreateCommentDto {
  @IsString() @MinLength(1) @MaxLength(10000) content: string;
  @IsOptional() position?: { from: number; to: number };
  @IsOptional() @IsUUID() parentId?: string;
}
```

Response `201`: `CommentDto`

#### PATCH /api/workspaces/:workspaceId/notes/:noteId/comments/:commentId `[owner only]`

Response `200`: `CommentDto`

#### DELETE /api/workspaces/:workspaceId/notes/:noteId/comments/:commentId `[owner or Admin]`

Response `204`

#### POST /api/workspaces/:workspaceId/notes/:noteId/comments/:commentId/resolve `[Editor+]`

Response `200`: `CommentDto`

---

### 2.5 Search Endpoints

#### GET /api/workspaces/:workspaceId/notes/search `[Viewer+]`

Rate limit: 60/min per user. Results cached 30s in ValKey.

Query params (all via `NoteSearchParams`):
- `q` — required, min 1 char
- `tags` — comma-separated tag names
- `folder` — folder prefix
- `createdAfter`, `createdBefore` — ISO dates
- `sortBy` — `relevance | updatedAt | createdAt | title`
- `limit` — default 20, max 50
- `offset` — for pagination

Response `200`:
```typescript
{
  notes: NoteDto[];
  total: number;
  highlights: Record<noteId, string[]>;  // snippets with <mark> tags
}
```

#### GET /api/workspaces/:workspaceId/graph `[Viewer+]`

Returns graph data for all non-trashed notes.

Response `200`: `GraphData` (nodes + edges)

Cache: 60s in ValKey, invalidated on note create/delete/link change.

#### GET /api/workspaces/:workspaceId/tags `[Viewer+]`

Response `200`: `TagDto[]`

---

### 2.6 Files Endpoints

#### GET /api/workspaces/:workspaceId/files `[Viewer+]`

Returns file tree.

Query: `?path=/` (default root), `?depth=1` (default: full tree)

Response `200`:
```typescript
{
  tree: FileTreeNode[];
}
// FileTreeNode: { name, path, type: 'file'|'folder', children?, size?, mimeType? }
```

#### POST /api/workspaces/:workspaceId/files/folders `[Editor+]`

```typescript
class CreateFolderDto {
  @IsString() @Matches(/^[^<>:"|?*\\]+$/) path: string;
}
```

Response `201`: `{ path: string }`

#### DELETE /api/workspaces/:workspaceId/files/:encodedPath `[Editor+]`

`encodedPath` is base64url-encoded relative path.

Response `204`

#### POST /api/workspaces/:workspaceId/files/move `[Editor+]`

```typescript
class MoveFileDto {
  @IsString() fromPath: string;
  @IsString() toPath: string;
}
```

Response `200`: `{ newPath: string }`

#### POST /api/workspaces/:workspaceId/notes/:noteId/attachments `[Editor+]`

`multipart/form-data`. Max file size: 50MB. Allowed MIME types configured per workspace.

Rate limit: 20 uploads/min per user.

Response `201`: `AttachmentDto`

#### GET /api/workspaces/:workspaceId/notes/:noteId/attachments/:attachmentId `[Viewer+]`

Streams file from filesystem. Sets appropriate Content-Type and Content-Disposition headers.

Response `200`: binary stream

#### DELETE /api/workspaces/:workspaceId/notes/:noteId/attachments/:attachmentId `[Editor+]`

Response `204`

---

### 2.7 Plugins Endpoints

#### GET /api/plugins/search `[Authenticated]`

Rate limit: 30/min per user. Cached 5min in ValKey.

Query: `?q=whiteboard&tags=editor,visual&limit=20&offset=0`

Response `200`: `PluginSearchResult`

#### GET /api/workspaces/:workspaceId/plugins `[Viewer+]`

Response `200`: `InstalledPluginDto[]`

#### POST /api/workspaces/:workspaceId/plugins/install `[Owner|Admin]`

Rate limit: 10/min per workspace.

```typescript
class InstallPluginDto {
  @IsUrl() repository: string;       // GitHub URL
  @IsOptional() @IsString() version?: string;  // default: latest
}
```

Response `202`: `{ jobId: string }` — installation is async (BullMQ job)

#### GET /api/workspaces/:workspaceId/plugins/install/:jobId `[Owner|Admin]`

Check installation status.

Response `200`: `{ status: 'pending'|'running'|'completed'|'failed', error?: string, plugin?: InstalledPluginDto }`

#### PATCH /api/workspaces/:workspaceId/plugins/:pluginId/toggle `[Owner|Admin]`

```typescript
class TogglePluginDto {
  @IsBoolean() enabled: boolean;
}
```

Response `200`: `InstalledPluginDto`

#### GET /api/workspaces/:workspaceId/plugins/:pluginId/settings `[Viewer+]`

Response `200`: `{ schema: PluginSettingsSchema, values: Record<string, unknown> }`

#### PATCH /api/workspaces/:workspaceId/plugins/:pluginId/settings `[Editor+]`

```typescript
class UpdatePluginSettingsDto {
  @IsObject() settings: Record<string, unknown>;
}
```

Response `200`: `{ settings: Record<string, unknown> }`

#### DELETE /api/workspaces/:workspaceId/plugins/:pluginId `[Owner|Admin]`

Response `204`

---

### 2.8 Publishing Endpoints

#### GET /api/workspaces/:workspaceId/publish `[Owner|Admin]`

Response `200`:
```typescript
{
  isEnabled: boolean;
  publicSlug: string | null;
  customDomain: string | null;
  theme: string;
  allowComments: boolean;
}
```

#### PUT /api/workspaces/:workspaceId/publish `[Owner|Admin]`

```typescript
class PublicVaultConfigDto {
  @IsBoolean() isEnabled: boolean;
  @IsOptional() @IsString() @Matches(/^[a-z0-9-]+$/) publicSlug?: string;
  @IsOptional() @IsString() customDomain?: string;
  @IsOptional() @IsEnum(['default','dark','sepia']) theme?: string;
  @IsOptional() @IsBoolean() allowComments?: boolean;
}
```

Response `200`: updated config

#### Public Vault Routes (no auth required)

These are served by `PublicVaultController` without the JWT guard:

`GET /public/:slug` — vault index
`GET /public/:slug/:notePath(*)` — individual note (SSR)
`GET /public/:slug/search?q=` — search within published vault
`GET /public/:slug/graph` — graph data for published notes

---

### 2.9 Health Endpoints

#### GET /health `[PUBLIC]`

Response `200`: `{ status: 'ok', timestamp: string }`

#### GET /health/ready `[PUBLIC]`

Checks DB, ValKey. Returns `503` if any dependency is down.

Response `200`:
```json
{
  "status": "ok",
  "details": {
    "database": { "status": "up" },
    "valkey": { "status": "up" }
  }
}
```

#### GET /health/live `[PUBLIC]`

Simple liveness probe — always `200` if process is running.

---

## 3. WebSocket Protocol

### Connection

WebSocket server runs on the same HTTP server as REST, at the `/sync` namespace.

```
ws://host/sync
```

Authentication is performed during the WebSocket handshake via query parameter or Authorization header:

```
// Option A: Query parameter (used by y-websocket)
ws://host/sync?token=<access_token>

// Option B: Authorization header (preferred for non-browser clients)
Authorization: Bearer <access_token>
```

The `WsJwtGuard` validates the token on `handleConnection`. If invalid, the socket is immediately disconnected with code `4001`.

### Message Format

All messages use binary encoding for Yjs protocol messages and JSON for control messages.

```typescript
// Incoming message structure
interface WsMessage {
  event: string;
  data: unknown;
}

// Yjs binary messages use raw Uint8Array (no JSON wrapper)
```

### Room Management

A "room" corresponds to one Yjs document, identified by `docId = "${workspaceId}:${noteId}"`.

#### Join Room

Client sends after connection to start receiving updates for a document.

```typescript
// Client → Server
socket.emit('join', {
  workspaceId: string;
  noteId: string;
});

// Server → Client (success)
socket.emit('joined', {
  docId: string;
  clientCount: number;
  // awareness states of other clients
  awareness: Array<{ clientId: string; state: AwarenessState }>;
});

// Server → Client (error)
socket.emit('error', {
  code: 'UNAUTHORIZED' | 'NOTE_NOT_FOUND' | 'WORKSPACE_ACCESS_DENIED';
  message: string;
});
```

Server validates that the user has `Viewer+` access to the workspace before joining. Read-only users (Viewer role) receive updates but their document mutations are rejected.

#### Leave Room

```typescript
// Client → Server
socket.emit('leave', {
  docId: string;
});
```

Server removes client from room, broadcasts awareness update to remaining clients.

### Yjs Sync Protocol

The server implements the standard y-websocket sync protocol. Message types match the Yjs constants.

```typescript
const messageSync = 0;
const messageAwareness = 1;

// Sync step 1 (server → client on join): server state vector
// Sync step 2 (client → server): client's missing updates
// Update (bidirectional): Yjs update binary

// Step 1: Client requests sync
socket.emit('sync-step1', {
  docId: string;
  stateVector: Uint8Array;  // Y.encodeStateVector(doc)
});

// Server responds with sync-step2
socket.emit('sync-step2', {
  docId: string;
  update: Uint8Array;  // Y.encodeStateAsUpdate(serverDoc, clientStateVector)
});

// Client sends its missing updates back
socket.emit('sync-step2', {
  docId: string;
  update: Uint8Array;
});

// Ongoing updates (both directions)
socket.emit('update', {
  docId: string;
  update: Uint8Array;  // Y.encodeUpdate(...)
});
```

Server flow on receiving `update`:
1. Apply update to server-side `Y.Doc` for the room.
2. Broadcast to all other clients in the room (excluding sender).
3. Enqueue debounced persistence job (500ms window) to BullMQ `sync` queue.

### Awareness Protocol

Awareness carries ephemeral state: cursor position, user info, selection range.

```typescript
interface AwarenessState {
  user: {
    id: string;
    name: string;
    color: string;      // hex color for cursor display
    avatarUrl: string | null;
  };
  cursor: {
    anchor: RelativePosition | null;
    head: RelativePosition | null;
  } | null;
  selection: {
    anchor: RelativePosition;
    head: RelativePosition;
  } | null;
}
```

```typescript
// Client → Server: update awareness
socket.emit('awareness', {
  docId: string;
  update: Uint8Array;  // encodeAwarenessUpdate([clientId], states)
});

// Server → all clients in room (including sender)
socket.emit('awareness', {
  docId: string;
  update: Uint8Array;
});
```

On client disconnect, server broadcasts awareness removal for that client's ID.

### Server-Side Persistence Flow

```
Client sends 'update'
        │
Server applies update to Y.Doc in memory
        │
Server broadcasts to other clients in room
        │
SyncPersistenceService.scheduleDebounced(workspaceId, noteId, doc)
        │
BullMQ job queued with 500ms delay (deduplication key: docId)
        │
Job executes:
  1. doc.getText('content').toString()  → markdown string
  2. FilesService.atomicWrite(path, markdown)
  3. Parse links from markdown
  4. NoteLinksService.extractAndSave(noteId, markdown)
  5. Update notes table: contentHash, wordCount, updatedAt, lastEditedById
  6. SearchIndexService.updateTsVector(noteId, markdown)
  7. If version threshold reached → NoteVersionsService.createVersion(...)
```

Version threshold: create a new version every 50 updates OR 30 minutes of idle, whichever comes first.

### Reconnection Protocol

Clients handle reconnection automatically via `y-websocket` with exponential backoff:
- Initial reconnect: 100ms
- Max reconnect delay: 30s
- Factor: 2

On reconnect, client re-joins all previously joined rooms and performs a full sync-step1 to catch up on missed updates. The server's in-memory `Y.Doc` may have been lost if server restarted — in this case the server loads from filesystem (MD → Yjs conversion) to rebuild the document.

### WebSocket Events Reference

| Event | Direction | Description |
|-------|-----------|-------------|
| `join` | C→S | Join a document room |
| `joined` | S→C | Confirmation with current state |
| `leave` | C→S | Leave a document room |
| `sync-step1` | C→S | Client sends state vector |
| `sync-step2` | S→C | Server sends missing updates |
| `sync-step2` | C→S | Client sends its missing updates |
| `update` | C→S | Client document update |
| `update` | S→C | Broadcast to other clients |
| `awareness` | C→S | Cursor/selection update |
| `awareness` | S→C | Broadcast to room clients |
| `error` | S→C | Protocol error |
| `ping` | C→S | Keepalive |
| `pong` | S→C | Keepalive response |

---

## 4. Database Design Deep Dive

### Index Strategy

All indexes below are in addition to primary keys and the indexes already defined in the Prisma schema.

```sql
-- USERS TABLE
-- Email is unique via Prisma @unique constraint (already indexed)
-- Full-text search on displayName (for admin user search)
CREATE INDEX idx_users_display_name_trgm
  ON users USING GIN (display_name gin_trgm_ops);

-- SESSIONS TABLE
-- Find and prune expired sessions efficiently
CREATE INDEX idx_sessions_expires_at ON sessions (expires_at);
-- Cleanup job: DELETE FROM sessions WHERE expires_at < NOW()

-- WORKSPACES TABLE
-- Slug lookup is via @unique (already indexed)
-- Public slug lookup for public vault routing
-- Already covered by publicSlug @unique

-- WORKSPACE_MEMBERS TABLE
-- Covered by @@unique([workspaceId, userId])
-- Fast role lookup
CREATE INDEX idx_workspace_members_user_id ON workspace_members (user_id);

-- NOTES TABLE (critical — most-read table)
-- Composite index for workspace note listing (most common query)
CREATE INDEX idx_notes_workspace_updated
  ON notes (workspace_id, updated_at DESC)
  WHERE is_trashed = false;

-- Folder-prefix filtering (common: list all notes under "projects/")
CREATE INDEX idx_notes_path_prefix
  ON notes (workspace_id, path text_pattern_ops);

-- Full-text search GIN (already in schema, verify exists)
CREATE INDEX idx_notes_search_vector
  ON notes USING GIN (search_vector);

-- Trigram on title for fuzzy title search + autocomplete
CREATE INDEX idx_notes_title_trgm
  ON notes USING GIN (title gin_trgm_ops);

-- JSONB frontmatter queries (e.g., filter by status in frontmatter)
CREATE INDEX idx_notes_frontmatter_gin
  ON notes USING GIN (frontmatter);

-- Published notes: used by public vault serving
CREATE INDEX idx_notes_published
  ON notes (workspace_id, is_published)
  WHERE is_published = true AND is_trashed = false;

-- Trashed notes index for trash view
CREATE INDEX idx_notes_trashed
  ON notes (workspace_id, trashed_at DESC)
  WHERE is_trashed = true;

-- NOTE_LINKS TABLE
-- Already has @@index([sourceNoteId]) and @@index([targetNoteId])
-- Additional composite for graph queries
CREATE INDEX idx_note_links_composite
  ON note_links (source_note_id, target_note_id, link_type);

-- NOTE_VERSIONS TABLE
-- Already has @@index([noteId])
-- Latest version lookup
CREATE INDEX idx_note_versions_note_version
  ON note_versions (note_id, version DESC);

-- ATTACHMENTS TABLE
-- Already has @@index([noteId])

-- TAGS TABLE
-- Already has @@unique([workspaceId, name])
-- Case-insensitive tag search
CREATE INDEX idx_tags_name_trgm
  ON tags USING GIN (lower(name) gin_trgm_ops);

-- INSTALLED_PLUGINS TABLE
-- Already has @@unique([workspaceId, pluginId])

-- COMMENTS TABLE
-- Already has @@index([noteId])
-- Thread fetching (parent + replies)
CREATE INDEX idx_comments_parent_id ON comments (parent_id) WHERE parent_id IS NOT NULL;
-- Unresolved comments count
CREATE INDEX idx_comments_unresolved
  ON comments (note_id, is_resolved)
  WHERE is_resolved = false;
```

### Full-Text Search Setup

```sql
-- Enable extensions (in migration 0001_extensions.sql)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;  -- accent-insensitive search

-- Custom text search configuration (handles code in notes)
CREATE TEXT SEARCH CONFIGURATION notesaner_fts (COPY = english);
ALTER TEXT SEARCH CONFIGURATION notesaner_fts
  ALTER MAPPING FOR hword, hword_part, word
  WITH unaccent, english_stem;

-- Update tsvector function — called by trigger AND by app after content changes
CREATE OR REPLACE FUNCTION update_note_search_vector()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('notesaner_fts', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('notesaner_fts', coalesce(
      -- Extract text from frontmatter JSONB values
      (SELECT string_agg(value::text, ' ') FROM jsonb_each_text(NEW.frontmatter)), ''
    )), 'B');
    -- Note: full content vector is updated by application via SearchIndexService
    -- because content lives on filesystem, not in the DB column
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger fires on title/frontmatter changes (NOT content — that's app-managed)
CREATE TRIGGER notes_search_vector_trigger
  BEFORE INSERT OR UPDATE OF title, frontmatter
  ON notes
  FOR EACH ROW
  EXECUTE FUNCTION update_note_search_vector();
```

**Content FTS update (application-side):**

Since note content lives on the filesystem, the application is responsible for updating `search_vector` with content after every persist cycle:

```typescript
// SearchIndexService.updateTsVector()
await prisma.$executeRaw`
  UPDATE notes
  SET search_vector =
    setweight(to_tsvector('notesaner_fts', ${title}), 'A') ||
    setweight(to_tsvector('notesaner_fts', ${content}::text), 'C')
  WHERE id = ${noteId}
`;
```

Weights: A = title (highest), B = frontmatter values, C = body content.

**Search query:**

```typescript
// SearchService.search() — combined FTS + trigram
const results = await prisma.$queryRaw<SearchRow[]>`
  WITH fts_results AS (
    SELECT
      id,
      title,
      path,
      word_count,
      updated_at,
      ts_rank_cd(search_vector, query, 32) AS rank,
      ts_headline('notesaner_fts', title, query,
        'MaxWords=10, MinWords=5, ShortWord=2, HighlightAll=false'
      ) AS headline
    FROM notes,
         plainto_tsquery('notesaner_fts', ${sanitizedQuery}) query
    WHERE workspace_id = ${workspaceId}
      AND is_trashed = false
      AND search_vector @@ query
    ORDER BY rank DESC
    LIMIT ${limit * 2}
  ),
  trgm_results AS (
    SELECT id,
           similarity(title, ${sanitizedQuery}) AS sim
    FROM notes
    WHERE workspace_id = ${workspaceId}
      AND is_trashed = false
      AND title % ${sanitizedQuery}  -- trigram threshold 0.3
    LIMIT 20
  )
  SELECT DISTINCT ON (n.id)
    n.id, n.title, n.path, n.updated_at,
    COALESCE(f.rank, 0) + COALESCE(t.sim * 0.3, 0) AS combined_score,
    f.headline
  FROM notes n
  LEFT JOIN fts_results f ON n.id = f.id
  LEFT JOIN trgm_results t ON n.id = t.id
  WHERE (f.id IS NOT NULL OR t.id IS NOT NULL)
    AND n.workspace_id = ${workspaceId}
  ORDER BY n.id, combined_score DESC
  LIMIT ${limit}
  OFFSET ${offset}
`;
```

### pg_trgm Configuration

```sql
-- Set similarity threshold (default 0.3 is good for typos)
-- Can be set per-session or globally
SET pg_trgm.similarity_threshold = 0.3;

-- Word similarity for partial matches (better for autocomplete)
SET pg_trgm.word_similarity_threshold = 0.4;
```

### Query Optimization Notes

1. **Note listing**: Always filter `is_trashed = false` first — the partial index `idx_notes_workspace_updated` makes this nearly free.

2. **Graph query**: The graph endpoint (`GET /graph`) fetches all non-trashed notes and their links. For large workspaces (>10k notes), use a streaming query and cache aggressively.

   ```typescript
   // Efficient graph query — avoid N+1
   const [notes, links] = await Promise.all([
     prisma.note.findMany({
       where: { workspaceId, isTrashed: false },
       select: { id: true, title: true, path: true, tags: { select: { tag: { select: { name: true } } } } },
     }),
     prisma.noteLink.findMany({
       where: { sourceNote: { workspaceId } },
       select: { sourceNoteId: true, targetNoteId: true, linkType: true },
     }),
   ]);
   ```

3. **Backlinks query**: Use indexed lookup on `targetNoteId`, never scan full table.

4. **Tag count**: The `noteCount` field on `Tag` is denormalized. Update it with `INCREMENT` in the same transaction as `NoteTag` insert/delete. Never compute with `COUNT(*)` at query time.

5. **Version creation**: Use `MAX(version) + 1` via a database-level lock (Prisma `$transaction` with `SELECT FOR UPDATE`).

6. **Connection pooling**: Use `pgBouncer` in production (transaction mode). Configure Prisma `connection_limit=10` per server instance.

### Migration Strategy

1. Migrations live in `apps/server/prisma/migrations/`.
2. Naming: `{timestamp}_{description}` (Prisma standard).
3. **Additive first**: Never drop columns in the same migration that adds replacement columns. Two-phase approach:
   - Phase 1: Add new column (nullable), deploy, backfill.
   - Phase 2: Add NOT NULL constraint, remove old column.
4. **Zero-downtime**: All migrations must be backward-compatible with the previous deployed version.
5. Migration runs automatically on startup in development. In production, run `prisma migrate deploy` as a pre-deployment step in the CI/CD pipeline, before replacing the application pods.
6. **Raw SQL extensions**: Place in `migrations/0001_extensions.sql` and execute manually or via custom migration step before Prisma migrations.

### Seed Data

```typescript
// apps/server/prisma/seed.ts
async function seed() {
  // 1. Create default super admin
  const admin = await prisma.user.upsert({
    where: { email: process.env.ADMIN_EMAIL },
    update: {},
    create: {
      email: process.env.ADMIN_EMAIL,
      passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD, 12),
      displayName: 'Administrator',
      isSuperAdmin: true,
    },
  });

  // 2. Create default workspace
  const workspace = await prisma.workspace.upsert({
    where: { slug: 'default' },
    update: {},
    create: {
      name: 'Default Workspace',
      slug: 'default',
      storagePath: path.join(process.env.STORAGE_ROOT, 'default'),
      members: {
        create: { userId: admin.id, role: 'OWNER' },
      },
    },
  });

  // 3. Create filesystem directory
  await fs.mkdir(workspace.storagePath, { recursive: true });

  // 4. Create welcome note
  await prisma.note.upsert({
    where: { workspaceId_path: { workspaceId: workspace.id, path: 'Welcome.md' } },
    update: {},
    create: {
      workspaceId: workspace.id,
      path: 'Welcome.md',
      title: 'Welcome to Notesaner',
      wordCount: 50,
      createdById: admin.id,
      lastEditedById: admin.id,
    },
  });
  // Write the actual file
  await fs.writeFile(
    path.join(workspace.storagePath, 'Welcome.md'),
    '# Welcome to Notesaner\n\nStart writing your notes here.',
  );

  // 5. Enable LOCAL auth provider
  await prisma.authProvider.upsert({
    where: { id: 'local-default' },
    update: {},
    create: {
      id: 'local-default',
      type: 'LOCAL',
      name: 'Email & Password',
      config: {},
      isEnabled: true,
    },
  });
}
```

---

## 5. File System Service

### Directory Structure

```
$STORAGE_ROOT/                          # env: STORAGE_ROOT, default: /data/notesaner
├── workspaces/
│   ├── {workspaceSlug}/                # e.g., default/, acme-corp/
│   │   ├── notes/                      # markdown notes (mirrors virtual folder tree)
│   │   │   ├── Welcome.md
│   │   │   ├── projects/
│   │   │   │   ├── Project Alpha.md
│   │   │   │   └── notes.md
│   │   │   └── daily/
│   │   │       └── 2026-03-25.md
│   │   ├── attachments/               # uploaded files
│   │   │   ├── {noteId}/              # attachments scoped per note
│   │   │   │   ├── image.png
│   │   │   │   └── diagram.excalidraw
│   │   ├── plugins/                   # installed plugin bundles
│   │   │   ├── excalidraw/
│   │   │   │   ├── manifest.json
│   │   │   │   ├── main.js
│   │   │   │   └── styles.css
│   │   └── .notesaner/               # internal metadata (hidden from API)
│   │       └── yjs/                  # Yjs document state snapshots
│   │           └── {noteId}.ydoc
└── avatars/                           # user avatars
    └── {userId}.{ext}
```

### File Naming Conventions

- Note paths: UTF-8, max 255 bytes per component, no null bytes, no path separators in filename.
- Forbidden characters in note filenames: `< > : " / \ | ? *` (Windows-compatible).
- Folder names: same rules apply.
- Attachment filenames: sanitized via `sanitize-filename` library before storage, original name stored in DB.
- Plugin files: stored in workspace-scoped directory, never in note directories.

The `path` field in the `Note` model stores the path **relative to the workspace notes root** (e.g., `projects/Project Alpha.md`).

### Path Traversal Prevention

```typescript
// PathValidationService.validate()
resolveSafePath(workspaceId: string, relativePath: string): string {
  const workspaceRoot = this.getWorkspaceRoot(workspaceId);
  const notesRoot = path.join(workspaceRoot, 'notes');

  // Normalize to remove ../ sequences
  const normalized = path.normalize(relativePath);

  // Must not start with / or contain ..
  if (path.isAbsolute(normalized) || normalized.startsWith('..')) {
    throw new ForbiddenException({ code: 'PATH_TRAVERSAL_ATTEMPT' });
  }

  const resolved = path.resolve(notesRoot, normalized);

  // Final check: resolved path must be inside notesRoot
  if (!resolved.startsWith(notesRoot + path.sep) && resolved !== notesRoot) {
    throw new ForbiddenException({ code: 'PATH_TRAVERSAL_ATTEMPT' });
  }

  return resolved;
}
```

### Concurrent Access Handling

Multiple clients may trigger simultaneous writes to the same file (e.g., offline merge + active editor). The Yjs CRDT layer handles merge conflicts at the document level. At the filesystem level:

1. All writes go through `FilesService.atomicWrite()`.
2. Per-note write lock implemented using `async-mutex` (in-process) for the duration of the write.
3. For multi-instance deployments, a distributed lock via ValKey (`SET NX PX 5000`) wraps filesystem writes.

```typescript
async atomicWrite(absolutePath: string, content: string): Promise<void> {
  const tmpPath = absolutePath + '.tmp.' + Date.now();

  try {
    // Write to temp file first
    await fs.writeFile(tmpPath, content, { encoding: 'utf-8', flag: 'w' });
    await fs.fsync(/* fd */);  // flush to disk

    // Atomic rename (on same filesystem, this is atomic on POSIX)
    await fs.rename(tmpPath, absolutePath);
  } catch (err) {
    // Cleanup temp file
    await fs.unlink(tmpPath).catch(() => {});
    throw err;
  }
}
```

### File Watcher (chokidar)

The `FileWatcherService` detects external changes (admin editing files directly, git pull, etc.) and syncs them back to the database.

```typescript
// FileWatcherService initialization
watchWorkspace(workspaceId: string, storagePath: string): void {
  const notesPath = path.join(storagePath, 'notes');

  const watcher = chokidar.watch(notesPath, {
    ignored: /(^|[\/\\])\../, // ignore hidden files/dirs
    persistent: true,
    ignoreInitial: true,       // don't fire on startup
    awaitWriteFinish: {
      stabilityThreshold: 300, // wait 300ms after last write event
      pollInterval: 50,
    },
    depth: 10,                 // max folder depth
  });

  watcher
    .on('add', (filePath) => this.handleAdd(workspaceId, filePath))
    .on('change', (filePath) => this.handleChange(workspaceId, filePath))
    .on('unlink', (filePath) => this.handleDelete(workspaceId, filePath))
    .on('addDir', (dirPath) => this.handleDirAdd(workspaceId, dirPath))
    .on('unlinkDir', (dirPath) => this.handleDirDelete(workspaceId, dirPath))
    .on('error', (err) => this.logger.error({ err, workspaceId }, 'Watcher error'));

  this.watchers.set(workspaceId, watcher);
}
```

**Change handling:**
- `add` / `change`: Read file, compute SHA-256 hash, compare with DB `contentHash`. If different, update metadata, re-extract links, update search index. Emit `file.changed` event (EventEmitter2).
- `unlink`: Mark note as deleted if exists in DB. Emit `file.deleted`.
- Rename (unlink + add): Detected as pair, updates note path and all backlinks.

**Important**: The watcher must debounce events and skip files being written by the application itself (use an `inProgressWrites` Set to track app-initiated writes).

### Backup Considerations

- The `$STORAGE_ROOT` directory is the single source of truth for note content.
- Recommended: mount as a Docker volume backed by a persistent disk.
- Built-in backup: BullMQ job `workspace-backup` runs nightly, creates a `.tar.gz` of the workspace notes directory, stores it in `$BACKUP_DIR/{workspaceSlug}/{date}.tar.gz`.
- Retention: 7 daily backups, 4 weekly backups (configurable via env).
- Admin can trigger manual backup via `POST /api/admin/workspaces/:id/backup`.

---

## 6. Auth Architecture

### JWT Strategy

Access tokens:
- Algorithm: `HS256` (single server) or `RS256` (multi-instance — recommended for production).
- TTL: 15 minutes.
- Payload: `{ sub: userId, email, isSuperAdmin, jti, iat, exp }`.
- Stored: in memory on client (not localStorage — XSS risk).

Refresh tokens:
- Format: 64-byte cryptographically random hex string.
- TTL: 7 days.
- Storage: `httpOnly; Secure; SameSite=Strict` cookie named `refresh_token`.
- Hashed before DB storage: `SHA-256(refreshToken)` stored in `sessions.refreshToken`.
- Rotation: every refresh issues a new refresh token. Old token is immediately invalidated (detect token reuse attacks).

Token blacklist (for logout before expiry):
- On logout, add JWT `jti` to ValKey with TTL matching remaining token lifetime.
- `JwtStrategy.validate()` checks blacklist on every request.

### SAML Flow (SP-Initiated)

```
1. User clicks "Login with Corporate SSO"
   → GET /api/auth/saml/:providerId/init

2. Server loads SAMLConfig from DB, generates AuthnRequest
   → Redirects to IdP SSO URL with SAMLRequest param

3. User authenticates at IdP (Keycloak / Authentik)

4. IdP redirects to → POST /api/auth/saml/:providerId/callback
   Request body: SAMLResponse (base64-encoded XML)

5. Server validates assertion:
   - Verifies XML signature with IdP certificate
   - Checks Conditions (NotBefore, NotOnOrAfter, Audience)
   - Extracts attributes via attributeMapping config

6. Server upserts user:
   - Find by email from SAML attributes
   - Create if not exists (mark passwordHash as null)
   - Add to workspace if workspaceId is configured for this provider

7. Server issues JWT pair
   → Sets refresh_token cookie
   → Redirects to: /auth/callback?token=<accessToken>

8. Frontend captures token from URL, stores in memory, clears URL param
```

**IdP-Initiated SAML:**
- IdP posts SAMLResponse directly to callback URL without an AuthnRequest.
- `passport-saml` handles this with `passReqToCallback: true` and `validateInResponseTo: false`.
- Security note: IdP-initiated is less secure (no CSRF protection via RelayState). Only enable if required.

**SP Metadata:**
```typescript
// GET /api/auth/saml/:providerId/metadata
// Returns XML like:
`<EntityDescriptor entityID="https://notesaner.example.com">
  <SPSSODescriptor AuthnRequestsSigned="false" WantAssertionsSigned="true">
    <AssertionConsumerService
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="https://notesaner.example.com/api/auth/saml/${providerId}/callback"
      index="1"/>
  </SPSSODescriptor>
</EntityDescriptor>`
```

### OIDC Flow (Authorization Code)

```typescript
// OidcProviderService uses openid-client library

1. GET /api/auth/oidc/:providerId/init
   → Generate state (random), nonce (random)
   → Store state+nonce in ValKey (TTL 10min): key = `oidc:state:${state}`
   → Redirect to: ${issuer}/authorize?
       client_id=...&redirect_uri=...&scope=openid profile email
       &response_type=code&state=...&nonce=...

2. GET /api/auth/oidc/:providerId/callback?code=...&state=...
   → Verify state from ValKey (prevents CSRF)
   → Exchange code for tokens: POST ${issuer}/token
   → Verify ID token: validate signature, iss, aud, exp, nonce
   → Get userinfo: GET ${issuer}/userinfo (or from ID token claims)
   → Upsert user by email
   → Issue JWT pair, set cookie
   → Delete state from ValKey
   → Redirect to /auth/callback?token=<accessToken>
```

### Session Management with ValKey

```typescript
// ValKey key structure for sessions
`session:${sessionId}` → JSON serialized Session metadata
// TTL = refresh token TTL (7 days)
// Used for fast session lookup without DB query

`user:sessions:${userId}` → Set of active sessionIds
// Used for "logout all devices" and listing sessions

`oidc:state:${state}` → JSON { nonce, providerId }
// TTL = 10 minutes

`jwt:blacklist:${jti}` → "1"
// TTL = remaining JWT lifetime in seconds
```

Sessions are stored in both PostgreSQL (for persistence across server restarts) and ValKey (for fast lookup). On startup, the server does NOT pre-warm ValKey — sessions are loaded from DB on first access and cached.

### RBAC Middleware Implementation

```typescript
// WorkspaceGuard — runs on all /api/workspaces/:workspaceId/* routes
@Injectable()
class WorkspaceGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { workspaceId } = request.params;
    const user = request.user as JwtPayload;

    // Cache membership in ValKey: `ws:member:${workspaceId}:${userId}`
    const cached = await this.valkey.get(`ws:member:${workspaceId}:${userId}`);
    const membership = cached
      ? JSON.parse(cached)
      : await this.workspacesService.getUserRole(workspaceId, user.sub);

    if (!membership) {
      throw new ForbiddenException({ code: 'WORKSPACE_ACCESS_DENIED' });
    }

    // Cache for 5 minutes
    if (!cached) {
      await this.valkey.setex(`ws:member:${workspaceId}:${userId}`, 300, JSON.stringify(membership));
    }

    // Attach to request for downstream use
    request.workspaceMembership = membership;
    return true;
  }
}

// RolesGuard — checks specific role requirements
@Injectable()
class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<WorkspaceRole[]>('roles', context.getHandler());
    if (!requiredRoles) return true;

    const { workspaceMembership } = context.switchToHttp().getRequest();
    return hasRole(workspaceMembership.role, requiredRoles);
  }
}

// Role hierarchy: OWNER > ADMIN > EDITOR > VIEWER
function hasRole(userRole: WorkspaceRole, requiredRoles: WorkspaceRole[]): boolean {
  const hierarchy = { OWNER: 4, ADMIN: 3, EDITOR: 2, VIEWER: 1 };
  const userLevel = hierarchy[userRole] ?? 0;
  return requiredRoles.some(r => userLevel >= hierarchy[r]);
}
```

### Multi-Tenant Isolation

- Every database query involving workspace-owned data **must** include `workspaceId` in the WHERE clause.
- NestJS middleware (`TenantIsolationMiddleware`) validates that `workspaceId` in the URL matches the user's membership before any controller logic runs.
- Never use `prisma.note.findUnique({ where: { id } })` without also checking `workspaceId`. Always use `prisma.note.findFirst({ where: { id, workspaceId } })` or verify after fetch.
- Filesystem paths are scoped to `getWorkspaceRoot(workspaceId)` — cross-workspace access is impossible by construction.

---

## 7. Plugin Backend

### Plugin Registry Data Model

The plugin registry is a **server-side cache** of GitHub repository metadata — not stored in PostgreSQL. It lives in ValKey with a 6-hour TTL and is refreshed by a BullMQ job.

```typescript
// ValKey key structure
`plugins:registry:catalog` → JSON serialized PluginRegistryEntry[] (all known plugins)
`plugins:registry:search:${hash(params)}` → JSON search results (TTL: 5min)
`plugins:manifest:${owner}/${repo}:${version}` → JSON PluginManifest (TTL: 1hr)
```

### GitHub API Integration

```typescript
// PluginRegistryService uses Octokit

interface IGitHubSearchOptions {
  topic: 'notesaner-plugin';
  sort: 'stars' | 'updated';
  perPage: 100;
}

// Search repos by topic
// GET https://api.github.com/search/repositories?q=topic:notesaner-plugin&sort=stars
// GitHub token required (avoid rate limiting): GITHUB_TOKEN env var

async refreshCache(): Promise<void> {
  const repos = await this.octokit.paginate(
    this.octokit.rest.search.repos,
    { q: 'topic:notesaner-plugin', sort: 'stars', per_page: 100 }
  );

  const entries: PluginRegistryEntry[] = await Promise.allSettled(
    repos.items.map(repo => this.fetchManifestAndBuildEntry(repo))
  ).then(results => results
    .filter(r => r.status === 'fulfilled')
    .map(r => (r as PromiseFulfilledResult<PluginRegistryEntry>).value)
  );

  await this.valkey.set(
    'plugins:registry:catalog',
    JSON.stringify(entries),
    'EX', 6 * 60 * 60  // 6 hours
  );
}

async fetchManifestAndBuildEntry(repo: GitHubRepo): Promise<PluginRegistryEntry> {
  // Fetch manifest.json from default branch
  const manifest = await this.getManifest(repo.full_name, 'latest');

  return {
    id: manifest.id,
    name: manifest.name,
    description: manifest.description,
    author: manifest.author,
    repository: repo.html_url,
    tags: manifest.tags,
    latestVersion: manifest.version,
    downloads: repo.stargazers_count,   // use stars as proxy for downloads
    rating: 0,                           // future: implement ratings
  };
}
```

GitHub rate limits: 30 requests/minute for search (authenticated). The BullMQ job uses exponential backoff on rate limit errors (`HTTP 403` with `X-RateLimit-Remaining: 0`).

### Plugin File Download and Storage

```typescript
// PluginDownloadService
async downloadRelease(repository: string, version: string, workspaceId: string): Promise<string> {
  const [owner, repo] = this.parseRepo(repository);  // github.com/owner/repo

  // Get release info
  const release = version === 'latest'
    ? await this.octokit.rest.repos.getLatestRelease({ owner, repo })
    : await this.octokit.rest.repos.getReleaseByTag({ owner, repo, tag: version });

  // Find the plugin tarball in release assets
  const asset = release.data.assets.find(a => a.name === 'plugin.tar.gz');
  if (!asset) throw new PluginInstallException('NO_RELEASE_ASSET');

  // Download to temp directory
  const tmpDir = path.join(os.tmpdir(), `plugin-${crypto.randomUUID()}`);
  await fs.mkdir(tmpDir, { recursive: true });

  try {
    const response = await this.octokit.request(`GET ${asset.url}`, {
      headers: { Accept: 'application/octet-stream' }
    });

    // Extract tarball
    await tar.extract({ cwd: tmpDir, file: Buffer.from(response.data) });

    // Validate manifest
    const manifestPath = path.join(tmpDir, 'manifest.json');
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
    const validatedManifest = this.validator.validate(manifest);

    // Move to workspace plugins directory
    const targetDir = path.join(
      this.filesService.getWorkspaceRoot(workspaceId),
      'plugins',
      validatedManifest.id
    );
    await fs.mkdir(targetDir, { recursive: true });
    await fs.cp(tmpDir, targetDir, { recursive: true });

    return targetDir;
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}
```

The plugin install flow is async (BullMQ job) to avoid HTTP timeout on slow connections:

```typescript
// POST /api/workspaces/:workspaceId/plugins/install
// Returns 202 with jobId immediately

// PluginInstallProcessor @Process('install-plugin')
async handleInstall(job: Job<InstallPluginJob>): Promise<void> {
  const { workspaceId, repository, version, installedById } = job.data;

  // 1. Fetch and validate manifest
  const manifest = await this.registryService.getManifest(repository, version);

  // 2. Download and extract
  const targetDir = await this.downloadService.downloadRelease(repository, manifest.version, workspaceId);

  // 3. Verify file integrity (check that main.js exists)
  const mainPath = path.join(targetDir, manifest.main);
  await fs.access(mainPath);  // throws if not exists

  // 4. Register in DB
  await this.prisma.installedPlugin.upsert({
    where: { workspaceId_pluginId: { workspaceId, pluginId: manifest.id } },
    create: {
      workspaceId,
      pluginId: manifest.id,
      name: manifest.name,
      version: manifest.version,
      repository,
      manifest,
      isEnabled: true,
    },
    update: {
      version: manifest.version,
      manifest,
      updatedAt: new Date(),
    },
  });

  // 5. Update job status (accessible via GET /plugins/install/:jobId)
  await job.updateProgress(100);
}
```

### Plugin Manifest Validation

```typescript
// PluginManifestValidator uses Zod
const PluginManifestSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/).min(2).max(50),
  name: z.string().min(1).max(100),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  description: z.string().max(500),
  author: z.string().max(100),
  repository: z.string().url().startsWith('https://github.com/'),
  tags: z.array(z.string()).min(1),   // must include "notesaner-plugin"
  minAppVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  main: z.string().endsWith('.js').max(100),
  styles: z.string().endsWith('.css').max(100).optional(),
  settings: z.string().endsWith('.json').max(100).optional(),
  permissions: z.array(z.enum([
    'editor:insert-block', 'editor:modify-content', 'editor:register-extension',
    'ui:register-view', 'ui:register-sidebar', 'ui:register-command',
    'ui:show-modal', 'ui:show-notice',
    'storage:local', 'storage:notes-read', 'storage:notes-write',
    'network:fetch',
  ])),
  entryPoints: z.object({
    editorExtension: z.string().optional(),
    sidebarPanel: z.string().optional(),
    settingsPage: z.string().optional(),
    commands: z.string().optional(),
    statusBar: z.string().optional(),
    view: z.string().optional(),
  }).optional(),
});

validate(manifest: unknown): PluginManifest {
  const result = PluginManifestSchema.safeParse(manifest);
  if (!result.success) {
    throw new PluginInstallException('INVALID_MANIFEST', result.error.format());
  }
  if (!result.data.tags.includes('notesaner-plugin')) {
    throw new PluginInstallException('MISSING_REQUIRED_TAG');
  }
  return result.data as PluginManifest;
}
```

### Plugin Settings Storage

Plugin settings are stored in the `InstalledPlugin.settings` JSONB column in PostgreSQL. The settings schema (from `settings.schema.json` in the plugin bundle) is stored in `InstalledPlugin.manifest.settingsSchema`.

```typescript
// PATCH /api/workspaces/:workspaceId/plugins/:pluginId/settings
async updateSettings(workspaceId: string, pluginId: string, settings: Record<string, unknown>) {
  const plugin = await this.prisma.installedPlugin.findUniqueOrThrow({
    where: { workspaceId_pluginId: { workspaceId, pluginId } },
  });

  // Validate settings against schema from manifest
  const schema = plugin.manifest?.settingsSchema;
  if (schema) {
    this.validateSettingsAgainstSchema(settings, schema);
  }

  return this.prisma.installedPlugin.update({
    where: { workspaceId_pluginId: { workspaceId, pluginId } },
    data: { settings, updatedAt: new Date() },
  });
}
```

---

## 8. Caching Strategy

### ValKey Key Structure

Use colon-delimited namespacing. All keys include a version prefix for easy cache busting during deployments.

```typescript
// Convention: v{version}:{domain}:{entity}:{id}:{attribute}
const CACHE_KEYS = {
  // Auth
  session: (sessionId: string) => `v1:session:${sessionId}`,
  jwtBlacklist: (jti: string) => `v1:jwt:bl:${jti}`,
  oidcState: (state: string) => `v1:oidc:state:${state}`,

  // Workspace
  workspaceMembership: (workspaceId: string, userId: string) =>
    `v1:ws:member:${workspaceId}:${userId}`,
  workspaceBySlug: (slug: string) => `v1:ws:slug:${slug}`,

  // Notes
  noteById: (noteId: string) => `v1:note:${noteId}`,
  graphData: (workspaceId: string) => `v1:graph:${workspaceId}`,

  // Search
  searchResults: (workspaceId: string, paramsHash: string) =>
    `v1:search:${workspaceId}:${paramsHash}`,

  // Public vault
  publicNote: (slug: string, notePath: string) =>
    `v1:pub:${slug}:note:${notePath}`,
  publicNav: (slug: string) => `v1:pub:${slug}:nav`,
  publicGraphData: (slug: string) => `v1:pub:${slug}:graph`,

  // Plugins
  pluginRegistry: () => `v1:plugins:registry`,
  pluginSearch: (paramsHash: string) => `v1:plugins:search:${paramsHash}`,
  pluginManifest: (repo: string, version: string) => `v1:plugin:manifest:${repo}:${version}`,
};
```

### Cache Invalidation Rules

| Event | Keys to Invalidate |
|-------|--------------------|
| Note created/deleted | `graphData:{workspaceId}`, `search:{workspaceId}:*` (pattern delete) |
| Note link changed | `graphData:{workspaceId}` |
| Note published/unpublished | `publicNav:{slug}`, `publicNote:{slug}:{path}`, `publicGraphData:{slug}` |
| Workspace member role changed | `workspaceMembership:{workspaceId}:{userId}` |
| Workspace settings changed | `workspaceBySlug:{slug}` |
| Plugin installed/uninstalled | `pluginRegistry` (full refresh on next request) |

Pattern delete for search cache:

```typescript
// ValKey SCAN + DELETE for pattern: `v1:search:{workspaceId}:*`
async invalidateSearchCache(workspaceId: string): Promise<void> {
  const pattern = `v1:search:${workspaceId}:*`;
  let cursor = '0';
  do {
    const [nextCursor, keys] = await this.valkey.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    if (keys.length > 0) {
      await this.valkey.del(...keys);
    }
    cursor = nextCursor;
  } while (cursor !== '0');
}
```

### Cache TTLs

| Key | TTL |
|-----|-----|
| Session | 7 days |
| JWT blacklist | Remaining token lifetime |
| OIDC state | 10 minutes |
| Workspace membership | 5 minutes |
| Note metadata | 60 seconds |
| Graph data | 60 seconds |
| Search results | 30 seconds |
| Public note | 5 minutes |
| Public navigation | 5 minutes |
| Plugin registry | 6 hours |
| Plugin search | 5 minutes |
| Plugin manifest | 1 hour |

### BullMQ Job Queues

#### Queue: `notes`

```typescript
interface PersistNoteJob {
  workspaceId: string;
  noteId: string;
  userId: string;        // last editor
  docStateVector: Buffer; // Y.Doc state for conflict detection
}
```

Config:
- Concurrency: 10 workers
- Retry: 3 attempts with exponential backoff (1s, 5s, 25s)
- removeOnComplete: 50 (keep last 50 completed)
- removeOnFail: 200

#### Queue: `sync`

```typescript
interface SyncPersistJob {
  workspaceId: string;
  noteId: string;
}
```

Deduplication: Use `jobId: ${workspaceId}:${noteId}` to deduplicate — BullMQ will update existing pending job instead of creating duplicate.
Delay: 500ms (debounce window).

#### Queue: `files`

```typescript
interface IndexFileJob {
  workspaceId: string;
  noteId: string;
  action: 'index' | 'delete';
}

interface BackupWorkspaceJob {
  workspaceId: string;
  type: 'scheduled' | 'manual';
}
```

Config: Concurrency 5. Backup jobs: concurrency 1.

#### Queue: `plugins`

```typescript
interface InstallPluginJob {
  workspaceId: string;
  repository: string;
  version: string | 'latest';
  installedById: string;
}

interface RefreshPluginRegistryJob {
  // no payload — fetches all plugins from GitHub
}
```

Plugin registry refresh: scheduled cron via BullMQ `repeat` option, every 6 hours.

#### Queue: `email`

```typescript
interface SendEmailJob {
  to: string;
  template: 'email-verification' | 'password-reset' | 'workspace-invite';
  context: Record<string, string>;
}
```

Retry: 5 attempts. SMTP configured via `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS` env vars.

#### Queue: `cleanup`

Scheduled jobs:
- `session-cleanup`: runs hourly, deletes expired sessions from DB.
- `trash-cleanup`: runs daily, permanently deletes notes trashed >30 days ago.
- `version-cleanup`: runs weekly, prunes `NoteVersion` rows beyond the configured max (default: 100 per note).

---

## 9. Security

### Input Validation

Every request DTO is decorated with `class-validator` decorators. The global `ValidationPipe` with `whitelist: true` ensures undeclared properties are stripped before reaching controllers.

For search queries and user-provided strings used in raw SQL:
```typescript
// Sanitize before raw SQL
function sanitizeSearchQuery(query: string): string {
  // Remove characters that break tsquery syntax
  return query
    .replace(/[&|!():*]/g, ' ')  // remove tsquery operators
    .trim()
    .slice(0, 500);              // max length
}
```

Never interpolate user input directly into raw SQL. Use Prisma's tagged template literals (`prisma.$queryRaw`) which parameterize values automatically.

### Path Traversal Prevention

Implemented in `PathValidationService.resolveSafePath()` — see Section 5. Applied as a guard on every filesystem operation. Additionally, the Multer file upload middleware uses `disableMulter: true` (manual handling) to prevent automatic disk writes before validation.

### CORS Configuration

```typescript
app.enableCors({
  origin: (origin, callback) => {
    const allowed = process.env.ALLOWED_ORIGINS?.split(',') ?? [];
    if (!origin || allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  maxAge: 86400,  // preflight cache 24h
});
```

### CSP Headers

Applied via `helmet`. The plugin sandbox requires specific CSP rules:

```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],  // needed for TailwindCSS
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      connectSrc: ["'self'", 'wss:'],           // WebSocket
      frameSrc: ["'self'"],                      // for plugin iframes
      frameAncestors: ["'none'"],                // prevent embedding in other pages
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,  // required for SharedArrayBuffer in some plugins
}));
```

Public vault pages served by Next.js handle their own CSP. The NestJS backend sets CSP only for API routes.

### Rate Limiting Tiers

Using `@nestjs/throttler` with ValKey storage backend (`ThrottlerStorageRedisService`):

```typescript
// Global throttler config
ThrottlerModule.forRootAsync({
  imports: [ConfigModule, ValKeyModule],
  useFactory: (config: ConfigService) => ({
    storage: new ThrottlerStorageRedisService(valkey),
    throttlers: [
      { name: 'default', limit: 100, ttl: 60000 },  // 100 req/min default
    ],
  }),
}),
```

Per-endpoint overrides via `@Throttle()` decorator:

| Endpoint | Limit | Window |
|----------|-------|--------|
| POST /auth/login | 10 | 1 min |
| POST /auth/register | 5 | 1 min |
| POST /auth/refresh | 30 | 1 min |
| GET /plugins/search | 30 | 1 min |
| GET /notes/search | 60 | 1 min |
| POST /notes | 60 | 1 min |
| PATCH /notes/:id | 120 | 1 min |
| POST /files/attachments | 20 | 1 min |
| POST /plugins/install | 10 | 1 min |
| Default (all other routes) | 100 | 1 min |

Rate limit responses include headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

### Audit Logging

All write operations are logged with structured JSON via `nestjs-pino`:

```typescript
// AuditInterceptor — applied globally
@Injectable()
class AuditInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const { method, url, user, ip, headers } = request;

    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
      this.logger.info({
        audit: true,
        userId: user?.sub,
        method,
        url,
        ip: ip ?? headers['x-forwarded-for'],
        userAgent: headers['user-agent'],
        requestId: headers['x-request-id'],
      });
    }

    return next.handle();
  }
}
```

Security-critical events also logged:
- Failed login attempts (with IP)
- Token refresh failures
- Path traversal attempts (with full path attempted)
- Permission denials
- Plugin installation/uninstallation

---

## 10. Error Handling

### Error Code Catalog

All errors follow this structure:

```typescript
interface ApiError {
  code: string;      // machine-readable code
  message: string;   // human-readable description
  details?: unknown; // optional additional context
  requestId: string; // for correlation with logs
}
```

#### Auth Errors (4xx)

| Code | HTTP | Description |
|------|------|-------------|
| `INVALID_CREDENTIALS` | 401 | Wrong email or password |
| `TOTP_REQUIRED` | 401 | TOTP code required but not provided |
| `TOTP_INVALID` | 401 | TOTP code is incorrect |
| `TOKEN_EXPIRED` | 401 | JWT access token has expired |
| `TOKEN_INVALID` | 401 | JWT signature invalid or malformed |
| `TOKEN_BLACKLISTED` | 401 | Token has been revoked |
| `REFRESH_TOKEN_INVALID` | 401 | Refresh token not found |
| `REFRESH_TOKEN_EXPIRED` | 401 | Refresh token has expired |
| `REGISTRATION_DISABLED` | 403 | Self-registration is disabled |
| `WORKSPACE_ACCESS_DENIED` | 403 | User is not a member of this workspace |
| `INSUFFICIENT_ROLE` | 403 | User's role is below required level |
| `PATH_TRAVERSAL_ATTEMPT` | 403 | Attempted directory traversal |

#### Resource Errors (4xx)

| Code | HTTP | Description |
|------|------|-------------|
| `USER_NOT_FOUND` | 404 | User does not exist |
| `WORKSPACE_NOT_FOUND` | 404 | Workspace does not exist |
| `NOTE_NOT_FOUND` | 404 | Note does not exist |
| `NOTE_PATH_EXISTS` | 409 | Note at this path already exists |
| `SLUG_TAKEN` | 409 | Workspace slug is already in use |
| `PLUGIN_NOT_FOUND` | 404 | Plugin not installed |
| `PLUGIN_ALREADY_INSTALLED` | 409 | Plugin already exists in workspace |
| `PLUGIN_INSTALL_FAILED` | 422 | Plugin installation error (check details) |
| `INVALID_MANIFEST` | 422 | Plugin manifest validation failed |
| `MISSING_REQUIRED_TAG` | 422 | Plugin does not have notesaner-plugin tag |
| `INVALID_PATH` | 400 | Note path contains invalid characters |
| `ATTACHMENT_TOO_LARGE` | 413 | File exceeds size limit |
| `ATTACHMENT_TYPE_NOT_ALLOWED` | 415 | MIME type not permitted |
| `VERSION_NOT_FOUND` | 404 | Note version does not exist |
| `MEMBER_NOT_FOUND` | 404 | User is not a member of workspace |
| `CANNOT_REMOVE_OWNER` | 422 | Cannot remove workspace owner |

#### System Errors (5xx)

| Code | HTTP | Description |
|------|------|-------------|
| `DATABASE_ERROR` | 500 | Unexpected database failure |
| `FILESYSTEM_ERROR` | 500 | File read/write failed |
| `GITHUB_API_ERROR` | 502 | GitHub API request failed |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `SERVICE_UNAVAILABLE` | 503 | Dependency (DB/ValKey) is down |

### Exception Filter Hierarchy

```typescript
// GlobalExceptionFilter catches everything not handled by more specific filters
@Catch()
class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = 500;
    let code = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'object') {
        ({ code, message, details } = body as ApiError);
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Handle known Prisma errors
      if (exception.code === 'P2025') {
        status = 404;
        code = 'RESOURCE_NOT_FOUND';
        message = 'Resource not found';
      } else if (exception.code === 'P2002') {
        status = 409;
        code = 'UNIQUE_CONSTRAINT_VIOLATION';
        message = 'Resource already exists';
      } else {
        this.logger.error({ exception }, 'Prisma error');
        code = 'DATABASE_ERROR';
      }
    } else if (exception instanceof ZodError) {
      status = 422;
      code = 'VALIDATION_ERROR';
      message = 'Validation failed';
      details = exception.format();
    } else {
      // Unknown error — log and return generic response
      this.logger.error({ exception }, 'Unhandled exception');
    }

    response.status(status).json({
      code,
      message,
      details,
      requestId: request.headers['x-request-id'] ?? crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    });
  }
}
```

### Custom Exception Classes

```typescript
// apps/server/src/common/exceptions/

class AppException extends HttpException {
  constructor(code: string, message: string, status: number, details?: unknown) {
    super({ code, message, details }, status);
  }
}

class NotFoundException extends AppException {
  constructor(code: string, message: string) {
    super(code, message, 404);
  }
}

class ConflictException extends AppException {
  constructor(code: string, message: string) {
    super(code, message, 409);
  }
}

class ForbiddenException extends AppException {
  constructor(code: string | { code: string }, message?: string) {
    if (typeof code === 'object') {
      super(code.code, message ?? 'Access denied', 403);
    } else {
      super(code, message ?? 'Access denied', 403);
    }
  }
}

class PluginInstallException extends AppException {
  constructor(code: string, details?: unknown) {
    super(code, 'Plugin installation failed', 422, details);
  }
}
```

### Error Response Format

All error responses follow this format:

```json
{
  "code": "NOTE_NOT_FOUND",
  "message": "Note with id 'abc-123' was not found",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-03-25T10:30:00.000Z"
}
```

Validation errors include details:

```json
{
  "code": "VALIDATION_FAILED",
  "message": "Request validation failed",
  "details": {
    "email": { "_errors": ["Invalid email address"] },
    "password": { "_errors": ["Password must be at least 8 characters"] }
  },
  "requestId": "...",
  "timestamp": "..."
}
```

### Logging Levels and Structure

Using `nestjs-pino` with structured JSON output.

```typescript
// Log levels by scenario
logger.trace(...)  // internal loops, very high frequency events
logger.debug(...)  // cache hits/misses, query parameters
logger.info(...)   // successful operations, request lifecycle
logger.warn(...)   // recoverable errors, retry attempts, validation failures
logger.error(...)  // failures that affect correctness
logger.fatal(...)  // conditions requiring immediate intervention

// Standard log fields (always present)
{
  "level": "info",
  "time": 1711361400000,
  "pid": 1234,
  "hostname": "server-pod-abc",
  "requestId": "550e8400-...",  // from X-Request-ID header or generated
  "userId": "...",               // from JWT if authenticated
  "workspaceId": "...",          // when relevant
  "msg": "Note created",
  // Domain-specific fields appended:
  "noteId": "...",
  "duration": 45               // ms
}
```

Error logs include full stack traces in development, only message in production.

---

## 11. Open-Source Code to Leverage

### Yjs Server Implementation

**Primary reference: `y-websocket` server**
- Package: `y-websocket` (npm) — use the server component from `y-websocket/bin/server.js`
- Repository: https://github.com/yjs/y-websocket
- What to copy: The WebSocket message handler loop in `utils.js` — specifically `messageListener`, `closeConn`, `setupWSConnection`. This implements the full Yjs sync protocol.
- Adaptation needed: Wrap in NestJS `@WebSocketGateway`, add JWT authentication, plug in custom persistence callbacks (replace the in-memory store with filesystem + PostgreSQL).

**Hocuspocus** (more production-ready Yjs server):
- Repository: https://github.com/ueberdosis/hocuspocus
- Package: `@hocuspocus/server`
- Highly recommended as an alternative to raw y-websocket. Has built-in authentication hooks, persistence callbacks, awareness, and extensions.
- Adaptation: Use `Hocuspocus` as a standalone server within the NestJS app. Wire the `onAuthenticate` hook to the NestJS `JwtService`. Wire `onLoadDocument` and `onStoreDocument` to the `SyncPersistenceService`.
- Example extension for persistence:
  ```typescript
  class PostgresPersistence extends Extension {
    async onLoadDocument({ document, documentName }) {
      const [workspaceId, noteId] = documentName.split(':');
      const content = await filesService.readFile(workspaceId, noteId);
      // Convert MD → Yjs
      const ydoc = markdownToYjs(content);
      Y.applyUpdate(document, Y.encodeStateAsUpdate(ydoc));
    }
    async onStoreDocument({ document, documentName }) {
      // Debounced — handled by BullMQ
    }
  }
  ```

### SAML NestJS Examples

**`@node-saml/passport-saml`** (the actively maintained fork of `passport-saml`):
- Repository: https://github.com/node-saml/passport-saml
- NestJS integration pattern: https://github.com/node-saml/passport-saml/tree/master/docs
- Key files to study: `Strategy.ts` and the `verify` callback pattern. The `passport-saml` `Strategy` takes `SAMLOptions` and a verify callback — wire it to `SamlProviderService.validateAssertion()`.

**NestJS Passport official docs** provide the `PassportStrategy` base class wrapping pattern:
```typescript
// SamlStrategy
@Injectable()
export class SamlStrategy extends PassportStrategy(Strategy, 'saml') {
  constructor(private readonly samlService: SamlProviderService) {
    super(samlService.getDefaultConfig(), samlService.verify.bind(samlService));
  }
}
```

For multi-provider SAML (selecting config at runtime), implement the `authorizationParams()` method override and load config from DB in the guard, not the strategy constructor.

### OIDC NestJS Examples

**`openid-client`** (already in tech stack):
- Repository: https://github.com/panva/node-openid-client
- The `generators` module provides PKCE, state, and nonce generation.
- Key pattern: `Issuer.discover(issuerUrl)` → `new client.Client({...})` → `client.authorizationUrl(...)` → `client.callbackParams(req)` → `client.callback(...)`.
- No Passport strategy needed — call openid-client directly in `OidcProviderService`. This gives more control over multi-provider support.

### TipTap Collaboration Server

**TipTap official collaboration server examples**:
- Repository: https://github.com/ueberdosis/tiptap-demos (private, but Hocuspocus docs are comprehensive)
- Hocuspocus docs: https://tiptap.dev/hocuspocus/introduction
- The markdown serialization from Yjs `XmlFragment` to string is the critical piece. Use `@tiptap/pm` together with the TipTap `generateHTML` / `generateText` utilities server-side.

**y-prosemirror** for server-side Yjs ↔ ProseMirror document conversion:
- Repository: https://github.com/yjs/y-prosemirror
- Key export: `prosemirrorJSONToYDoc` and `yDocToProsemirrorJSON` — use these for Yjs ↔ Markdown conversion pipeline (Yjs → ProseMirror JSON → unified/remark → Markdown string).

### Similar Note App Backends

**Outline** (open-source Notion alternative):
- Repository: https://github.com/outline/outline
- Study: `server/models/`, `server/routes/api/`, queue processing in `server/queues/`.
- Particularly relevant: their document serialization approach and real-time collaboration hooks.
- License: BSL 1.1 — cannot copy directly, but read for patterns.

**SilverBullet** (self-hosted, markdown-first):
- Repository: https://github.com/silverbulletmd/silverbullet
- Study: their file system abstraction layer (`plugs/index/`) and sync approach.
- License: MIT — code can be adapted.

**Notesnook Server**:
- Repository: https://github.com/streetwriters/notesnook
- Relevant: their self-hosting Docker setup and auth provider integration patterns.
- License: GPL-3.0

**AFFiNE Server**:
- Repository: https://github.com/toeverything/AFFiNE (particularly `packages/backend/server/`)
- Extremely relevant: they use Yjs + NestJS + PostgreSQL — nearly identical stack.
- Study their `DocManager`, sync WebSocket gateway, and blob storage service.
- License: MIT — code can be adapted.
- Key file to study: `packages/backend/server/src/modules/sync/` — their Yjs WebSocket gateway implementation.

**Memos** (lightweight note-taking server):
- Repository: https://github.com/usememos/memos
- Written in Go, but the API design patterns for note management are clean and worth referencing.

### Auth Libraries

**`otplib`** for TOTP 2FA:
- Repository: https://github.com/yeojz/otplib
- Implements TOTP (RFC 6238), HOTP, and QR code generation.
- Usage: `totp.generate(secret)` and `totp.check(token, secret)`.

**`speakeasy`** (alternative TOTP library):
- More battle-tested, widely used.
- Usage: `speakeasy.totp.verify({ secret, encoding: 'base32', token })`.

### Utility Libraries

**`sanitize-filename`**: Clean user-provided filenames before filesystem storage.

**`@node-rs/argon2`** or **`bcryptjs`**: Password hashing. Use argon2id for new installations, bcrypt for compatibility.

**`async-mutex`**: In-process mutex for filesystem writes.

**`tar`**: Node.js tar library for extracting plugin release tarballs.

**`p-queue`** (Sindre Sorhus): Concurrent queue with rate limiting — use for GitHub API calls in plugin registry refresh to respect rate limits.

---

## Implementation Priority Order

Wave 1 — Core Foundation (implement first):
1. `PrismaModule` + database migrations + extensions
2. `AuthModule` — local auth, JWT strategy, session management
3. `UsersModule` — basic CRUD
4. `FilesModule` — filesystem abstraction, path validation
5. `WorkspacesModule` — workspace CRUD, RBAC guards
6. `HealthModule` — readiness + liveness probes

Wave 2 — Note Operations:
7. `NotesModule` — CRUD, versioning, trash
8. `SearchModule` — FTS + fuzzy
9. `SyncModule` — Yjs WebSocket gateway, persistence
10. `FileWatcherService` — chokidar integration

Wave 3 — Advanced Features:
11. `PluginsModule` — registry, install, settings
12. `PublishingModule` — public vault
13. SAML + OIDC strategies in `AuthModule`
14. Comments, tags, backlinks
15. BullMQ cleanup jobs, backup

---

*End of Backend Architecture Specification*
