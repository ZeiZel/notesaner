# Open-Source Audit — Notesaner Accelerator Report

**Date**: 2026-03-25
**Scope**: Comprehensive audit of open-source projects, libraries, and reference implementations that can be copied, adapted, or used as architectural blueprints to accelerate Notesaner development.
**Audience**: Developer agents assigned to build Notesaner modules.

---

## How to Read This Document

Each entry follows this structure:

- **Repository**: Canonical GitHub URL
- **License**: SPDX identifier and AGPL-3.0 compatibility verdict
- **What to Copy**: Specific files, modules, or patterns — not vague descriptions
- **How to Adapt**: Concrete changes needed for the Notesaner stack
- **Time Saved**: Conservative estimate vs. building from scratch
- **Risk**: Legal or technical concerns to flag before copying

---

## 1. Note-Taking App Backends

### 1.1 Docmost

**Repository**: https://github.com/docmost/docmost

**License**: AGPL-3.0 (core). Enterprise Edition under proprietary license.
AGPL-3.0 is directly compatible with Notesaner's intended license — copy freely from the core.

**Architecture Summary**:
Monorepo using pnpm workspaces + NX. Three top-level areas: `apps/client` (React + Vite + Mantine), `apps/server` (NestJS), `packages/editor-ext` (TipTap extensions). Backend uses the Kysely query builder (not Prisma) over PostgreSQL. Redis for sessions. Docker Compose for deployment.

**What to Copy**:

- `apps/server/src/auth/` — The entire authentication module. Docmost handles email/password, invitations, and permission guards. The Guard, Strategy, and Decorator pattern directly maps to NestJS conventions Notesaner will use.
- `apps/server/src/database/migrations/` — Migration patterns and schema shape for pages, spaces, users, permissions. Adapt field names but copy the relational model for page trees and workspaces.
- `apps/server/src/collaboration/` — WebSocket gateway and Yjs document handling. This is the most valuable module; it shows how to wire a NestJS WebSocket gateway to Hocuspocus or a raw y-websocket handler without spinning up a separate process.
- `apps/server/src/search/` — Full-text search integration. Copy the interface pattern; swap the underlying provider for PostgreSQL `tsvector` or Meilisearch.
- `packages/editor-ext/` — Custom TipTap extensions. These are directly reusable: page link extension, mention extension, callout blocks.
- `apps/client/src/features/page/` — Page editor component composition. Shows how to wire TipTap + Yjs awareness (cursor colors, user names) into a React component tree.
- `apps/client/src/features/space/` — Sidebar tree view with drag-and-drop ordering. Copy the recursive tree data model and the optimistic update pattern.

**How to Adapt**:
- Replace Kysely with Prisma. Map Docmost's raw SQL migration files to a Prisma schema; run `prisma migrate dev` to regenerate.
- Replace Mantine UI components with shadcn/ui equivalents. The component structure is the same; swap imports.
- Add SAML/OIDC support on top of the auth module (Docmost only ships email+password in core).
- Add ValKey (Redis-compatible) as the pub/sub layer in the collaboration gateway.

**Time Saved**: 6–9 weeks. The auth, page tree, collaboration wiring, and editor extension patterns alone represent a significant portion of the core backend.

**Risk**: AGPL-3.0 requires that Notesaner's source be published if distributed as a network service. This is acceptable if Notesaner is planned as open-core. Confirm with legal before shipping the enterprise tier.

---

### 1.2 HedgeDoc (v2 branch)

**Repository**: https://github.com/hedgedoc/hedgedoc

**License**: AGPL-3.0. Fully compatible.

**Architecture Summary**:
HedgeDoc 2 is a complete TypeScript rewrite. Backend: NestJS. Frontend: Next.js + React + CodeMirror 6. Real-time sync: Yjs over WebSocket. Monorepo with Turborepo. The 1.x branch is maintenance-only; the 2.x branch (in active development) is where the value is.

**What to Copy**:

- `backend/src/realtime/` — NestJS WebSocket gateway that integrates Yjs. This shows the exact pattern for calling `hocuspocus.handleConnection(ws, request)` from inside a NestJS `@WebSocketGateway`. This is the most directly reusable real-time collaboration module available for the NestJS stack.
- `backend/src/auth/` — NestJS Passport strategies for local, LDAP, and OIDC. The OIDC strategy using `openid-client` is directly applicable to Keycloak/Authentik.
- `backend/src/permissions/` — Guard-based permission checks on notes and rooms. Copy the Guard and Policy pattern.
- `frontend/src/components/editor/` — CodeMirror 6 integration. While Notesaner uses TipTap, the Yjs binding approach (Y.Text linked to editor state, awareness protocol for cursors) is the same concept and can be studied for the TipTap equivalent.
- `frontend/src/hooks/useRealtimeConnection.ts` — Client-side hook for managing WebSocket provider lifecycle (connect, disconnect, reconnect with backoff). Directly portable to React 19.

**How to Adapt**:
- Swap CodeMirror 6 for TipTap/ProseMirror. The Yjs binding API differs but the lifecycle management pattern is identical.
- HedgeDoc 2 targets single-document collaboration; Notesaner needs multi-document (many notes open simultaneously). Extend the gateway to maintain a map of document rooms rather than a single room.
- Replace HedgeDoc's file-based note storage with Prisma/PostgreSQL persistence.

**Time Saved**: 3–4 weeks on the real-time NestJS gateway and auth strategy modules.

**Risk**: AGPL-3.0. Same obligations as Docmost above.

---

### 1.3 Outline

