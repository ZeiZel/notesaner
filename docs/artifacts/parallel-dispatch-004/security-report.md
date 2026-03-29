# Security Review: Component Override System

**Reviewer:** security-architect-review
**Date:** 2026-03-29
**Scope:** Monaco/iframe sandbox implementation for workspace component overrides

---

## Risk Assessment

| Area                                    | Risk Level |
| --------------------------------------- | ---------- |
| Input validation (DTOs)                 | **HIGH**   |
| sandbox postMessage origin validation   | **HIGH**   |
| iframe XSS via dangerouslySetInnerHTML  | **HIGH**   |
| Auth guard enforcement                  | **HIGH**   |
| Rate limiting (compile endpoint)        | **MEDIUM** |
| CSP delivery mechanism                  | **MEDIUM** |
| Source code size limits                 | **MEDIUM** |
| Type definition misleading declarations | **LOW**    |
| Controller internal API bypass          | **LOW**    |

---

## Vulnerabilities Found

### CRITICAL-01 — DTOs have zero server-side input validation

**Files:** `dto/create-override.dto.ts`, `dto/update-override.dto.ts`

Neither DTO uses `class-validator` decorators. There are no `@IsString()`, `@IsNotEmpty()`, `@IsIn()`, or `@MaxLength()` decorators on any field.

```ts
// create-override.dto.ts — as-is (no validation)
export class CreateOverrideDto {
  componentId!: string; // no @IsIn([...OverridableComponentIds])
  sourceCode!: string; // no @MaxLength(), no @IsString()
}
```

**Impact:**

- `componentId` accepts arbitrary strings — bypasses the enum check in the service if a bad actor crafts a request directly.
- `sourceCode` accepts arbitrarily large payloads (no size cap). A 50 MB source string triggers an expensive esbuild compilation and inflates the database row.
- NestJS `ValidationPipe` with `whitelist: true` cannot strip unexpected fields when no decorators are present, so any extra fields pass through.

---

### CRITICAL-02 — postMessage origin not validated in sandbox

**File:** `apps/web/public/sandbox/component-override.html`, lines 170–191 and lines 161–167

**Inbound (receiving messages):**

```js
window.addEventListener('message', function(event) {
  var msg = event.data;
  // ❌ No event.origin check
  if (!msg || !msg.type) return;
  switch (msg.type) {
    case 'RENDER':
      _compiledCode = msg.compiledCode;  // executes via new Function()
```

Any page that can embed the sandbox iframe (or open it in a tab) can send a `RENDER` message with arbitrary compiled code. Combined with `new Function(_compiledCode)`, this allows arbitrary JS execution in the sandbox context.

**Outbound (sending messages):**

```js
parent.postMessage({ type: 'READY' }, '*'); // line 194
parent.postMessage({ type: 'RENDER_OK' }, '*'); // line 161
parent.postMessage({ type: 'RENDER_ERROR', error: msg }, '*'); // line 164
```

Using `'*'` as the `targetOrigin` means these messages are dispatched to **any** parent window regardless of origin. This leaks sandbox state (render errors, ready signal) to cross-origin frames or opener windows.

---

### HIGH-01 — dangerouslySetInnerHTML in SearchResultItem starter template promotes XSS

**File:** `packages/component-sdk/src/registry.ts`, line 287

```tsx
<div dangerouslySetInnerHTML={{ __html: props.excerpt }} />
```

This is the official starter template delivered to admins. The sandbox renderer in `component-override.html` (line 116) explicitly implements `dangerouslySetInnerHTML`:

```js
if (k === 'dangerouslySetInnerHTML' && props[k] && props[k].__html != null) {
  el.innerHTML = props[k].__html;
}
```

If an admin copies this template and the `excerpt` prop is sourced from user-controlled note content, this is a stored XSS vector. Even with `allow-scripts` sandbox and no `allow-same-origin`, injected scripts can:

- Send outbound postMessages to the parent (allowed by sandbox)
- Perform UI redressing / phishing within the preview frame
- Use `parent.postMessage` to trigger SDK_EVENT callbacks that the host processes

