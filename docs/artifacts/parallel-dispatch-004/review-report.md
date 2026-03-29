# Code Review Report — Parallel Dispatch 004

**Date**: 2026-03-29
**Reviewer**: spec-reviewer
**Overall Score**: 71/100

---

## Summary

Five tasks were reviewed: documentation structure, the component-sdk package, backend component-overrides module, frontend component-overrides feature, and a refreshed README. The work is substantial and largely well-structured, but contains several issues that must be fixed before merging — most critically a serious architectural violation in the controller (direct Prisma access bypassing the service layer), missing input validation on DTOs, a postMessage origin-validation gap in the sandbox, and systematic Zustand misuse where data-fetching belongs in TanStack Query.

---

## Critical Issues

### C1 — Controller directly accesses Prisma (architecture violation)

**File**: `apps/server/src/modules/component-overrides/component-overrides.controller.ts`, lines 192–206

The `delete` handler casts `this.service` to an `unknown` type and then directly manipulates `this.service.prisma` to write audit log entries and delete the record. This is a severe Clean Architecture violation: the controller should never touch the ORM layer. The service's `prisma` property is private for a reason.

```typescript
// Current: controller reaches into service internals — WRONG
const prisma = (this.service as unknown as { prisma: { ... } }).prisma;
await prisma.overrideAuditLog.create({ ... });
await prisma.componentOverride.delete({ ... });
```

The `delete` operation must be implemented as a dedicated method on `ComponentOverridesService` (e.g., `service.delete(workspaceId, componentId, userId)`) and the controller must simply call that method.

### C2 — DTOs have no runtime validation decorators

**Files**: `apps/server/src/modules/component-overrides/dto/create-override.dto.ts`, `update-override.dto.ts`

Both DTOs contain zero `class-validator` decorators. The `CreateOverrideDto.sourceCode` field accepts any string of any length — including empty strings or multi-megabyte payloads. The `componentId` field accepts any string, though validation happens downstream in the service.

Required fixes:

- `@IsNotEmpty()`, `@IsString()`, `@MaxLength(...)` on `sourceCode`
- `@IsIn([...COMPONENT_IDS])` on `componentId` to fail fast at the HTTP layer
- `ValidationPipe` must be applied globally or per-route for `class-validator` to activate

### C3 — Sandbox postMessage does not validate origin

**File**: `apps/web/public/sandbox/component-override.html`, line 170

```javascript
window.addEventListener('message', function(event) {
  var msg = event.data;
  // No origin check — accepts messages from ANY frame
```

The sandbox is loaded with `sandbox="allow-scripts"` (no `allow-same-origin`), which means the iframe cannot itself read `location.origin`. However, the parent host sends messages using `postMessage(msg, '*')` (see `hooks.ts` line 57), which is already the widest target. The sandbox accepting messages from any sender is the direct risk: any co-loaded iframe (ads, other plugins, untrusted extensions injected into the page) could send a `RENDER` message with arbitrary `compiledCode` and have it executed via `new Function(...)`. While the `allow-scripts` sandbox prevents DOM access to the host, arbitrary script execution within the sandbox can still trigger `SDK_EVENT` messages back to the host that the host processes unconditionally.

The `event.source` should be validated: the sandbox should only process messages from `window.parent`. Add `if (event.source !== window.parent) return;` at the top of the handler.

---

## Major Issues

### M1 — Zustand store used for data fetching (violates frontend directive)

**File**: `apps/web/src/features/component-overrides/model/overrides-store.ts`

The store contains `loadRegistry` and `loadOverrides` — async actions that issue HTTP requests and store server data in Zustand. The project directive is explicit: "Zustand for business logic ONLY. Use TanStack Query for fetching." Server state (registry, override list, audit log) belongs in TanStack Query with proper cache invalidation. Zustand is appropriate for the editor workflow state (`activeComponentId`, `draftSources`, `operations`), but not for the API cache.

Additionally, `ComponentOverridesPage` calls these fetch actions inside `React.useEffect` (line 53–62) — another directive violation ("minimize useEffect; use TanStack Query for fetching").

The `OverrideAuditDrawer` component also fetches inside `React.useEffect` (lines 42–53) directly via the API client, bypassing both Zustand and TanStack Query.