**Repository**: https://github.com/outline/outline

**License**: BSL 1.1. NOT compatible with direct copying into a production product without a commercial license. Code can be read and used as a reference for non-production purposes.

**Architecture Summary**:
React frontend + Koa backend. Uses Sequelize (not Prisma). Editor on ProseMirror. Strong OAuth/SAML integration. Excellent backlink and document search implementations.

**What to Reference (not copy verbatim)**:

- Study `server/models/` for the data model relationships between Documents, Collections, Teams, and Users. Use these as a reference when designing Prisma schemas.
- Study `server/auth/providers/` for the pattern of pluggable auth providers (Google, Slack, SAML). The architecture — a provider registry that returns a Passport strategy — is a pattern worth replicating in NestJS without copying the code.
- Study `app/components/Editor/` for how they structure ProseMirror extensions as a composable array. The pattern is transferable to TipTap.

**How to Adapt**: Do not paste Outline code into Notesaner. Read the patterns, rewrite from scratch.

**Time Saved**: 1–2 weeks in design time saved by studying the architecture.

**Risk**: BSL 1.1 prohibits production use. Using BSL code in a competing product is explicitly restricted. Reference only.

---

### 1.4 AFFiNE + BlockSuite

**Repository**: https://github.com/toeverything/AFFiNE (main app)
**Repository**: https://github.com/toeverything/blocksuite (editor toolkit)

**License**: AFFiNE claims MIT for the frontend, but transitive AGPL-3.0 dependency on OctoBase is a historical concern. As of late 2024, AFFiNE reportedly dropped OctoBase in favor of SQLite/Postgres — verify before copying. BlockSuite itself is MIT.

**Architecture Summary**:
BlockSuite is a standalone block-based editor toolkit built on CRDT (Yjs) with Web Components as the rendering layer. It is framework-agnostic by design. AFFiNE uses BlockSuite as its editor but they are maintained in separate repos.

**What to Copy from BlockSuite**:

- `packages/framework/store/` — The Yjs document store abstraction. Shows how to wrap `Y.Map` and `Y.Array` in typed, observable store objects. Directly useful for Notesaner's collaborative data layer.
- `packages/blocks/` — Individual block implementations (paragraph, heading, image, code, etc.). These are Web Components but the block schema definitions (TypeScript interfaces for block data) can be copied and adapted as TipTap node schemas.
- Study the block type registry pattern for implementing Notesaner's plugin-based block system.

**How to Adapt**:
BlockSuite's renderer is Web Components. Notesaner uses TipTap/ProseMirror. Do not copy the renderer code. Copy the data model (block schemas, doc structure, Yjs binding patterns) and reimplement the renderer as TipTap extensions.

**Time Saved**: 2–3 weeks on block schema design and Yjs data modeling.

**Risk**: Verify AFFiNE's current dependency tree before pulling any AFFiNE-specific code. BlockSuite alone is MIT and safe.

---

### 1.5 SilverBullet

**Repository**: https://github.com/silverbulletmd/silverbullet

**License**: MIT. Fully permissive — copy anything.

**Architecture Summary**:
Self-hosted PWA. Single-user. Markdown files on disk. Plugin system called "Plugs" implemented in Lua (as of v2.x approach) and earlier in JavaScript sandboxed workers. The plugin registry and lifecycle management is the most interesting part for Notesaner.

**What to Copy**:

- `web/syscalls/` — The syscall interface that plugins use to interact with the host app (read/write pages, query index, show notifications). This is a clean, auditable API surface. Use it as the template for Notesaner's plugin host API.
- `plug-api/` — The TypeScript types that a plugin author uses. Copy these as the starting point for Notesaner's `@notesaner/plugin-api` package.
- `common/spaces/` — The SpacePrimitives abstraction for reading/writing note content. Useful for designing Notesaner's storage adapter interface.

**How to Adapt**:
SilverBullet runs plugins as Deno workers or WASM modules. Notesaner uses iframe sandbox for plugins. Replace the worker messaging protocol with `postMessage` over the iframe boundary. The syscall API shape is identical regardless of transport.

**Time Saved**: 2–3 weeks on plugin API surface design.

**Risk**: None. MIT license.

---

## 2. TipTap / ProseMirror Extensions

### 2.1 tiptap-markdown

**Repository**: https://github.com/aguingand/tiptap-markdown

**License**: MIT.

**What to Copy**:
The entire `src/` directory. This provides `MarkdownExtension` which adds `editor.storage.markdown.getMarkdown()` and `editor.storage.markdown.parse(md)`. It handles serialization of all standard TipTap nodes to GitHub Flavored Markdown and back.

Note: TipTap released an official `@tiptap/extension-markdown` in v3. If Notesaner targets TipTap v3, use the official package directly. For TipTap v2, use `aguingand/tiptap-markdown`.

**How to Adapt**:
Add custom serializers for Notesaner-specific nodes (wikilinks, callouts, embed blocks) by extending the `serializeNode` map.

**Time Saved**: 2–3 weeks of serializer implementation.

---

### 2.2 Novel (AI-Powered Editor)

**Repository**: https://github.com/steven-tey/novel

**License**: Apache-2.0. Compatible — attribution required, patent grant included.

**Architecture Summary**:
Next.js 14 + TipTap + shadcn/ui + Tailwind + Vercel AI SDK. The headless package (`packages/headless`) is the portable core.

**What to Copy**:

- `packages/headless/src/extensions/` — Slash command extension (`/` menu), AI completion extension, drag handle, image upload with placeholder. These are production-quality TipTap extensions with full TypeScript types.
- `packages/headless/src/plugins/` — UploadImagesPlugin (handles paste/drop image upload with a progress placeholder node). Copy verbatim; replace the `uploadFn` callback with Notesaner's S3/storage endpoint.
- `apps/web/components/tailwind/generative/ai-selector.tsx` — The AI command popup component (shadcn/ui + Tailwind). Copy the component and wire it to Notesaner's AI backend endpoint.
- The slash command menu implementation pattern: how commands are registered, filtered, and rendered as a ProseMirror plugin popup.

**How to Adapt**:
Novel targets Next.js App Router. Notesaner can use the headless package standalone without the Next.js app scaffolding. Install `novel` or copy `packages/headless/src/` directly and integrate as TipTap extensions in the Notesaner editor wrapper.

**Time Saved**: 3–4 weeks (slash commands, drag handle, AI completion UI, image upload).

---

### 2.3 BlockNote

**Repository**: https://github.com/TypeCellOS/BlockNote

**License**: Core packages — MPL-2.0. Advanced XL packages — GPL-3.0 or commercial.
MPL-2.0 is file-level copyleft: if you modify BlockNote source files you must publish those changes, but you can use BlockNote in a proprietary app without releasing the entire app.

**What to Copy**:

- Study `packages/core/src/blocks/` for block type schemas (paragraph, heading, bulletListItem, numberedListItem, checkListItem, table, image, video, audio, file). These TypeScript interfaces define the canonical shape of a block-based document. Use them as a starting point for Notesaner's node schema.
- `packages/react/src/components/SideMenu/` — The block drag handle and side menu (add block button). Copy the component; the UI is straightforward to restyle with shadcn/ui.
- `packages/react/src/components/FormattingToolbar/` — Floating formatting toolbar that appears on text selection. Copy and reskin.
- The slash menu implementation in `packages/react/src/components/SuggestionMenus/`.

**How to Adapt**:
BlockNote is an opinionated wrapper around TipTap. You can either use BlockNote as-is (fast to ship, less flexibility) or extract specific components and patterns. For Notesaner, the recommendation is to extract the UI components and patterns, not to use BlockNote as the editor core — Notesaner needs deeper ProseMirror control for wiki-link resolution and plugin-injected blocks.

**Time Saved**: 2–3 weeks (UI chrome: drag handle, slash menu, formatting toolbar).

---

### 2.4 Plate.js

**Repository**: https://github.com/udecode/plate

**License**: MIT.

**Architecture Summary**:
Plugin-based rich text editor on Slate.js (not TipTap/ProseMirror). Over 50 plugins. shadcn/ui components. The plugin architecture is the most reusable part for Notesaner even though the underlying editor differs.

**What to Reference**:
- The plugin registry pattern: how each plugin declares its `key`, its ProseMirror/Slate transforms, its React renderer, and its keyboard shortcuts in a single composable object. Replicate this interface in Notesaner's TipTap extension wrapper so that Notesaner plugins follow the same shape.
- `packages/ui/` — shadcn/ui-based editor toolbar components. Some are framework-agnostic enough to copy (toolbar buttons, popover menus, color pickers).

**How to Adapt**:
Plate's core is Slate.js. Do not port Plate's editor transforms — TipTap/ProseMirror transforms are completely different. Copy only the plugin registration interface and UI components.

**Time Saved**: 1–2 weeks on plugin architecture design and UI component reference.

---

## 3. Yjs Server Implementations

### 3.1 y-websocket (Official)

**Repository**: https://github.com/yjs/y-websocket

**License**: MIT.

**What to Copy**:
- `bin/server.js` — The reference WebSocket server implementation. Read this to understand the message protocol before implementing a NestJS WebSocket gateway. The message types (`messageSync`, `messageAwareness`) must match exactly.
- `src/y-websocket.js` — The client-side provider. Install via npm rather than copying; this is the standard client that connects to any Yjs-compatible server including Hocuspocus and y-redis.

**How to Adapt**:
Use y-websocket as the client provider in the browser. On the server, implement a NestJS `@WebSocketGateway` that speaks the same protocol, using Hocuspocus as the middleware.

**Time Saved**: 1 week of protocol research.

---

### 3.2 Hocuspocus

**Repository**: https://github.com/ueberdosis/hocuspocus

**License**: MIT.

**Architecture Summary**:
The TipTap-maintained Yjs WebSocket server. Can run standalone or be embedded into any WebSocket server by calling `hocuspocus.handleConnection(ws, request)`. Hooks for `onAuthenticate`, `onChange`, `onLoadDocument`, `onStoreDocument` make it composable with any persistence layer.

**What to Copy**:

- `packages/server/src/Hocuspocus.ts` — The main server class. Study this to understand the extension hook system. Replicating this pattern is how Notesaner adds auth, persistence, and rate limiting to document rooms.
- `packages/extension-database/` — The database persistence extension. Shows how to implement `fetchDocument` and `storeDocument` hooks backed by PostgreSQL. Copy the interface; replace the SQL with Prisma calls.
- `packages/extension-redis/` — The Redis pub/sub extension for scaling to multiple Hocuspocus instances. Copy and configure for ValKey (ValKey is Redis-protocol-compatible, no code changes needed).
- `packages/transformer/src/Tiptap.ts` — The document transformer between Yjs binary and TipTap JSON. This is critical for server-side rendering and search indexing. Copy verbatim.

**Integration Pattern for NestJS**:

```typescript
// apps/server/src/collaboration/collaboration.gateway.ts
@WebSocketGateway({ path: '/collaboration' })
export class CollaborationGateway implements OnGatewayConnection {
  async handleConnection(client: WebSocket, request: IncomingMessage) {
    await hocuspocus.handleConnection(client, request);
  }
}
```

This pattern lets Hocuspocus own the Yjs protocol while NestJS owns the HTTP lifecycle and dependency injection.

**Time Saved**: 4–6 weeks on the real-time sync infrastructure.

---

### 3.3 y-redis

**Repository**: https://github.com/yjs/y-redis

**License**: AGPL-3.0 or proprietary. The AGPL version is usable if Notesaner is open-source.

**Architecture Summary**:
Scalable alternative to y-websocket. Uses Redis Streams as a message bus. Documents are only loaded into memory for initial sync; subsequent updates are streamed through Redis. Separate worker process flushes Redis to PostgreSQL/S3.

**What to Copy**:

- `bin/server.js` — The WebSocket server that uses Redis Streams. For Notesaner's horizontal scaling needs, use this instead of a single Hocuspocus instance.
- `bin/worker.js` — The persistence worker. Run this as a separate NestJS microservice or standalone process. It dequeues Redis stream entries and writes Yjs binary snapshots to PostgreSQL via Prisma.
- `src/storage/postgres.js` — The PostgreSQL storage adapter. Adapt by swapping raw pg queries for Prisma `upsert` calls.

**How to Adapt**:
ValKey is Redis-protocol compatible. Point `REDIS_URL` at ValKey and y-redis works without changes. Run y-redis behind a load balancer with multiple instances for horizontal scaling.

**Time Saved**: 5–7 weeks on scalable real-time infrastructure.

**Risk**: AGPL-3.0 for the open-source version. For commercial use, contact the maintainers for a proprietary license.

---

### 3.4 y-sweet

**Repository**: https://github.com/jamsocket/y-sweet

**License**: MIT.

**Architecture Summary**:
Rust-based Yjs server. Persists to S3. MIT license. Document-level access tokens for auth. Can run as a standalone binary or Docker container alongside the NestJS backend.

**What to Copy**:

- The access token architecture: the server issues a short-lived document token (`@y-sweet/sdk` on the Node.js side), and the client uses this token to connect. Copy this auth handshake pattern into Notesaner's collaboration endpoint even if not using y-sweet directly.
- `js-pkg/sdk/src/` — The TypeScript SDK. Study the `getOrCreateDocumentToken` and `getConnectionUrl` patterns. This is the right abstraction for Notesaner's collaboration API, regardless of the server implementation chosen.

**Time Saved**: 1–2 weeks on collaboration auth design.

---

## 4. Authentication Libraries

### 4.1 passport-saml

**Repository**: https://github.com/node-saml/passport-saml

**License**: MIT.

**What to Copy**:

Install via npm (`@node-saml/passport-saml`). Do not copy — use as a dependency.

**Integration Pattern for NestJS**:

```typescript
// apps/server/src/auth/strategies/saml.strategy.ts
@Injectable()
export class SamlStrategy extends PassportStrategy(Strategy, 'saml') {
  constructor(configService: ConfigService) {
    super({
      callbackUrl: configService.get('SAML_CALLBACK_URL'),
      entryPoint: configService.get('SAML_ENTRY_POINT'),
      issuer: configService.get('SAML_ISSUER'),
      idpCert: configService.get('SAML_IDP_CERT'),
    });
  }
  async validate(profile: Profile) { /* map profile to Notesaner user */ }
}
```

**Reference Implementation to Study**:
- https://github.com/andreacioni/saml2-nest-poc — A minimal working NestJS + passport-saml proof of concept. Copy the `SamlStrategy`, `SamlAuthGuard`, and the SP metadata endpoint (`/auth/saml/metadata`).
- https://gist.github.com/andreacioni/eb5bad0bcca18cf4fb732c6d7e29e3e8 — NestJS SAML SSO gist with full controller and strategy wiring.

**Time Saved**: 1–2 weeks on SAML integration.

---

### 4.2 openid-client + NestJS (OIDC for Keycloak/Authentik)

**Repository**: https://github.com/melikhov-dev/nest-openid-client-passport

**License**: MIT.

**What to Copy**:

- The `OidcStrategyFactory` pattern: because OIDC requires async discovery (fetching the `.well-known/openid-configuration`), the strategy cannot be constructed synchronously. Copy the factory service that performs the discovery, builds the client, and then instantiates the `OidcStrategy` in the NestJS `onModuleInit` lifecycle hook.
- The `OidcGuard` and `OidcCallbackGuard` — the two guards needed for OIDC redirect flow.
- The session serialization/deserialization for refresh tokens.

**Integration Notes**:
Auth.js v5 (NextAuth) handles OIDC for the Next.js frontend via the `Keycloak` provider. On the NestJS backend, use `openid-client` directly to validate tokens issued by the same IdP. This creates a consistent token validation path across both layers.

**Time Saved**: 2–3 weeks on OIDC integration.

---

### 4.3 Auth.js v5 (NextAuth) — Keycloak / Authentik

**Repository**: https://github.com/nextauthjs/next-auth (Auth.js)
**Reference Example**: https://github.com/dkrasnovdev/nextjs-app-router-keycloak-example

**License**: ISC.

**What to Copy**:

- `auth.ts` configuration pattern from the reference example. Three lines to wire Keycloak OIDC into a Next.js 15 App Router project.
- The `middleware.ts` route protection pattern using `auth()` as middleware.
- The `callbacks.jwt` and `callbacks.session` patterns for attaching roles from the Keycloak token to the session object.

