# Bug Report: Frontend Main Functionality Broken

## Reported Issues

1. **"New workspace" button does nothing** - Button on `/workspaces` page has no onClick handler
2. **Graph view doesn't open** - Ribbon "graph-view" action is a no-op placeholder
3. **Only one sidebar button works** - Only "file-explorer" ribbon action is wired; graph-view, daily-note, new-note are all placeholder no-ops
4. **New documents don't open** - "new-note" ribbon action and "New note" buttons are not wired to note creation
5. **Sidebars have wrong background** - `bg-sidebar-background` differs from `bg-background` in workspace area
6. **Side panels collapse/expand instead of being fixed** - Sidebar visibility toggles via `leftSidebarOpen`/`rightSidebarOpen` booleans
7. **Layout should be**: left sidebar (initially empty/detached) + center workspace (tabs on top) + right sidebar (initially empty/detached)
8. **Sidebars should start empty/detached** - Users drag widgets into them; currently pre-populated with file-explorer, search, etc.

## Root Causes Identified

### Ribbon Actions (apps/web/src/widgets/ribbon/ui/Ribbon.tsx)

- `useRibbonHandlers()` only wires `file-explorer` and `search` to real actions
- `graph-view`, `daily-note`, `new-note` are all `void '[Ribbon] ... action triggered'` - no-ops

### Workspace Creation (apps/web/app/[locale]/(workspace)/workspaces/page.tsx)

- "New workspace" button is a plain `<button>` with no onClick handler
- WorkspaceSwitcher "Create new workspace" button also has `// TODO: Navigate to workspace creation page`

### Sidebar Behavior (apps/web/src/shared/stores/sidebar-store.ts)

- `leftSidebarOpen: true` by default, `rightSidebarOpen: false`
- Sidebars toggle visibility entirely, not just content
- User requirement: sidebars always visible at full width/height, but START EMPTY (no pre-populated panels)

### Sidebar Background

- SidebarContainer uses `bg-sidebar-background` CSS class
- Main content uses `bg-background`
- These should be the same color

### Default Panel Layout

- `getDefaultPanelLayout()` from PanelRegistry populates sidebars with panels by default
- User wants: sidebars start empty, user drags panels in