Correct pattern: use TanStack Query `useQuery` for `getRegistry`, `list`, `getAuditLog`. Keep Zustand only for `activeComponentId`, `draftSources`, and `operations` (pending/error/success per componentId).

### M2 — `getRegistry` endpoint has no authentication guard

**File**: `apps/server/src/modules/component-overrides/component-overrides.controller.ts`, lines 43–48

The `getRegistry()` endpoint comment says "no admin role" but there is no `@Public()` decorator either. The module-level `@ApiBearerAuth('bearer')` applies to the whole controller. If the global `ApiKeyOrJwtGuard` is active (as confirmed in `app.module.ts`), then this endpoint requires a valid JWT. The comment suggests it is intended to be publicly accessible (e.g., for plugin developers). The actual intent needs to be clarified and implemented consistently: either decorate with `@Public()` or remove the "no admin role" comment.

### M3 — `send()` in `useOverrideSandbox` uses wildcard origin

**File**: `packages/component-sdk/src/hooks.ts`, line 57

```typescript
iframeRef.current?.contentWindow?.postMessage(msg, '*');
```

`postMessage` with `'*'` as the target origin sends the message to any origin. Since the sandbox HTML is served from the same origin (`/sandbox/component-override.html`), the target origin should be `window.location.origin`. Using `'*'` means that if the page is ever framed by a foreign origin, or if the sandbox fails to load and a foreign URL ends up in the iframe, the compiled code (which may contain workspace-specific logic) is leaked to that origin.

### M4 — `dangerouslySetInnerHTML` in registry starter template

**File**: `packages/component-sdk/src/registry.ts`, lines 285–287

The `SearchResultItem` starter template includes:

```tsx
dangerouslySetInnerHTML={{ __html: props.excerpt }}
```

This pattern is used for highlight markup (`<mark>matching</mark>`). The starter template is the recommended starting point for admins writing overrides. It teaches an XSS-prone pattern without any sanitization notice or example of sanitization (e.g., DOMPurify). At minimum this should include a comment warning about XSS and showing a sanitization example.

The sandbox `vnodeToDOM` renderer also handles `dangerouslySetInnerHTML` (line 116–119) without sanitization, meaning this XSS vector is live in the sandbox preview too.

### M5 — `project.json` has no `test` target

**File**: `packages/component-sdk/project.json`

The package has a `__tests__` directory and test files but no `test` target in `project.json`. Running `pnpm nx test component-sdk` will fail. A `test` target pointing to vitest must be added for CI to pick up these tests.

### M6 — `package.json` points to source, not built output

**File**: `packages/component-sdk/package.json`

```json
"main": "./src/index.ts",
"types": "./src/index.ts"
```

Pointing `main` and `types` to TypeScript source files works in an NX monorepo with TypeScript path mappings but is unconventional and will break if the package is ever consumed externally or published. The `tsconfig.base.json` path alias should handle this in-monorepo. However, no `lint` or `build` target is defined in `project.json`, making the package invisible to `nx affected` for those targets.

---

## Minor Issues

### m1 — Status type casting instead of typed Prisma enums

**File**: `apps/server/src/modules/component-overrides/component-overrides.service.ts`, lines 126–127, 195

```typescript
previousStatus: record.status as 'draft' | 'active' | 'error' | 'reverted',
newStatus: updated.status as 'draft' | 'active' | 'error' | 'reverted',
```

`record.status` is already of type `OverrideStatus` from the Prisma-generated client. The type cast is unnecessary and will silently mask any future type mismatch. Use the Prisma-generated `OverrideStatus` enum type directly.

### m2 — Audit log action for compile failure is misleading

**File**: `apps/server/src/modules/component-overrides/component-overrides.service.ts`, line 197

```typescript
action: newStatus === 'active' ? 'activated' : 'updated',
```

When compilation fails and `newStatus === 'error'`, the audit action recorded is `'updated'`. This is misleading — the correct action would be something like a dedicated compile attempt record. Given the current schema only supports the defined `OverrideAuditAction` enum, the most accurate available value would be `'updated'`, but the comment should clarify this is an intentional fallback, not an accidental omission.

### m3 — `getRegistry` uses dynamic import unnecessarily