**Note on SAML**: Auth.js v5 does not support SAML natively. For SAML-authenticated sessions in the Next.js frontend, use a custom provider that receives a SAML assertion and converts it to a JWT session. The NestJS backend handles the SAML assertion validation via passport-saml and returns a JWT that Auth.js can accept as a `Credentials` provider.

**Time Saved**: 1 week on frontend auth wiring.

---

## 5. Graph Visualization

### 5.1 react-force-graph

**Repository**: https://github.com/vasturiano/react-force-graph

**License**: MIT.

**Architecture Summary**:
React wrapper over four rendering backends: `react-force-graph-2d` (Canvas), `react-force-graph-3d` (Three.js/WebGL), `react-force-graph-vr`, `react-force-graph-ar`. Underlying physics from `d3-force-3d`.

**What to Copy**:

Install `react-force-graph-2d` for the 2D note graph (matches Obsidian graph feel). For the 3D view, install `react-force-graph-3d`.

Key props to configure:

```typescript
<ForceGraph2D
  graphData={{ nodes, links }}
  nodeLabel="title"
  nodeColor={node => node.isActive ? '#6366f1' : '#94a3b8'}
  linkColor={() => '#334155'}
  onNodeClick={handleNodeClick}
  nodeCanvasObject={drawNodeWithLabel}
  d3VelocityDecay={0.3}
  cooldownTicks={100}
/>
```

- Study the `nodeCanvasObject` prop for custom node rendering (draw note title labels, tag chips, color-coded clusters).
- Study the `linkDirectionalArrowLength` prop for directional backlink arrows.
- The `graphData` shape `{ nodes: Node[], links: { source, target }[] }` is the data contract to build from Notesaner's backlink index.

**How to Adapt**:
Build a `useGraphData` hook in Notesaner that queries the backlink index from the NestJS API and transforms it into the `{ nodes, links }` shape. Memoize with `useMemo` and update via WebSocket events when notes are created/deleted/linked.

**Time Saved**: 2–3 weeks on graph rendering implementation.

---

### 5.2 Sigma.js + @react-sigma

**Repository**: https://github.com/jacomyal/sigma.js

**License**: MIT.

**Use Case**: When the graph exceeds ~2,000 nodes (large workspace), Sigma.js with WebGL rendering outperforms react-force-graph's Canvas backend. For most Notesaner users, react-force-graph is sufficient. Use Sigma.js as the fallback for enterprise workspaces.

**What to Copy**:

- Install `sigma` and `@react-sigma/core`. The `@react-sigma` package wraps sigma in React Context — each graph element is a React component.
- Study the `useLoadGraph` hook pattern for loading large graph datasets incrementally.
- The `ControlsContainer` and `SearchControl` components from `@react-sigma/controls` provide zoom, fullscreen, and node search out of the box.

**Time Saved**: 1–2 weeks if implementing large-graph support.

---

### 5.3 Quartz — Graph View Reference

**Repository**: https://github.com/jackyzha0/quartz

**License**: MIT.

**What to Reference**:
Quartz implements an Obsidian-compatible graph view in TypeScript using d3-force. The relevant files are in `quartz/components/Graph.tsx` and `quartz/static/graph.js`.

- Copy the d3-force simulation configuration: `d3.forceSimulation().force("link", ...).force("charge", ...).force("center", ...)`. These specific force parameters produce the Obsidian-like graph feel.
- Copy the node hover highlight logic: on hover, dim all nodes and links except the hovered node and its direct neighbors.
- Copy the full-graph vs. local-graph toggle logic (local graph shows only nodes within N links of the current note).

**Time Saved**: 1 week on graph simulation tuning.

---

## 6. Window / Layout Management

### 6.1 Allotment (Split Panes)

**Repository**: https://github.com/johnwalley/allotment

**License**: MIT.

**Use Case**: Split-pane editor layout (note editor left, preview right; or two notes side by side).

**What to Copy**:
Install `allotment`. No copying needed — it is a drop-in React component derived from VS Code's split view implementation.

```tsx
<Allotment>
  <Allotment.Pane minSize={200}>
    <NoteEditor noteId={leftNote} />
  </Allotment.Pane>
  <Allotment.Pane minSize={200}>
    <NoteEditor noteId={rightNote} />
  </Allotment.Pane>
</Allotment>
```

Use CSS variables to match Notesaner's theme: `--separator-border`, `--focus-border`.

**Time Saved**: 2 weeks vs. building a custom resizable split pane.

---

### 6.2 FlexLayout-React (Multi-Tab Docking)

**Repository**: https://github.com/caplin/FlexLayout

**License**: MIT.

**Use Case**: Full workspace layout with dockable, tabbable panels (note tabs, graph panel, database view, kanban — all in a single dockable interface similar to VS Code or JupyterLab).

**What to Copy**:

- Install `flexlayout-react`.
- Copy the `Model.fromJson` / `model.toJson` pattern for persisting layout state to the database (store per-user layout in PostgreSQL via Prisma).
- The `factory` function pattern: maps a tab's `component` string to a React component. This is Notesaner's plugin panel registration point.

```typescript
const factory = (node: TabNode) => {
  switch (node.getComponent()) {
    case 'note': return <NoteEditor noteId={node.getConfig().noteId} />;
    case 'graph': return <GraphView />;
    case 'kanban': return <KanbanView boardId={node.getConfig().boardId} />;
    case 'plugin': return <PluginPanel pluginId={node.getConfig().pluginId} />;
  }
};
```

