# Agent Directives: Web Frontend Refactoring Phase

> These directives are MANDATORY for all agents working on `apps/web/`.
> They override any conflicting patterns found in existing code.

## 1. State Management Rules

### Zustand: Business Logic ONLY

- Zustand stores hold **domain/business state**: auth, workspace data, notes, editor mode, search results
- Actions in stores perform business logic: data transformations, API orchestration, side effects
- DO NOT use Zustand for UI-only state (modal open/close, hover, active tab, form inputs)

### UI State: useState + React Context

- `useState` for component-local UI state (toggle, input value, animation state)
- `React.createContext` + `useContext` for cross-component UI state that doesn't need persistence (theme context, sidebar context, layout context)
- NEVER put transient UI state into Zustand stores

### Anti-patterns to AVOID

```typescript
// BAD: UI state in Zustand
const useModalStore = create(() => ({ isOpen: false, toggle: () => ... }))

// GOOD: UI state in useState or Context
const [isOpen, setIsOpen] = useState(false)
```

## 2. UI Component Library: Ant Design

### Migration from shadcn/ui to Ant Design

- Use `antd` components as the primary UI kit
- Remove shadcn/ui component usage from `apps/web/`
- `packages/ui/` remains as a thin wrapper layer for project-specific compound components
- Ant Design theme customization via ConfigProvider with project design tokens

### Component Abstraction Layer

- **NEVER use raw HTML elements directly** (`div`, `span`, `p`, etc.)
- Use `Box` component that accepts `as` prop for polymorphic rendering:
  ```typescript
  <Box as="section" className={cn('p-4')}>...</Box>
  <Box as="article">...</Box>
  ```
- `Box` must support: `as`, `className`, `children`, all HTML attributes of the target element
- Location: `apps/web/src/shared/ui/Box.tsx` (or `packages/ui/` if reused)

### Class Name Merging

- Use `clsx` for className merging, but ONLY through the `cn()` wrapper
- `cn()` wrapper location: `apps/web/src/shared/lib/cn.ts`
- If `cn()` is needed outside `apps/web/`, move to `libs/utils/`
- `cn()` combines `clsx` + `tailwind-merge` for deduplication

```typescript
// shared/lib/cn.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

## 3. HTTP & Data Fetching

### HTTP Client: Axios

- Replace native `fetch` wrapper with `axios` instance
- Create configured axios instance in `apps/web/src/shared/api/axios-instance.ts`
- Interceptors for: auth token injection, error normalization, logging (dev)
- Location: `apps/web/src/shared/api/`

### Server State: TanStack Query

- ALL server data fetching goes through `useQuery` / `useMutation`
- Query keys follow convention: `[domain, entity, ...params]`
- Example: `['workspaces', workspaceId, 'notes']`

### Query Factory Pattern

- Create a typed query factory that wraps axios requests into TanStack Query hooks:
  ```typescript
  // Produces: useGetNotes(), useGetNotesQuery (queryOptions), getNotesQueryKey
  const notesApi = createQueryFactory({
    getNotes: {
      request: (params: GetNotesParams) => axios.get<Note[]>('/api/notes', { params }),
      queryKey: (params) => ['notes', params],
    },
    createNote: {
      request: (data: CreateNoteDto) => axios.post<Note>('/api/notes', data),
      invalidates: ['notes'],
    },
  });
  ```
- Location: `libs/utils/` or dedicated `libs/query-factory/` package (reusable across apps)

## 4. useEffect Minimization

### Rules

- **FORBIDDEN** in business logic — use Zustand actions + subscriptions
- **ALLOWED** for:
  - DOM measurements / resize observers
  - Third-party library integration (TipTap, D3, CodeMirror)
  - Browser API subscriptions (IntersectionObserver, MediaQuery)
  - Cleanup-only effects (event listeners, timers)
- If you find yourself writing `useEffect` to sync state — STOP and use Zustand or TanStack Query instead

### Alternatives to useEffect

| Instead of...                          | Use...                                     |
| -------------------------------------- | ------------------------------------------ |
| `useEffect` + fetch                    | `useQuery`                                 |
| `useEffect` to sync stores             | Zustand `subscribe()`                      |
| `useEffect` to derive state            | `useMemo` or Zustand selectors             |
| `useEffect` for side effects on action | Zustand action (call side effect directly) |

## 5. FSD Architecture (Feature-Sliced Design)

### Directory Structure for Next.js

```
apps/web/
├── app/                    # Next.js App Router (routing ONLY)
│   ├── (auth)/
│   ├── (workspace)/
│   ├── api/
│   ├── layout.tsx
│   └── page.tsx
├── pages/                  # Empty (README.md only) — disables Pages Router
│   └── README.md
├── src/                    # FSD layers (ALL application code)
│   ├── app/                # App-wide setup: providers, global styles, global stores init
│   ├── pages/              # Page compositions (assembled from widgets/features)
│   ├── widgets/            # Composite UI blocks (Sidebar, Header, EditorPanel)
│   ├── features/           # User interactions (CreateNote, SearchNotes, SwitchTheme)
│   ├── entities/           # Business entities (Note, Workspace, User, Tag)
│   └── shared/             # Shared kernel (api, lib, ui, config, hooks, types)
```

### Layer Rules

- **Import direction**: app -> pages -> widgets -> features -> entities -> shared
- **Cross-imports**: ONLY via `@x` public API in `entities/` and `features/`
- Each slice has segments: `ui/`, `model/`, `api/`, `lib/`, `config/`
- Each slice exports through `index.ts` barrel

### Slice Structure Example

```
src/features/create-note/
├── ui/
│   └── CreateNoteForm.tsx
├── model/
│   ├── create-note.store.ts    # Zustand store (if business logic needed)
│   └── types.ts
├── api/
│   └── create-note.api.ts      # Query factory usage
├── lib/
│   └── validate-note.ts
└── index.ts                    # Public API barrel export
```

### Next.js App Router Integration

- `app/` directory at project root handles ONLY routing
- Route pages import compositions from `src/pages/`
- Example:
  ```typescript
  // app/(workspace)/[workspaceId]/notes/[noteId]/page.tsx
  import { NoteEditorPage } from '@/src/pages/note-editor';
  export default function Page({ params }) {
    return <NoteEditorPage params={params} />;
  }
  ```

### FSD Reference

- Documentation: https://feature-sliced.design/
- Example project: https://github.com/ZeiZel/production-frontend
- Note: `features` layer uses same segment structure as other layers (not the deprecated flat structure)

## 6. General Principles

- TypeScript strict mode — no `any`, no `as` casts without justification
- Zod validation at API boundaries only
- Conventional commits (feat:, fix:, refactor:, chore:)
- All new components must use Ant Design + Box abstraction
- All new API calls must use axios + query-factory + TanStack Query
- All new state must follow the Zustand (business) / useState+Context (UI) split