**File**: `apps/server/src/modules/component-overrides/component-overrides.service.ts`, line 254

```typescript
async getRegistry() {
  const { getComponentRegistry } = await import('@notesaner/component-sdk');
  return getComponentRegistry();
}
```

The top of the file already has `import { getComponentMeta } from '@notesaner/component-sdk'` as a static import. There is no reason to use a dynamic `import()` for `getComponentRegistry` from the same module. This adds unnecessary async overhead to what is a synchronous registry lookup.

### m4 — Inline `AuthenticatedRequest` interface in controller

**File**: `apps/server/src/modules/component-overrides/component-overrides.controller.ts`, line 29

```typescript
interface AuthenticatedRequest {
  user: { sub: string };
}
```

This interface is likely already defined in a shared location (e.g., `common/types` or `auth/types`). Defining it locally creates duplication. It should be imported from the canonical shared location.

### m5 — Monaco compiler options use magic numbers

**File**: `apps/web/src/features/component-overrides/ui/OverrideEditor.tsx`, lines 118–121

```typescript
jsx: 4 /* React */,
target: 99 /* ESNext */,
moduleResolution: 2 /* Node */,
```

Monaco's TypeScript compiler options accept numeric enum values, but these magic numbers (`4`, `99`, `2`) are opaque to readers. Import or reference the enum names from the Monaco types package, or at minimum keep the existing comments consistent (the comment `/* React */` for `jsx: 4` is correct, but `moduleResolution: 2 /* Node */` is incorrect — `2` is `NodeJs`, not `Node` which is `100` in newer Monaco versions). This could cause incorrect IntelliSense behavior.

### m6 — Sandbox React shim `useState` does not support re-renders

**File**: `apps/web/public/sandbox/component-override.html`, lines 52–54

```javascript
React.useState = function (init) {
  // Minimal useState stub for sandbox; re-renders not supported without ReactDOM.
  var val = typeof init === 'function' ? init() : init;
  return [val, function () {}];
};
```

The setState function is a no-op. Any override component that calls `setState` will silently fail to re-render. This is documented in a comment but creates a confusing user experience: admins writing interactive overrides will see them frozen in the preview. The comment should be surfaced in the UI as a notice ("Interactive state (useState) is not supported in preview mode").

### m7 — `OverrideAuditDrawer` fetches data imperatively, not through TanStack Query

**File**: `apps/web/src/features/component-overrides/ui/OverrideAuditDrawer.tsx`, lines 42–53

Same violation as M1: direct API call inside `useEffect`. Should use `useQuery` with enabled condition `open === true`.

### m8 — `STATUS_COLOR` duplicated across two files

**Files**: `apps/web/src/features/component-overrides/ui/ComponentOverridesPage.tsx` line 36, `OverrideEditor.tsx` line 59

Identical `STATUS_COLOR` constant defined twice. Extract to a shared location in `lib/` or `model/`.

### m9 — Missing `@Public()` annotation on registry endpoint (documentation/intent gap)

Related to M2 above. The Swagger annotation says `@ApiBearerAuth('bearer')` at the controller level but no per-route override for the public endpoint. This leads to misleading Swagger docs that show the registry as requiring auth even if intended to be public.

### m10 — `DOCS_STRUCTURE.md` references `apps/docs` but repo uses `apps/docs/` (Docusaurus)

**File**: `docs/DOCS_STRUCTURE.md`, "Implementation Notes" section, line 429

The document recommends "Separate `apps/docs-help` and `apps/docs-developer`" but the actual implementation (confirmed by git status: `6c3a914 feat(docs): set up Docusaurus 3 docs app at apps/docs/`) uses a single `apps/docs/` directory. The structure document is out of sync with the implementation.

### m11 — README documentation links point to `apps/docs/dev/` paths not matching actual structure

**File**: `README.md`, lines 296, 313, 327

Links like `apps/docs/dev/self-hosting/overview.md`, `apps/docs/dev/contributing/overview.md`, etc. reference paths that may not match the actual Docusaurus structure created in `apps/docs/`. These links will produce 404s in GitHub's file browser until verified.

---

## Per-Module Assessment

### 1. Documentation Structure (`docs/DOCS_STRUCTURE.md`)

**Score: 85/100**