- The `OptimizedLayout` wrapper (from the `aperturerobotics/flex-layout` fork) prevents unnecessary re-renders when the layout changes — critical for performance with many open tabs.

**How to Adapt**:
Use the `aperturerobotics/flex-layout` fork rather than the original `caplin/FlexLayout` — it is more actively maintained and includes the `OptimizedLayout` component.

**Repository for fork**: https://github.com/aperturerobotics/flex-layout

**Time Saved**: 4–5 weeks vs. building a custom docking layout manager.

---

### 6.3 react-mosaic

**Repository**: https://github.com/nomcopter/react-mosaic

**License**: Apache-2.0. Compatible — attribution required.

**Use Case**: Simpler tiling layout if FlexLayout's full docking complexity is not needed in v1.

**What to Copy**:
Install `react-mosaic-component`. The `MosaicWindow` component provides a titled panel with drag-and-drop split controls. Use this for the initial v1 implementation and migrate to FlexLayout later.

**Time Saved**: 1–2 weeks for a basic tiling layout.

---

## 7. Plugin System Reference

### 7.1 SilverBullet Plug System

Already covered in section 1.5. The specific files for the plugin API are:

- `plug-api/types.ts` — TypeScript types for the plug manifest, syscall definitions, and event handlers.
- `web/syscalls/index.ts` — The host-side syscall dispatcher that routes plugin calls to the appropriate service.
- The `WorkerLike` abstraction that wraps both Deno workers and in-browser Web Workers behind a common interface.

**Notesaner Adaptation**: Replace `WorkerLike` with an `IframePlugin` class that communicates via `postMessage`. The syscall dispatcher is identical; only the transport changes.

---

### 7.2 VSCode Extension Host Architecture (Reference Only)

**Repository**: https://github.com/microsoft/vscode (MIT)

**What to Reference**:
- `src/vs/workbench/api/common/extHost.protocol.ts` — The RPC protocol between the extension host iframe and the main workbench. The `MainContext` and `ExtHostContext` pattern (two sets of proxies, one on each side of the iframe boundary) is exactly what Notesaner needs for its plugin IPC layer.
- `src/vs/workbench/services/extensions/common/extensionsRegistry.ts` — The extension point registry. Replicate this for Notesaner's plugin contribution points (commands, sidebar panels, editor extensions, context menu items).

**Do not copy VSCode code verbatim** — the codebase is enormous and the patterns are tightly coupled to VSCode internals. Study and reimplement.

**Time Saved**: 1–2 weeks of architecture design.

---

## 8. Kanban / Calendar / Database Components

### 8.1 @dnd-kit/sortable — Kanban Board

**Repository**: https://github.com/clauderic/dnd-kit

**License**: MIT.

**Reference Implementations to Copy**:

- https://github.com/Georgegriff/react-dnd-kit-tailwind-shadcn-ui — A fully working accessible kanban board with React, @dnd-kit, Tailwind CSS, and shadcn/ui. Copy `src/components/KanbanBoard.tsx`, `KanbanColumn.tsx`, and `KanbanCard.tsx` as the starting point.

**Key patterns**:
- `DndContext` with `onDragEnd` for cross-column card movement
- `SortableContext` with `verticalListSortingStrategy` for within-column card ordering
- `DragOverlay` for a custom ghost element during drag
- `useDroppable` for column drop targets

**How to Adapt**:
Replace hard-coded column/card data with Prisma-backed board/column/card entities. Add optimistic updates using React 19's `useOptimistic` hook. Wire column order and card position to the database via the NestJS API.

**Time Saved**: 2–3 weeks on the kanban UI and drag-and-drop mechanics.

---

### 8.2 FullCalendar (Calendar View)

**Repository**: https://github.com/fullcalendar/fullcalendar-workspace

**License**: Standard plugins — MIT (free). Premium plugins — Commercial or AGPLv3.

**What to Use**:
The MIT-licensed standard plugins cover: month view, week view, day view, list view, event creation/editing, time grid. Install `@fullcalendar/react`, `@fullcalendar/daygrid`, `@fullcalendar/timegrid`, `@fullcalendar/interaction`.

Do not use premium plugins (resource scheduling, timeline views) unless Notesaner qualifies for the AGPLv3 exemption.

**How to Adapt**:
Map Notesaner's task/reminder entities to FullCalendar's `EventSourceInput` format. Wire `eventAdd`, `eventChange`, `eventRemove` callbacks to the NestJS API.

**Time Saved**: 3–4 weeks on calendar implementation.

---

### 8.3 TanStack Table (Database / Spreadsheet View)

**Repository**: https://github.com/TanStack/table

**License**: MIT.

**What to Copy**:
Install `@tanstack/react-table`. No code copying needed — use the npm package.

Key patterns to implement:

```typescript
const table = useReactTable({
  data: rows,
  columns,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  onSortingChange: setSorting,
  onColumnFiltersChange: setColumnFilters,
  state: { sorting, columnFilters },
});
```

- `columnDef.cell` renders custom cell types (text, number, date, select, relation).
- `columnDef.meta` carries Notesaner-specific metadata (field type, validation rules).
- The headless nature means Notesaner's shadcn/ui components handle all rendering — full design freedom.

**Reference Implementation**: Study the official TanStack Table examples at `tanstack.com/table/latest/docs/framework/react/examples/basic` for the wiring pattern.

**Time Saved**: 2–3 weeks on the database view.

---

## 9. Publishing / Static Site Export

### 9.1 Quartz

**Repository**: https://github.com/jackyzha0/quartz

**License**: MIT.

**What to Copy**:

Quartz is Notesaner's primary reference for the "Publish as site" feature. Key modules:

- `quartz/plugins/transformers/` — Markdown transformers: wikilink resolution (`WikiLinks.ts`), frontmatter parsing (`FrontMatter.ts`), tag normalization (`Tag.ts`), backlink generation (`Backlinks.ts`). Copy these transformer functions and adapt them to run server-side in Notesaner's publish pipeline.
- `quartz/components/Graph.tsx` and `quartz/static/graph.js` — The d3-force graph view for published sites. Copy the graph rendering for Notesaner's published site template.
- `quartz/components/Backlinks.tsx` — Renders the "Linked from" section at the bottom of each page. Copy the component logic; replace the Quartz data source with Notesaner's API.
- `quartz/components/Search.tsx` — Client-side fuzzy search using FlexSearch. Copy for the published site's search feature.
- `quartz/build.ts` — The build pipeline orchestration. Study the plugin pipeline (parse → transform → emit) for designing Notesaner's publish worker.

**How to Adapt**:
Notesaner's publish feature should accept a workspace (or subset), run the transformer pipeline server-side (in a NestJS queue worker), and output static HTML/CSS/JS that can be served from S3 + CloudFront or GitHub Pages. Quartz's transformer pipeline is the model.

**Time Saved**: 4–5 weeks on the publish pipeline.

---

### 9.2 VitePress

**Repository**: https://github.com/vuejs/vitepress

**License**: MIT.

**Use Case**: Alternative publish target for technical documentation (API docs, developer wikis). If a Notesaner workspace is a technical project, users may prefer VitePress-style output over Quartz-style.

**What to Reference**:
The `vitepress/src/node/build/` directory shows how to take Markdown files and emit a Vite-bundled static site. The plugin system for extending the Markdown parser is clean and worth studying for Notesaner's publish plugin API.

**Time Saved**: 1 week of publish plugin API design.

---

## 10. Consolidated Priority Matrix

The following table ranks each item by the ratio of time saved to integration complexity. Developer agents should tackle items in priority order.

| Priority | Item | License | Time Saved | Integration Effort | Start With |
|----------|------|---------|------------|-------------------|------------|
| 1 | Hocuspocus | MIT | 4–6 wk | Low | `packages/extension-database/`, `packages/extension-redis/` |
| 2 | Docmost — auth + collab | AGPL-3.0 | 6–9 wk | Medium | `apps/server/src/auth/`, `apps/server/src/collaboration/` |
| 3 | Novel — TipTap extensions | Apache-2.0 | 3–4 wk | Low | `packages/headless/src/extensions/` |
| 4 | FlexLayout-React | MIT | 4–5 wk | Medium | `aperturerobotics/flex-layout` fork |
| 5 | Quartz — publish pipeline | MIT | 4–5 wk | Medium | `quartz/plugins/transformers/` |
| 6 | y-redis | AGPL-3.0 | 5–7 wk | High | `bin/server.js`, `bin/worker.js` |
| 7 | HedgeDoc 2 — NestJS gateway | AGPL-3.0 | 3–4 wk | Low | `backend/src/realtime/`, `backend/src/auth/` |
| 8 | react-force-graph | MIT | 2–3 wk | Low | Install npm package |
| 9 | tiptap-markdown | MIT | 2–3 wk | Low | Copy `src/` or use `@tiptap/extension-markdown` |
| 10 | @dnd-kit kanban reference | MIT | 2–3 wk | Low | `Georgegriff/react-dnd-kit-tailwind-shadcn-ui` |
| 11 | passport-saml | MIT | 1–2 wk | Low | `andreacioni/saml2-nest-poc` |
| 12 | Allotment | MIT | 2 wk | Low | Install npm package |
| 13 | TanStack Table | MIT | 2–3 wk | Low | Install npm package |
| 14 | SilverBullet — plugin API | MIT | 2–3 wk | Medium | `plug-api/`, `web/syscalls/` |
| 15 | FullCalendar (standard) | MIT | 3–4 wk | Low | Install npm packages |
| 16 | BlockNote — UI chrome | MPL-2.0 | 2–3 wk | Medium | `packages/react/src/components/` |
| 17 | Auth.js v5 + Keycloak | ISC | 1 wk | Low | `dkrasnovdev` reference repo |
| 18 | openid-client NestJS | MIT | 2–3 wk | Low | `melikhov-dev/nest-openid-client-passport` |
| 19 | AFFiNE BlockSuite (data model) | MIT | 2–3 wk | Medium | `packages/framework/store/`, `packages/blocks/` |
| 20 | Quartz — graph + d3 params | MIT | 1 wk | Low | `quartz/static/graph.js` |

**Total estimated time saved if all applicable items are leveraged**: 55–80 developer-weeks.

---

## 11. License Compatibility Summary

| License | Copy into AGPL-3.0 codebase? | Notes |
|---------|------------------------------|-------|
| MIT | Yes | No restrictions |
| Apache-2.0 | Yes | Include NOTICE file |
| ISC | Yes | Functionally identical to MIT |
| MPL-2.0 | Yes, with file-level copyleft | Modified BlockNote files must stay MPL-2.0 |
| AGPL-3.0 | Yes | Notesaner source must be published |
| BSL 1.1 (Outline) | No — reference only | Production use requires commercial license |
| GPL-3.0 (BlockNote XL) | Only if Notesaner is fully GPLv3 | Avoid XL packages unless open-core strategy confirmed |

---

## 12. Immediate Next Actions for Developer Agents