---

### HIGH-02 — Auth guard enforcement not visible on controller

**File:** `apps/server/src/modules/component-overrides/component-overrides.controller.ts`

The controller is decorated with `@ApiBearerAuth('bearer')` (Swagger documentation only) but there is **no `@UseGuards(JwtAuthGuard)` or equivalent** on the class or any method:

```ts
@ApiTags('Component Overrides')
@ApiBearerAuth('bearer')          // ← Swagger annotation only, no enforcement
@Controller('workspaces/:workspaceId/component-overrides')
export class ComponentOverridesController {
```

If no global `JwtAuthGuard` is registered in the app module, all endpoints are publicly accessible. `req.user.sub` will be `undefined`, causing the service's `assertAdminRole` to query the database with `userId = undefined` — which will return `null` (no membership) and throw a `ForbiddenException`. This accidentally prevents access but does so with a 403 rather than a 401, and exposes the existence of workspaces to unauthenticated callers.

The `getRegistry()` endpoint comment says "no admin role" but there is no auth at all — it returns component metadata including starter templates to unauthenticated users.

---

### HIGH-03 — No rate limiting on compile endpoint

**File:** `apps/server/src/modules/component-overrides/component-overrides.service.ts`, `compile()` method

The `/compile` endpoint triggers `esbuild.transform()` with no throttling or debouncing. esbuild transformation is CPU-bound. An ADMIN user (or any user if HIGH-02 applies) can submit rapid compile requests against large source files to saturate server CPU.

No `@Throttle()` decorator or IP/user-level rate limiting is present on the compile or save endpoints.

---

## Missing Security Controls

### MISS-01 — CSP delivered via meta tag, not HTTP header

**File:** `apps/web/public/sandbox/component-override.html`, line 14–17

```html
<meta
  http-equiv="Content-Security-Policy"
  content="default-src 'none'; script-src 'unsafe-eval' 'unsafe-inline'; style-src 'unsafe-inline';"
/>
```

The code comment on line 9 says _"CSP set via HTTP header"_ but the implementation uses a `<meta>` tag. Meta CSP is:

- Not applied to inline event handlers in some older browser versions.
- Ignored entirely if the response already has a `Content-Security-Policy` HTTP header (the header wins).
- Cannot restrict `<base>` tag injection.

The CSP should be set as an HTTP response header from the Next.js server route that serves `/sandbox/component-override.html`.

### MISS-02 — No source code size limit

Neither the DTO nor the service enforces a maximum length for `sourceCode`. Recommend `@MaxLength(512_000)` (512 KB) at minimum to prevent database bloat and esbuild CPU exhaustion.

### MISS-03 — No import allowlist in esbuild compilation

**File:** `component-overrides.service.ts`, lines 158–169

esbuild `transform()` is used in `bundle: false` mode (default for `transform`), so it does **not** resolve imports — the compiled IIFE cannot `require('fs')` at runtime. However, there is no static analysis step to reject `import` statements for non-SDK modules before compilation. An admin could embed code that, when rendered in the sandbox, tries to `fetch()` arbitrary URLs (blocked by CSP `default-src 'none'`, but only if CSP is correctly enforced — see MISS-01).

### MISS-04 — `require` declared in Monaco type definitions

**File:** `apps/web/src/features/component-overrides/lib/override-type-defs.ts`, line 31

```ts
declare function require(id: string): any;
```

This tells Monaco (and the admin) that `require()` is a valid function in the override environment. It is not — the sandbox has no module system. This is misleading and could cause admins to write code they believe works but silently fails, or to attempt to `require('crypto')` etc. expecting Node.js built-ins.

### MISS-05 — Controller bypass of service layer for delete audit

**File:** `component-overrides.controller.ts`, lines 192–206

The `delete` handler casts the service to an unknown type to access `this.service.prisma` directly:

```ts
const prisma = (this.service as unknown as { prisma: { ... } }).prisma;
```