Strong work. The two-site model (help vs developer docs) is well-reasoned and follows established patterns from Obsidian and Notion. The navigation hierarchy is thorough and covers all major product areas. The page descriptions table is a useful implementation guide.

Issues found:

- The document proposes `apps/docs-help` and `apps/docs-developer` as two separate NX apps, but the implementation used a single `apps/docs/` site. The structure document should be updated to reflect the actual decision.
- The "Plugin Settings Reference" page is listed in the user help sidebar under Plugins, but plugin settings are typically in the developer docs. This placement may cause confusion.
- No mention of versioning for the user help site was explicitly stated as "not versioned (always reflects latest stable)" — this is correct, but the help site should clearly show which app version it reflects.

### 2. Component SDK (`packages/component-sdk/`)

**Score: 78/100**

The type system is well-designed. `OverridableComponentId` as a discriminated union string type, `SandboxInboundMessage`/`SandboxOutboundMessage` as discriminated unions, and the `ComponentSdkContext` interface are all correctly modeled. The registry pattern is clean and testable.

Issues found:

- Critical: `dangerouslySetInnerHTML` in `SearchResultItem` starter template with no XSS sanitization guidance (M4)
- Major: No `test` target in `project.json` (M5)
- Major: `package.json` `main`/`types` point to TS source (M6)
- Minor: `useOverrideSandbox` sends messages with `'*'` target origin (M3)
- Minor: The hooks file imports `useEffect` but the hook creates a side effect that re-subscribes whenever `compiledCode`, `componentId`, `props`, or `ctx` change (line 88). If the parent component passes inline object literals for `props` and `ctx`, this causes excessive re-subscriptions. The dependency array should use stable references or memo.
- Tests: Good coverage of the registry module. No tests for `useOverrideSandbox` (hooks.ts).

### 3. Component Overrides — Backend (`apps/server/src/modules/component-overrides/`)

**Score: 62/100**

The service logic is sound: admin role guard, idempotency check on create, proper esbuild error handling, and comprehensive audit log writes. The module wiring is correct and `ComponentOverridesModule` is properly registered in `AppModule`.

The Prisma schema integration is complete and well-structured: `ComponentOverride` and `OverrideAuditLog` models, correct composite unique constraints, appropriate indexes on `workspaceId` and `componentId`.

Issues found:

- Critical: Controller directly accesses `this.service.prisma` in the `delete` handler (C1)
- Critical: DTOs lack `class-validator` decorators — no input validation at HTTP boundary (C2)
- Major: `getRegistry` endpoint intent (public vs authenticated) is ambiguous (M2)
- Minor: Unnecessary `as` type casts for Prisma enum types (m1)
- Minor: Misleading audit action for failed compile (m2)
- Minor: Dynamic import for `getComponentRegistry` when static import already exists (m3)
- Minor: `AuthenticatedRequest` interface duplicated locally (m4)
- Tests: Backend service tests are solid. `assertAdminRole` guard tested for no-membership, wrong-role, and both allowed roles. CRUD operations tested. Compile and revert tested. No test for the `delete` operation (which is the most complex and problematic).

### 4. Component Overrides — Frontend (`apps/web/src/features/component-overrides/`)

**Score: 60/100**

The FSD structure is correctly applied: `api/`, `model/`, `ui/`, `lib/`, and `index.ts` barrel export. The API client correctly uses `apiClient` (axios-based, per directive). The Zustand store is well-organized internally, with devtools middleware, named actions, and a `selectOverrideOp` selector.

The UI components use Ant Design throughout (`Table`, `Drawer`, `Button`, `Tag`, `Badge`, `Alert`, `Skeleton`, `Timeline`, `Typography`). No raw HTML elements in place of Ant Design components. The `cn()` helper is not needed in these files since no Tailwind className composition is happening.

Issues found:

- Major: Zustand store manages server state (`registry`, `overrides`) via async fetching actions — violates the "TanStack Query for fetching" directive (M1)
- Major: Data fetching in `useEffect` in `ComponentOverridesPage` (M1)
- Major: Data fetching in `useEffect` in `OverrideAuditDrawer` (m7)
- Minor: `STATUS_COLOR` duplicated in two component files (m8)
- Minor: Monaco compiler option magic numbers (m5)
- Tests: Store tests are comprehensive. All actions tested including error paths. `selectOverrideOp` selector tested. No UI component tests (acceptable given complexity of Monaco testing).

