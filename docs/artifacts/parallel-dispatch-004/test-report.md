# Test Report — parallel-dispatch-004

**Date**: 2026-03-29
**Scope**: component-sdk, server/component-overrides, web/component-overrides

---

## Test Inventory

| File                                                                                        | Tests        | Status                 |
| ------------------------------------------------------------------------------------------- | ------------ | ---------------------- |
| `packages/component-sdk/src/__tests__/registry.test.ts`                                     | 7            | ✅ PASS                |
| `apps/server/src/modules/component-overrides/__tests__/component-overrides.service.test.ts` | 14 (not run) | ❌ IMPORT ERROR        |
| `apps/web/src/features/component-overrides/__tests__/overrides-store.test.ts`               | 18 (not run) | ❌ MOCK HOISTING ERROR |

---

## Test Results

### 1. `packages/component-sdk` — 7/7 PASSED

Run via `pnpm vitest run packages/component-sdk/src/__tests__/registry.test.ts`.

```
Test Files  1 passed (1)
Tests       7 passed (7)
Duration    83ms
```

**Note**: `project.json` has no `test` target, so `pnpm nx test component-sdk` fails with
`Cannot find configuration for task component-sdk:test`. Tests must be run directly via vitest.

---

### 2. `apps/server` — FAILED (import error, 0 tests run)

**Error**:

```
Error: Cannot find package '@notesaner/component-sdk' imported from
  apps/server/src/modules/component-overrides/component-overrides.service.ts
```

**Root cause**: `apps/server/vitest.config.ts` defines aliases only for `@notesaner/contracts`
and `@notesaner/constants`. The `@notesaner/component-sdk` package is missing from the alias
map, so Vitest cannot resolve it.

**Fix** — add to `apps/server/vitest.config.ts` `resolve.alias`:

```ts
'@notesaner/component-sdk': resolve(root, 'packages/component-sdk/src/index.ts'),
```

---

### 3. `apps/web` — FAILED (vi.mock hoisting error, 0 tests run)

**Error**:

```
ReferenceError: Cannot access 'mockApi' before initialization
  at apps/web/src/features/component-overrides/__tests__/overrides-store.test.ts:18:26
```

**Root cause**: Vitest hoists `vi.mock()` calls to the top of the file at compile time,
before any `const`/`let` declarations are evaluated. The test declares:

```ts
const mockApi = { getRegistry: vi.fn(), ... };   // line 6 — evaluated AFTER hoisting
vi.mock('../api/component-overrides-api', () => ({
  componentOverridesApi: mockApi,                 // references mockApi — undefined at hoist time
}));
```

**Fix** — use `vi.hoisted()` to declare the mock object before the module graph loads:

```ts
const mockApi = vi.hoisted(() => ({
  getRegistry: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  compile: vi.fn(),
  revert: vi.fn(),
  delete: vi.fn(),
  getAuditLog: vi.fn(),
}));

vi.mock('../api/component-overrides-api', () => ({
  componentOverridesApi: mockApi,
}));
```

**Secondary issue**: `apps/web/vitest.config.ts` also lacks the `@notesaner/component-sdk`
alias. Even though `overrides-store.ts` imports it only for types, the import will fail at
runtime once the hoisting issue is fixed. Add:

```ts
'@notesaner/component-sdk': resolve(root, 'packages/component-sdk/src/index.ts'),
```

---

## Config Files

### `apps/docs/docusaurus.config.ts` — ✅ VALID

Syntactically valid TypeScript. Key observations:

- Correct use of `satisfies Preset.Options` and `satisfies Preset.ThemeConfig`
- Multi-instance docs plugin (`help` at `/help`, `dev` at `/docs`) — properly structured
- Default `docs` and `blog` disabled to avoid conflicts with multi-instance setup
- `sitemap` configured in the classic preset options
- Algolia block commented out pending index setup — expected
- No structural errors

### `packages/ui/.storybook/main.ts` — ✅ VALID

Syntactically valid TypeScript. Key observations:

- `@storybook/react-vite` framework — correct for the Vite + React setup
- `viteFinal` uses dynamic import for `@tailwindcss/vite` — correct async pattern
- Stories pattern `../src/**/*.stories.@(ts|tsx)` — valid glob
- **Note**: Task referenced `apps/web/.storybook/main.ts` which does not exist. Storybook
  lives in `packages/ui/`, not `apps/web/`.

---

## Coverage Assessment

### component-sdk (tested)

| Area                                              | Coverage |
| ------------------------------------------------- | -------- |
| SDK version export                                | ✅       |
| Registry length (8 components)                    | ✅       |
| All 8 component IDs present                       | ✅       |
| Non-empty starterTemplate (>50 chars)             | ✅       |
| At least one required prop per component          | ✅       |
| `getComponentMeta` — known ID                     | ✅       |
| `getComponentMeta` — unknown ID returns undefined | ✅       |

Missing coverage:

- `hooks.ts` (`useOverrideSandbox`) — no tests
- `types.ts` — type-only file, no runtime logic, acceptable gap

### server/component-overrides (not run — assessed from source)

Tests cover:

- `assertAdminRole`: no membership → ForbiddenException, EDITOR → ForbiddenException,
  OWNER → allowed, ADMIN → allowed
- `create`: unknown componentId, duplicate override, happy path + audit log written
- `getOne`: not found → NotFoundException, found → returns record
- `update`: source change resets status to `draft`
- `revert`: sets `status=reverted`, clears `compiledCode`
- `getRegistry`: returns all 8 components

Missing coverage:

- `compile` method — not tested (complex esbuild interaction)
- `getAuditLog` — not tested
- `update` with no `sourceCode` change (no-op patch)
- `revert` on non-existent override (NotFoundException path)
- `compile` error path (compile fails → status=`error`)

### web/overrides-store (not run — assessed from source)

Tests cover:

- `loadOverrides`: populates by componentId
- `openEditor`: sets activeComponentId, seeds draftSource from existing override
- `closeEditor`: clears activeComponentId
- `setDraftSource`: updates draft
- `saveOverride` (create path): calls API, stores result, sets success status
- `saveOverride` (update path): calls update when override exists
- `saveOverride` error: sets error status + message
- `compileOverride`: stores compiled result, success status
- `revertOverride`: sets reverted state
- `deleteOverride`: removes from state, clears activeComponentId if active
- `selectOverrideOp`: returns idle default, returns tracked op

Missing coverage:

- `loadRegistry` action
- `openEditor` with no existing override and no registry entry (empty draft)
- `compileOverride` error path
- `revertOverride` error path
- `deleteOverride` error path

---

## Recommendations

### Blocking (tests cannot run)

1. **Add `@notesaner/component-sdk` alias to `apps/server/vitest.config.ts`**

   ```ts
   '@notesaner/component-sdk': resolve(root, 'packages/component-sdk/src/index.ts'),
   ```

2. **Fix `vi.mock` hoisting in `overrides-store.test.ts`**
   Replace `const mockApi = { ... }` + `vi.mock(factory)` pattern with `vi.hoisted()`.

3. **Add `@notesaner/component-sdk` alias to `apps/web/vitest.config.ts`**
   Same as #1 but for the web config.

### Non-blocking (quality improvements)

4. **Add `test` target to `packages/component-sdk/project.json`**
   Currently tests must be invoked via `vitest` directly; `nx test component-sdk` fails.
   Add:

   ```json
   "test": {
     "executor": "@nx/vitest:test",
     "options": { "configFile": "packages/component-sdk/vitest.config.ts" }
   }
   ```

   (plus a matching `vitest.config.ts` for the package)

5. **Add compile/error-path tests to server service**
   The `compile` method is the most complex and highest-risk — it should have tests for
   the success path (esbuild transforms → `active`), the failure path (syntax error → `error`),
   and the case where esbuild is unavailable.

6. **Add error-path tests to overrides-store**
   `compileOverride`, `revertOverride`, and `deleteOverride` only have happy-path tests.
   Add rejection cases to verify error state is set correctly (pattern already established
   by `saveOverride` error test).