This bypasses the service's encapsulation, creates a tight coupling, and would silently break if `PrismaService` is renamed or the field made private. The delete operation and its audit log should be a single transactional `service.delete()` method.

---

## Recommendations

### Priority 1 (Fix before production)

1. **Add class-validator decorators to all DTOs:**

   ```ts
   import { IsIn, IsString, MaxLength, IsNotEmpty } from 'class-validator';

   export class CreateOverrideDto {
     @IsIn([
       'NoteCard',
       'FileTreeItem',
       'StatusBarItem',
       'SidebarPanel',
       'ToolbarButton',
       'CalloutBlock',
       'CodeBlock',
       'SearchResultItem',
     ])
     componentId!: string;

     @IsString()
     @IsNotEmpty()
     @MaxLength(524288) // 512 KB
     sourceCode!: string;
   }
   ```

   Ensure `ValidationPipe` is applied globally with `{ whitelist: true, forbidNonWhitelisted: true }`.

2. **Validate postMessage origin in both directions:**
   - Inbound: `if (event.origin !== window.location.origin) return;` — but note that with `sandbox="allow-scripts"` and no `allow-same-origin`, `window.location.origin` is `"null"`. The host must pass its own origin in the first message and the sandbox must store and validate against it for subsequent messages.
   - Outbound: Replace all `parent.postMessage(msg, '*')` with `parent.postMessage(msg, EXPECTED_HOST_ORIGIN)` where the host origin is communicated via the first `RENDER` message.

3. **Add `@UseGuards(JwtAuthGuard)` to the controller class** or verify a global guard is registered. Change the registry endpoint to require authentication (even non-admin), unless public access is explicitly a product requirement.

4. **Remove `dangerouslySetInnerHTML` from SearchResultItem starter template.** Replace with safe text rendering:
   ```tsx
   // Instead of dangerouslySetInnerHTML:
   {props.excerpt && <div style={...}>{props.excerpt}</div>}
   ```
   If rich HTML previews are needed, sanitize with DOMPurify before passing to `dangerouslySetInnerHTML`.

### Priority 2 (Fix within sprint)

5. **Deliver CSP as HTTP header**, not meta tag. In Next.js, add to `next.config` headers or add a specific route handler for `/sandbox/component-override.html`.

6. **Add rate limiting on compile endpoint.** Use `@nestjs/throttler` with a per-user limit (e.g. 10 compilations per minute).

7. **Move delete logic into the service.** Create `service.delete(workspaceId, componentId, userId)` that runs audit log creation and deletion in a Prisma transaction.

### Priority 3 (Improvements)

8. **Remove `declare function require` from type definitions** or replace with a comment explaining the sandbox has no module system.

9. **Add a static import allowlist check** before esbuild compilation — reject source code containing `import ... from` statements for anything outside `'react'` and `'@notesaner/component-sdk'`.

10. **Add source code hash to audit log** for tamper-evident audit trails.

---

## Overall Security Score

**42 / 100**

| Category          | Score | Notes                                                      |
| ----------------- | ----- | ---------------------------------------------------------- |
| Authentication    | 4/15  | Guard enforcement unclear; no global guard visible         |
| Authorization     | 10/15 | `assertAdminRole` is thorough; workspace isolation correct |
| Input validation  | 3/15  | DTOs have zero validation decorators                       |
| Sandbox isolation | 12/20 | `allow-scripts` correct; postMessage origin missing        |
| Injection / XSS   | 6/15  | Starter template teaches XSS; no source sanitization       |
| Audit logging     | 10/10 | Comprehensive; all mutations logged with actor + snapshot  |
| Rate limiting     | 0/5   | Absent on all write/compile endpoints                      |
| CSP               | 5/5   | Policy itself is correct; delivery mechanism is weak       |

The audit logging infrastructure is a genuine strength. The most critical gaps are the missing DTO validation (any string accepted, any size), the absent postMessage origin checks (allows cross-origin code injection into the sandbox), and the unverified JWT guard enforcement. Addressing the Priority 1 items would raise the score to approximately **68/100**.