### 5. Sandbox Preview (`apps/web/public/sandbox/component-override.html`)

**Score: 68/100**

The security model is largely correct:

- `sandbox="allow-scripts"` with no `allow-same-origin` properly isolates the iframe
- CSP meta tag blocks all network requests, image loading, and form submissions
- No `localStorage`, `sessionStorage`, `cookies` or fetch available in the sandbox
- The custom vdom renderer is a creative solution for preview without shipping full ReactDOM

Issues found:

- Critical: No origin validation on incoming `postMessage` — accepts messages from any sender (C3)
- Major: `dangerouslySetInnerHTML` handled in the renderer without sanitization (M4 / sandbox side)
- Minor: `React.useState` setter is a no-op, which silently breaks interactive components (m6)
- The `parent.postMessage({ type: 'READY' }, '*')` on line 194 uses `'*'` as the target origin. While the iframe does not know the parent's origin (no `allow-same-origin`), this is accepted practice; the risk is low since the payload is just `{ type: 'READY' }`.
- The `vnodeToDOM` function calls functional components synchronously without any error boundary or stack limit. A deeply recursive component could cause a stack overflow. A depth limit guard would be prudent.

### 6. README (`README.md`)

**Score: 88/100**

Excellent quality. The README is professional, complete, and well-structured. Highlights:

- Compelling positioning against Obsidian/Notion/Logseq with a feature comparison table
- Mermaid architecture diagram accurately reflects the system
- Two quick-start paths (Docker Compose and local dev) with concrete commands
- Project structure tree matches actual monorepo layout
- Badges are accurate for the tech stack versions
- AGPL-3.0 license section is clear about obligations

Issues found:

- Minor: Documentation links point to `apps/docs/dev/...` paths that may not match the actual Docusaurus site structure (m11)
- Minor: The `pnpm nx serve web` / `pnpm nx serve server` commands from `CLAUDE.md` are not present — the README uses `pnpm dev`, `pnpm dev:web`, `pnpm dev:server`. This is fine as README commands are higher-level aliases, but the discrepancy is worth noting.
- The `packages/component-sdk/` directory is not mentioned in the project structure tree, though it now exists. Minor omission.

---

## Recommendations

### Priority 1 — Fix before merge

1. **Move `delete` logic into `ComponentOverridesService`** — create a `service.delete(workspaceId, componentId, userId)` method and call it from the controller. Remove the `as unknown` cast entirely.

2. **Add `class-validator` to DTOs** — at minimum: `@IsNotEmpty()` and `@MaxLength(50000)` on `sourceCode`, `@IsIn(OVERRIDABLE_IDS)` on `componentId`. Enable `ValidationPipe` globally or on the controller.

3. **Add origin check in sandbox** — add `if (event.source !== window.parent) return;` as the first line of the `message` event handler.

4. **Add sanitization warning to `SearchResultItem` starter template** — comment or modify the `dangerouslySetInnerHTML` usage to include a clear XSS warning and example of safe usage.

### Priority 2 — Fix in follow-up task

5. **Migrate server state to TanStack Query** — replace `loadRegistry` and `loadOverrides` Zustand actions with `useQuery` hooks. Replace `useEffect` data-fetching in `ComponentOverridesPage` and `OverrideAuditDrawer`. Keep Zustand for editor workflow state only.

6. **Add `test` target to `component-sdk/project.json`** — so CI runs the package tests.

7. **Resolve `getRegistry` endpoint visibility** — decide public vs authenticated and implement accordingly with `@Public()` decorator or remove the misleading comment.

### Priority 3 — Housekeeping

8. **Deduplicate `STATUS_COLOR`** — extract to `lib/override-status.ts` shared by both components.
9. **Remove unnecessary type casts** for Prisma `OverrideStatus` enum values.
10. **Replace dynamic import in `getRegistry`** with the existing static import.
11. **Update `DOCS_STRUCTURE.md`** to reflect the single `apps/docs/` decision rather than the proposed two-app split.
12. **Verify README documentation links** against the actual Docusaurus file structure.