1. **Collaboration agent**: Clone Hocuspocus, read `packages/server/src/Hocuspocus.ts` and `packages/extension-database/`. Implement the NestJS WebSocket gateway following the HedgeDoc 2 `backend/src/realtime/` pattern. Wire Hocuspocus hooks to Prisma for persistence.

2. **Auth agent**: Clone `andreacioni/saml2-nest-poc` for SAML. Clone `melikhov-dev/nest-openid-client-passport` for OIDC. Combine both into a single NestJS `AuthModule` with a provider selector. Reference Docmost's `apps/server/src/auth/` for the guard and decorator patterns.

3. **Editor agent**: Copy Novel's `packages/headless/src/extensions/` into `packages/editor-ext/`. Add the Docmost `packages/editor-ext/` extensions (wiki-link, callout). Wire tiptap-markdown for serialization. Implement the slash command menu using the Novel pattern.

4. **Layout agent**: Install `flexlayout-react` from the `aperturerobotics/flex-layout` fork. Install `allotment` for split-pane views. Implement the `factory` function that maps tab component names to Notesaner's panels.

5. **Graph agent**: Install `react-force-graph-2d`. Implement the `useGraphData` hook that queries the backlink API. Copy Quartz's `graph.js` d3-force parameters and hover-highlight logic.

6. **Publish agent**: Copy Quartz's `quartz/plugins/transformers/` — especially `WikiLinks.ts` and `Backlinks.ts`. Implement a NestJS Bull queue job that runs the transformer pipeline and outputs static files to S3.

---

## Sources

- [outline/outline — GitHub](https://github.com/outline/outline)
- [toeverything/AFFiNE — GitHub](https://github.com/toeverything/AFFiNE)
- [toeverything/blocksuite — GitHub](https://github.com/toeverything/blocksuite)
- [docmost/docmost — GitHub](https://github.com/docmost/docmost)
- [hedgedoc/hedgedoc — GitHub](https://github.com/hedgedoc/hedgedoc)
- [silverbulletmd/silverbullet — GitHub](https://github.com/silverbulletmd/silverbullet)
- [ueberdosis/hocuspocus — GitHub](https://github.com/ueberdosis/hocuspocus)
- [yjs/y-websocket — GitHub](https://github.com/yjs/y-websocket)
- [yjs/y-redis — GitHub](https://github.com/yjs/y-redis)
- [jamsocket/y-sweet — GitHub](https://github.com/jamsocket/y-sweet)
- [steven-tey/novel — GitHub](https://github.com/steven-tey/novel)
- [TypeCellOS/BlockNote — GitHub](https://github.com/TypeCellOS/BlockNote)
- [udecode/plate — GitHub](https://github.com/udecode/plate)
- [aguingand/tiptap-markdown — GitHub](https://github.com/aguingand/tiptap-markdown)
- [node-saml/passport-saml — GitHub](https://github.com/node-saml/passport-saml)
- [andreacioni/saml2-nest-poc — GitHub](https://github.com/andreacioni/saml2-nest-poc)
- [melikhov-dev/nest-openid-client-passport — GitHub](https://github.com/melikhov-dev/nest-openid-client-passport)
- [dkrasnovdev/nextjs-app-router-keycloak-example — GitHub](https://github.com/dkrasnovdev/nextjs-app-router-keycloak-example)
- [Auth.js Keycloak Provider Docs](https://authjs.dev/getting-started/providers/keycloak)
- [vasturiano/react-force-graph — GitHub](https://github.com/vasturiano/react-force-graph)
- [jacomyal/sigma.js — GitHub](https://github.com/jacomyal/sigma.js)
- [jackyzha0/quartz — GitHub](https://github.com/jackyzha0/quartz)
- [nomcopter/react-mosaic — GitHub](https://github.com/nomcopter/react-mosaic)
- [caplin/FlexLayout — GitHub](https://github.com/caplin/FlexLayout)
- [aperturerobotics/flex-layout — GitHub](https://github.com/aperturerobotics/flex-layout)
- [johnwalley/allotment — GitHub](https://github.com/johnwalley/allotment)
- [clauderic/dnd-kit — GitHub](https://github.com/clauderic/dnd-kit)
- [Georgegriff/react-dnd-kit-tailwind-shadcn-ui — GitHub](https://github.com/Georgegriff/react-dnd-kit-tailwind-shadcn-ui)
- [TanStack/table — GitHub](https://github.com/TanStack/table)
- [fullcalendar/fullcalendar-workspace — GitHub](https://github.com/fullcalendar/fullcalendar-workspace)
- [FullCalendar License Page](https://fullcalendar.io/license)
- [HedgeDoc Frontend Architecture — DeepWiki](https://deepwiki.com/hedgedoc/hedgedoc/2.2-frontend-architecture)
- [Docmost File Structure — DEV Community](https://dev.to/ramunarasinga-11/file-structure-in-docmost-an-open-source-alternative-to-confluence-and-notion-2im6)
- [AFFiNE Licensing Discussion — GitHub](https://github.com/toeverything/AFFiNE/discussions/5947)
- [BSL License FAQ — FOSSA Blog](https://fossa.com/blog/business-source-license-requirements-provisions-history/)
- [NestJS SAML SSO Gist — andreacioni](https://gist.github.com/andreacioni/eb5bad0bcca18cf4fb732c6d7e29e3e8)
- [y-redis README](https://github.com/yjs/y-redis/blob/master/README.md)
- [Liveblocks — Which rich text editor framework to choose in 2025](https://liveblocks.io/blog/which-rich-text-editor-framework-should-you-choose-in-2025)
