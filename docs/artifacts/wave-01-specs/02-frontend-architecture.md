# Notesaner — Frontend Architecture Specification

**Version**: 1.0.0
**Date**: 2026-03-25
**Author**: Senior Frontend Architect

---

## Table of Contents

1. [Feature-Sliced Design Structure](#1-feature-sliced-design-structure)
2. [State Management](#2-state-management)
3. [Component Library (packages/ui)](#3-component-library-packagesui)
4. [Editor Architecture (libs/editor-core)](#4-editor-architecture-libseditor-core)
5. [Window Management](#5-window-management)
6. [Routing](#6-routing)
7. [Real-Time (Yjs)](#7-real-time-yjs)
8. [Theme System](#8-theme-system)
9. [i18n (next-intl)](#9-i18n-next-intl)
10. [Performance](#10-performance)
11. [Design System Requirements for UI/UX Designer](#11-design-system-requirements-for-uiux-designer)
12. [Open-Source References](#12-open-source-references)

---

## 1. Feature-Sliced Design Structure

### Directory Tree: `apps/web/src`

```
apps/web/src/
│
├── app/                                    # Next.js 15 App Router
│   ├── layout.tsx                          # Root layout (fonts, providers)
│   ├── page.tsx                            # Landing / redirect to workspace
│   ├── not-found.tsx
│   ├── error.tsx
│   ├── loading.tsx
│   │
│   ├── (auth)/                             # Auth route group (no workspace shell)
│   │   ├── layout.tsx                      # Centered card layout
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── register/
│   │   │   └── page.tsx
│   │   ├── forgot-password/
│   │   │   └── page.tsx
│   │   ├── reset-password/
│   │   │   └── page.tsx
│   │   ├── verify-email/
│   │   │   └── page.tsx
│   │   └── sso/
│   │       ├── saml/
│   │       │   └── page.tsx               # SAML SSO entry
│   │       └── oidc/
│   │           └── page.tsx               # OIDC SSO entry
│   │
│   ├── (workspace)/                        # Main workspace shell
│   │   ├── layout.tsx                      # WorkspaceShell widget
│   │   ├── page.tsx                        # Redirect to last workspace
│   │   │
│   │   ├── workspaces/
│   │   │   ├── page.tsx                    # Workspace picker
│   │   │   ├── new/
│   │   │   │   └── page.tsx               # Create workspace
│   │   │   └── [workspaceId]/
│   │   │       ├── layout.tsx             # Per-workspace layout (sidebar state)
│   │   │       ├── page.tsx               # Empty state / welcome
│   │   │       ├── notes/
│   │   │       │   └── [noteId]/
│   │   │       │       └── page.tsx       # Note editor page
│   │   │       ├── graph/
│   │   │       │   └── page.tsx           # Full-screen graph view
│   │   │       ├── search/
│   │   │       │   └── page.tsx           # Search results page
│   │   │       ├── settings/
│   │   │       │   ├── layout.tsx         # Settings layout (nav + content)
│   │   │       │   ├── page.tsx           # Redirect to /general
│   │   │       │   ├── general/
│   │   │       │   │   └── page.tsx
│   │   │       │   ├── appearance/
│   │   │       │   │   └── page.tsx
│   │   │       │   ├── editor/
│   │   │       │   │   └── page.tsx
│   │   │       │   ├── shortcuts/
│   │   │       │   │   └── page.tsx
│   │   │       │   ├── sync/
│   │   │       │   │   └── page.tsx
│   │   │       │   ├── members/
│   │   │       │   │   └── page.tsx
│   │   │       │   ├── plugins/
│   │   │       │   │   └── page.tsx
│   │   │       │   ├── publish/
│   │   │       │   │   └── page.tsx
│   │   │       │   └── danger/
│   │   │       │       └── page.tsx
│   │   │       └── plugins/
│   │   │           ├── page.tsx           # Plugin marketplace
│   │   │           └── [pluginId]/
│   │   │               └── page.tsx       # Plugin detail
│   │   │
│   │   └── account/
│   │       ├── layout.tsx
│   │       ├── profile/
│   │       │   └── page.tsx
│   │       ├── security/
│   │       │   └── page.tsx
│   │       └── sessions/
│   │           └── page.tsx
│   │
│   ├── public/                             # Public published vaults (SSG/ISR)
│   │   └── [slug]/
│   │       ├── layout.tsx                 # PublicVaultLayout (no auth)
│   │       ├── page.tsx                   # Vault index / README
│   │       └── [...path]/
│   │           └── page.tsx               # Published note renderer
│   │
│   └── api/                               # Next.js API routes
│       └── auth/
│           └── [...nextauth]/
│               └── route.ts               # NextAuth handler
│
├── pages/                                  # (legacy fallback — none needed)
│
├── widgets/                                # FSD Layer: Composite UI blocks
│   ├── workspace-shell/
│   │   ├── ui/
│   │   │   ├── WorkspaceShell.tsx         # Root layout: ribbon + sidebar + main + right sidebar
│   │   │   ├── Ribbon.tsx                 # Left icon strip (Obsidian ribbon)
│   │   │   └── StatusBar.tsx              # Bottom status bar
│   │   └── index.ts
│   │
│   ├── sidebar/
│   │   ├── ui/
│   │   │   ├── LeftSidebar.tsx            # Collapsible left panel
│   │   │   ├── FileExplorer.tsx           # Folder/file tree
│   │   │   ├── FileExplorerNode.tsx       # Single tree node
│   │   │   ├── FileExplorerContextMenu.tsx
│   │   │   ├── SearchPanel.tsx            # Search input + results
│   │   │   ├── BookmarksPanel.tsx
│   │   │   └── TagsPanel.tsx
│   │   └── index.ts
│   │
│   ├── right-sidebar/
│   │   ├── ui/
│   │   │   ├── RightSidebar.tsx           # Collapsible right panel
│   │   │   ├── OutlinePanel.tsx           # Table of contents from headings
│   │   │   ├── BacklinksPanel.tsx         # Incoming links to current note
│   │   │   ├── PropertiesPanel.tsx        # Note frontmatter editor
│   │   │   ├── TagsPropertyPanel.tsx
│   │   │   └── CommentsPanel.tsx          # Inline comments list
│   │   └── index.ts
│   │
│   ├── editor-area/
│   │   ├── ui/
│   │   │   ├── EditorArea.tsx             # Main content area with tabs + panels
│   │   │   ├── TabBar.tsx                 # Horizontal tab strip
│   │   │   ├── Tab.tsx
│   │   │   ├── SplitPane.tsx              # Recursive split container
│   │   │   ├── PanelDropZone.tsx          # dnd-kit drop targets
│   │   │   └── EmptyEditorState.tsx       # Welcome / no note open
│   │   └── index.ts
│   │
│   ├── graph-panel/
│   │   ├── ui/
│   │   │   ├── GraphPanel.tsx             # Full graph view
│   │   │   ├── GraphCanvas.tsx            # WebGL/SVG canvas
│   │   │   ├── GraphToolbar.tsx           # Filter, layout, zoom controls
│   │   │   ├── GraphNode.tsx
│   │   │   ├── GraphEdge.tsx
│   │   │   ├── GraphMiniMap.tsx
│   │   │   └── LocalGraphPanel.tsx        # Per-note local graph
│   │   └── index.ts
│   │
│   ├── command-palette/
│   │   ├── ui/
│   │   │   ├── CommandPalette.tsx         # Cmd+P overlay
│   │   │   ├── CommandItem.tsx
│   │   │   └── CommandGroup.tsx
│   │   └── index.ts
│   │
│   └── plugin-panel/
│       ├── ui/
│       │   ├── PluginPanel.tsx            # Plugin iframe host
│       │   └── PluginSandbox.tsx          # iframe + postMessage bridge
│       └── index.ts
│
├── features/                               # FSD Layer: Business features
│   ├── auth/
│   │   ├── ui/
│   │   │   ├── LoginForm.tsx
│   │   │   ├── RegisterForm.tsx
│   │   │   ├── ForgotPasswordForm.tsx
│   │   │   ├── SSOProviderList.tsx
│   │   │   ├── TwoFactorForm.tsx
│   │   │   └── AuthCard.tsx               # Shared card wrapper
│   │   ├── model/
│   │   │   └── auth.store.ts              # Zustand auth slice
│   │   ├── api/
│   │   │   └── auth.queries.ts            # TanStack Query hooks
│   │   └── index.ts
│   │
│   ├── editor/
│   │   ├── ui/
│   │   │   ├── NoteEditor.tsx             # TipTap editor wrapper
│   │   │   ├── EditorToolbar.tsx          # Floating + fixed toolbar
│   │   │   ├── FloatingToolbar.tsx        # Selection bubble menu
│   │   │   ├── SlashCommandMenu.tsx       # / command dropdown
│   │   │   ├── LinkPreviewPopover.tsx     # Hover wiki-link preview
│   │   │   ├── WikiLinkAutocomplete.tsx   # [[ autocomplete dropdown
│   │   │   ├── CommentThread.tsx          # Inline comment anchors
│   │   │   ├── CollaboratorCursors.tsx    # Remote cursor indicators
│   │   │   ├── BlockDragHandle.tsx        # Left-side drag handle
│   │   │   ├── ImageResizeHandle.tsx
│   │   │   ├── EmbedBlock.tsx             # YouTube/Twitter oEmbed
│   │   │   ├── MathBlock.tsx              # KaTeX render
│   │   │   ├── CalloutBlock.tsx
│   │   │   ├── CodeBlockWithHighlight.tsx
│   │   │   └── NoteProperties.tsx         # Frontmatter YAML editor
│   │   ├── model/
│   │   │   └── editor.store.ts
│   │   ├── api/
│   │   │   └── notes.queries.ts
│   │   ├── lib/
│   │   │   ├── editor-config.ts           # TipTap instance config
│   │   │   └── shortcuts.ts               # Keyboard shortcut registry
│   │   └── index.ts
│   │
│   ├── search/
│   │   ├── ui/
│   │   │   ├── GlobalSearch.tsx           # Cmd+Shift+F overlay
│   │   │   ├── SearchInput.tsx
│   │   │   ├── SearchResults.tsx
│   │   │   ├── SearchResultItem.tsx
│   │   │   ├── SearchFilters.tsx
│   │   │   └── RecentSearches.tsx
│   │   ├── model/
│   │   │   └── search.store.ts
│   │   ├── api/
│   │   │   └── search.queries.ts
│   │   └── index.ts
│   │
│   ├── sync/
│   │   ├── ui/
│   │   │   ├── SyncStatusIndicator.tsx    # Status bar sync icon
│   │   │   ├── OfflineBanner.tsx
│   │   │   └── PresenceAvatars.tsx        # Who's online in this note
│   │   ├── model/
│   │   │   └── sync.store.ts
│   │   ├── lib/
│   │   │   ├── yjs-provider.ts
│   │   │   └── presence.ts
│   │   └── index.ts
│   │
│   ├── plugins/
│   │   ├── ui/
│   │   │   ├── PluginBrowser.tsx          # Marketplace grid
│   │   │   ├── PluginCard.tsx
│   │   │   ├── PluginDetail.tsx           # Modal/page for plugin details
│   │   │   ├── PluginInstallButton.tsx
│   │   │   ├── PluginSettingsForm.tsx     # Auto-generated settings UI
│   │   │   └── InstalledPluginList.tsx
│   │   ├── model/
│   │   │   └── plugins.store.ts
│   │   ├── api/
│   │   │   └── plugins.queries.ts
│   │   └── index.ts
│   │
│   ├── publishing/
│   │   ├── ui/
│   │   │   ├── PublishToggle.tsx          # Per-note publish switch
│   │   │   ├── PublishConfig.tsx          # Vault publish settings
│   │   │   ├── PublishedNoteView.tsx      # SSR read-only renderer
│   │   │   ├── PublicNav.tsx              # Generated navigation sidebar
│   │   │   ├── PublicTableOfContents.tsx
│   │   │   └── PublicSearch.tsx
│   │   ├── api/
│   │   │   └── publish.queries.ts
│   │   └── index.ts
│   │
│   └── settings/
│       ├── ui/
│       │   ├── GeneralSettings.tsx
│       │   ├── AppearanceSettings.tsx
│       │   ├── EditorSettings.tsx
│       │   ├── KeyboardShortcutsSettings.tsx
│       │   ├── SyncSettings.tsx
│       │   ├── MembersSettings.tsx
│       │   ├── PluginsSettings.tsx
│       │   ├── PublishSettings.tsx
│       │   └── DangerZoneSettings.tsx
│       ├── model/
│       │   └── settings.store.ts
│       ├── api/
│       │   └── settings.queries.ts
│       └── index.ts
│
├── entities/                               # FSD Layer: Domain entities
│   ├── note/
│   │   ├── model/
│   │   │   ├── note.types.ts              # NoteDto, NoteVersion, NoteLink
│   │   │   └── note.store.ts              # Per-note cache slice
│   │   ├── ui/
│   │   │   ├── NoteCard.tsx               # Summary card (search results)
│   │   │   ├── NoteIcon.tsx
│   │   │   └── NoteBreadcrumb.tsx
│   │   └── index.ts
│   │
│   ├── user/
│   │   ├── model/
│   │   │   └── user.types.ts
│   │   ├── ui/
│   │   │   ├── UserAvatar.tsx
│   │   │   ├── UserBadge.tsx
│   │   │   └── UserMenu.tsx               # Top-right user dropdown
│   │   └── index.ts
│   │
│   ├── workspace/
│   │   ├── model/
│   │   │   ├── workspace.types.ts
│   │   │   └── workspace.store.ts         # Active workspace, members
│   │   ├── ui/
│   │   │   ├── WorkspaceSwitcher.tsx
│   │   │   └── WorkspaceCard.tsx
│   │   └── index.ts
│   │
│   ├── tag/
│   │   ├── model/
│   │   │   └── tag.types.ts
│   │   ├── ui/
│   │   │   ├── TagBadge.tsx
│   │   │   ├── TagInput.tsx               # Autocomplete tag entry
│   │   │   └── TagCloud.tsx
│   │   └── index.ts
│   │
│   └── plugin/
│       ├── model/
│       │   └── plugin.types.ts            # PluginManifest, PluginRelease
│       ├── ui/
│       │   └── PluginStatusBadge.tsx
│       └── index.ts
│
└── shared/                                 # FSD Layer: Shared infrastructure
    ├── ui/                                 # Generic UI primitives (re-exports from packages/ui)
    │   ├── Button/
    │   ├── Input/
    │   ├── Dialog/
    │   ├── Tooltip/
    │   ├── ContextMenu/
    │   ├── DropdownMenu/
    │   ├── Separator/
    │   ├── ScrollArea/
    │   ├── Skeleton/
    │   └── index.ts
    │
    ├── api/
    │   ├── client.ts                       # Axios/fetch base client
    │   ├── query-client.ts                 # TanStack QueryClient singleton
    │   └── error-handler.ts
    │
    ├── lib/
    │   ├── utils.ts                        # cn(), debounce(), formatDate()
    │   ├── constants.ts                    # Route constants, local storage keys
    │   ├── hooks/
    │   │   ├── useKeyboardShortcut.ts
    │   │   ├── useLocalStorage.ts
    │   │   ├── useMediaQuery.ts
    │   │   ├── useDebounce.ts
    │   │   ├── useIntersectionObserver.ts
    │   │   ├── useResizeObserver.ts
    │   │   └── useOnClickOutside.ts
    │   └── providers/
    │       ├── QueryProvider.tsx
    │       ├── ThemeProvider.tsx
    │       ├── I18nProvider.tsx
    │       └── ToastProvider.tsx
    │
    ├── config/
    │   ├── env.ts                          # Runtime env validation (zod)
    │   └── feature-flags.ts
    │
    └── i18n/
        ├── routing.ts                      # next-intl routing config
        ├── navigation.ts                   # Typed Link, useRouter wrappers
        └── request.ts                      # Server-side locale resolution
```

---

## 2. State Management

### 2.1 Zustand Stores

#### Workspace Store (`workspace.store.ts`)

```typescript
interface WorkspaceState {
  // State
  activeWorkspaceId: string | null;
  workspaces: WorkspaceDto[];
  activeWorkspace: WorkspaceDto | null;
  members: WorkspaceMemberDto[];
  isLoading: boolean;

  // Actions
  setActiveWorkspace: (id: string) => void;
  setWorkspaces: (workspaces: WorkspaceDto[]) => void;
  updateWorkspace: (id: string, patch: Partial<WorkspaceDto>) => void;
}
```

#### Editor Store (`editor.store.ts`)

```typescript
interface EditorState {
  // State
  openNotes: Record<string, NoteEditorState>; // noteId -> editor state
  activeNoteId: string | null;
  editorMode: 'wysiwyg' | 'source' | 'preview';
  wordCount: Record<string, number>;
  isSaving: Record<string, boolean>;
  isSlashMenuOpen: boolean;
  slashMenuPosition: { top: number; left: number } | null;
  isLinkAutocompleteOpen: boolean;

  // Actions
  openNote: (noteId: string) => void;
  closeNote: (noteId: string) => void;
  setActiveNote: (noteId: string) => void;
  setEditorMode: (mode: EditorState['editorMode']) => void;
  setWordCount: (noteId: string, count: number) => void;
  setIsSaving: (noteId: string, saving: boolean) => void;
  openSlashMenu: (position: { top: number; left: number }) => void;
  closeSlashMenu: () => void;
}

interface NoteEditorState {
  noteId: string;
  title: string;
  isDirty: boolean;
  scrollPosition: number;
  cursorPosition: number;
  navigationHistory: string[]; // noteIds
  navigationIndex: number;
}
```

#### Sidebar Store (`sidebar.store.ts`)

```typescript
interface SidebarState {
  // State
  leftSidebarOpen: boolean;
  rightSidebarOpen: boolean;
  leftSidebarWidth: number;        // px, persisted
  rightSidebarWidth: number;       // px, persisted
  leftActiveTab: 'files' | 'search' | 'bookmarks' | 'tags';
  rightActiveTab: 'outline' | 'backlinks' | 'properties' | 'comments';
  expandedFolders: Set<string>;    // persisted
  selectedFileId: string | null;

  // Actions
  toggleLeftSidebar: () => void;
  toggleRightSidebar: () => void;
  setLeftSidebarWidth: (width: number) => void;
  setRightSidebarWidth: (width: number) => void;
  setLeftTab: (tab: SidebarState['leftActiveTab']) => void;
  setRightTab: (tab: SidebarState['rightActiveTab']) => void;
  toggleFolder: (folderId: string) => void;
  setSelectedFile: (fileId: string | null) => void;
}
```

#### Auth Store (`auth.store.ts`)

```typescript
interface AuthState {
  // State
  user: UserDto | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  accessToken: string | null;
  providers: AuthProviderDto[];

  // Actions
  setUser: (user: UserDto | null) => void;
  setAccessToken: (token: string | null) => void;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
}
```

#### Sync Store (`sync.store.ts`)

```typescript
interface SyncState {
  // State
  connectionStatus: 'connected' | 'connecting' | 'disconnected' | 'offline';
  pendingChanges: number;
  lastSyncedAt: Date | null;
  presence: Record<string, PresenceUser[]>; // noteId -> active users
  isOffline: boolean;

  // Actions
  setConnectionStatus: (status: SyncState['connectionStatus']) => void;
  setPendingChanges: (count: number) => void;
  setPresence: (noteId: string, users: PresenceUser[]) => void;
  setOffline: (offline: boolean) => void;
}

interface PresenceUser {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  color: string;
  cursor: { anchor: number; head: number } | null;
}
```

#### Settings Store (`settings.store.ts`)

```typescript
interface SettingsState {
  // State
  theme: 'light' | 'dark' | 'system';
  accentColor: string;
  fontFamily: 'default' | 'serif' | 'monospace';
  fontSize: number;             // px
  lineWidth: number;            // chars, editor max width
  spellCheck: boolean;
  vimMode: boolean;
  focusMode: boolean;
  showLineNumbers: boolean;
  tabSize: 2 | 4;
  locale: string;
  dateFormat: string;
  customShortcuts: Record<string, string>;

  // Actions
  setTheme: (theme: SettingsState['theme']) => void;
  setFontSize: (size: number) => void;
  setLineWidth: (width: number) => void;
  setSetting: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void;
  resetToDefaults: () => void;
}
```

#### Layout Store (`layout.store.ts`)

```typescript
interface LayoutState {
  // State
  layouts: LayoutDto[];
  activeLayoutId: string | null;
  currentLayout: LayoutConfig;
  isResizing: boolean;
  draggedPanelId: string | null;
  snapZoneActive: SnapZone | null;

  // Actions
  setLayout: (config: LayoutConfig) => void;
  saveLayout: (name: string) => Promise<void>;
  loadLayout: (layoutId: string) => void;
  splitPanel: (panelId: string, direction: 'horizontal' | 'vertical') => void;
  closePanel: (panelId: string) => void;
  resizePanel: (panelId: string, size: number) => void;
  moveTab: (tabId: string, targetPanelId: string) => void;
  setDraggedPanel: (panelId: string | null) => void;
  setSnapZone: (zone: SnapZone | null) => void;
}

type SnapZone = 'left-half' | 'right-half' | 'top-half' | 'bottom-half' |
                'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' |
                'left-third' | 'center-third' | 'right-third';
```

#### Plugins Store (`plugins.store.ts`)

```typescript
interface PluginsState {
  // State
  installedPlugins: PluginManifest[];
  enabledPluginIds: Set<string>;
  pluginSettings: Record<string, Record<string, unknown>>;
  loadedPlugins: Record<string, PluginInstance>;

  // Actions
  installPlugin: (manifest: PluginManifest) => Promise<void>;
  uninstallPlugin: (pluginId: string) => Promise<void>;
  togglePlugin: (pluginId: string) => Promise<void>;
  updatePluginSettings: (pluginId: string, settings: Record<string, unknown>) => void;
  registerPluginCommand: (pluginId: string, command: PluginCommand) => void;
}
```

### 2.2 TanStack Query Key Factories

```typescript
// shared/api/query-keys.ts

export const queryKeys = {
  // Auth
  auth: {
    me: () => ['auth', 'me'] as const,
    providers: () => ['auth', 'providers'] as const,
  },

  // Workspaces
  workspaces: {
    all: () => ['workspaces'] as const,
    list: () => [...queryKeys.workspaces.all(), 'list'] as const,
    detail: (id: string) => [...queryKeys.workspaces.all(), 'detail', id] as const,
    members: (id: string) => [...queryKeys.workspaces.all(), id, 'members'] as const,
  },

  // Notes
  notes: {
    all: (workspaceId: string) => ['notes', workspaceId] as const,
    list: (workspaceId: string, filters?: NoteFilters) =>
      [...queryKeys.notes.all(workspaceId), 'list', filters] as const,
    detail: (workspaceId: string, noteId: string) =>
      [...queryKeys.notes.all(workspaceId), 'detail', noteId] as const,
    content: (workspaceId: string, noteId: string) =>
      [...queryKeys.notes.all(workspaceId), noteId, 'content'] as const,
    versions: (workspaceId: string, noteId: string) =>
      [...queryKeys.notes.all(workspaceId), noteId, 'versions'] as const,
    backlinks: (workspaceId: string, noteId: string) =>
      [...queryKeys.notes.all(workspaceId), noteId, 'backlinks'] as const,
    search: (workspaceId: string, query: string, filters?: SearchFilters) =>
      [...queryKeys.notes.all(workspaceId), 'search', query, filters] as const,
    graph: (workspaceId: string) =>
      [...queryKeys.notes.all(workspaceId), 'graph'] as const,
  },

  // Tags
  tags: {
    list: (workspaceId: string) => ['tags', workspaceId, 'list'] as const,
  },

  // Plugins
  plugins: {
    search: (q: string, tags?: string[]) => ['plugins', 'search', q, tags] as const,
    installed: (workspaceId: string) => ['plugins', workspaceId, 'installed'] as const,
    settings: (workspaceId: string, pluginId: string) =>
      ['plugins', workspaceId, pluginId, 'settings'] as const,
  },

  // Layouts
  layouts: {
    list: (workspaceId: string) => ['layouts', workspaceId] as const,
  },
} as const;
```

### 2.3 TanStack Query Cache Configuration

```typescript
// shared/api/query-client.ts

export const queryClientConfig: QueryClientConfig = {
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,           // 30s — most data
      gcTime: 5 * 60 * 1000,          // 5min garbage collect
      retry: (count, error) => {
        if (error instanceof ApiError && error.status === 404) return false;
        if (error instanceof ApiError && error.status === 401) return false;
        return count < 2;
      },
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
};

// Specific overrides per query type:
// - Note list: staleTime 10s (frequently updated)
// - Graph data: staleTime 60s (expensive to compute)
// - Plugin registry: staleTime 5min (rarely changes)
// - Auth/me: staleTime 5min, refetchOnFocus false
```

### 2.4 URL State Strategy

```typescript
// URL state via nuqs — synchronized with browser URL
// Pattern: shallow routing for filters, modals, panel state

// Search page: ?q=query&folder=id&tag=name&sort=relevance
// Graph page: ?filter=tag:zettelkasten&layout=force
// Settings: /settings/appearance (path-based tabs)
// Command palette: ?cmd=1 (for shareability — rare)

// Implementation:
import { useQueryState, parseAsString, parseAsBoolean } from 'nuqs';

function useSearchState() {
  const [query, setQuery] = useQueryState('q', parseAsString.withDefault(''));
  const [folder, setFolder] = useQueryState('folder', parseAsString);
  const [tag, setTag] = useQueryState('tag', parseAsString);
  return { query, setQuery, folder, setFolder, tag, setTag };
}
```

---

## 3. Component Library (`packages/ui`)

All components are built on Radix UI primitives with `class-variance-authority` variants and Tailwind CSS 4.x. The library is consumed by `apps/web` and `apps/desktop`.

### Core Components

| Component | Variants | Key Props |
|-----------|----------|-----------|
| `Button` | `primary`, `secondary`, `destructive`, `outline`, `ghost`, `link` | `size`, `loading`, `asChild`, `leftIcon`, `rightIcon` |
| `IconButton` | `default`, `ghost`, `outline` | `size` (sm/md/lg), `tooltip`, `aria-label` |
| `Input` | `default`, `error` | `leftIcon`, `rightIcon`, `clearable`, `error` |
| `Textarea` | `default`, `error` | `autoResize`, `maxRows` |
| `Select` | `default`, `error` | `options`, `searchable`, `multi`, `clearable` |
| `Combobox` | `default`, `multi` | `options`, `onSearch`, `creatable`, `renderOption` |
| `Checkbox` | `default`, `indeterminate` | `label`, `description` |
| `Radio` | `default` | `group`, `options` |
| `Switch` | `default` | `label`, `description`, `onCheckedChange` |
| `Slider` | `default`, `range` | `min`, `max`, `step`, `formatValue` |
| `Label` | `default`, `required` | `htmlFor`, `tooltip` |
| `FormField` | — | `label`, `error`, `hint`, `required` |
| `Dialog` | `default`, `sheet`, `alert` | `size` (sm/md/lg/xl/full), `closeOnOverlay` |
| `Sheet` | `left`, `right`, `top`, `bottom` | `size` |
| `AlertDialog` | `destructive`, `info`, `warning` | `onConfirm`, `confirmLabel` |
| `Popover` | `default` | `trigger`, `side`, `align`, `sideOffset` |
| `Tooltip` | `default` | `content`, `side`, `delayDuration` |
| `HoverCard` | `default` | `trigger`, `openDelay` |
| `DropdownMenu` | `default` | `trigger`, `items`, `onSelect` |
| `ContextMenu` | `default` | `items`, `onOpenChange` |
| `Menubar` | `default` | `menus` |
| `NavigationMenu` | `default` | `items` |
| `Tabs` | `default`, `pills`, `underline` | `defaultValue`, `orientation` |
| `Accordion` | `single`, `multiple` | `collapsible`, `type` |
| `Collapsible` | `default` | `open`, `onOpenChange` |
| `Card` | `default`, `interactive`, `flat` | `padding` |
| `Badge` | `default`, `secondary`, `destructive`, `outline`, `success` | `size` |
| `Avatar` | `default`, `group` | `src`, `fallback`, `size`, `status` |
| `Separator` | `horizontal`, `vertical` | `decorative` |
| `ScrollArea` | `default` | `orientation`, `type` |
| `Skeleton` | `default`, `circle`, `text` | `width`, `height`, `lines` |
| `Spinner` | `default` | `size`, `label` |
| `Progress` | `default`, `striped` | `value`, `max`, `showLabel` |
| `Toast` | `default`, `success`, `error`, `warning` | `duration`, `action`, `onDismiss` |
| `Sonner` | — | Global toast provider |
| `Table` | `default`, `compact`, `striped` | `columns`, `data`, `sortable`, `selectable` |
| `DataTable` | `default` | `columns`, `data`, `pagination`, `globalFilter` |
| `Breadcrumb` | `default` | `items`, `separator`, `maxItems` |
| `Pagination` | `default` | `page`, `totalPages`, `onPageChange` |
| `Command` | `default` | `items`, `groups`, `placeholder`, `onSelect` |
| `Calendar` | `single`, `range`, `multiple` | `mode`, `selected`, `onSelect`, `locale` |
| `DatePicker` | `default`, `range` | `selected`, `onSelect`, `format` |
| `ColorPicker` | `default` | `value`, `onChange`, `presets`, `format` |
| `FileUpload` | `default`, `dropzone` | `accept`, `multiple`, `maxSize`, `onDrop` |
| `TreeView` | `default` | `data`, `onSelect`, `onExpand`, `renderNode` |
| `ResizablePanel` | `default` | `defaultSize`, `minSize`, `maxSize`, `direction` |
| `ResizablePanelGroup` | `horizontal`, `vertical` | `onLayout`, `autoSaveId` |
| `Kbd` | `default` | Single keyboard key display |
| `CodeBlock` | `default` | `language`, `code`, `showCopyButton`, `showLineNumbers` |
| `EmptyState` | `default` | `icon`, `title`, `description`, `action` |
| `ErrorBoundary` | `default` | `fallback`, `onError`, `resetKeys` |
| `VirtualList` | `default` | `items`, `itemHeight`, `renderItem`, `overscan` |

---

## 4. Editor Architecture (`libs/editor-core`)

### 4.1 TipTap Extension Stack

```typescript
// libs/editor-core/src/extensions/index.ts

export const coreExtensions = [
  // Official TipTap extensions
  StarterKit.configure({
    heading: { levels: [1, 2, 3, 4, 5, 6] },
    codeBlock: false,  // replaced by custom
    history: false,    // replaced by Yjs undo
  }),
  Underline,
  Subscript,
  Superscript,
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  Highlight.configure({ multicolor: true }),
  Typography,          // smart quotes, em dashes
  Placeholder.configure({ placeholder: "Write something, or press '/' for commands..." }),
  CharacterCount,
  Focus,               // track focused node

  // Tables
  Table.configure({ resizable: true }),
  TableRow,
  TableHeader,
  TableCell,

  // Lists
  TaskList,
  TaskItem.configure({ nested: true }),

  // Media
  Image.configure({ allowBase64: true, inline: true }),

  // Links
  Link.configure({
    openOnClick: false,
    autolink: true,
    HTMLAttributes: { rel: 'noopener noreferrer' },
  }),

  // Collaboration (Yjs)
  Collaboration.configure({ document: yjsDoc }),
  CollaborationCursor.configure({
    provider: yjsProvider,
    user: { name: currentUser.displayName, color: currentUser.color },
  }),

  // Custom extensions (see 4.2)
  WikiLinkExtension,
  CalloutExtension,
  CodeBlockWithHighlight,
  MathBlockExtension,
  EmbedExtension,
  BlockDragHandleExtension,
  SlashCommandExtension,
  FootnoteExtension,
  CommentExtension,
  FrontmatterExtension,
  MermaidExtension,
];
```

### 4.2 Custom Nodes

#### WikiLink Node

```typescript
// Node type: 'wikiLink'
// Input rule: [[
// Renders as: <span class="wiki-link" data-target="Note Title" data-alias="Display">
//             rendered link text with hover preview
// Properties:
interface WikiLinkAttrs {
  target: string;       // "Note Title"
  alias: string | null; // "Display Text" (from [[Note|Display]])
  heading: string | null; // "#Heading" anchor
  blockRef: string | null; // "^block-id"
  isEmbed: boolean;     // ![[Note]] transclusion
  isResolved: boolean;  // link target exists
}
```

#### Callout Node

```typescript
// Node type: 'callout'
// Markdown: > [!NOTE] Title
// Types: note, tip, warning, danger, info, success, quote, abstract, example
interface CalloutAttrs {
  type: 'note' | 'tip' | 'warning' | 'danger' | 'info' | 'success' | 'quote' | 'abstract' | 'example';
  title: string;
  collapsible: boolean;
  defaultOpen: boolean;
}
// Structure: callout > callout-title + callout-content (block container)
```

#### CodeBlock with Highlight

```typescript
// Node type: 'codeBlockHighlight'
// Replaces default codeBlock
// Uses lowlight (highlight.js) for syntax highlighting
// Supports 50+ languages via lowlight/all
interface CodeBlockAttrs {
  language: string;
  filename: string | null;
  showLineNumbers: boolean;
  highlightLines: number[];   // lines to emphasize
  diff: boolean;              // diff mode (+/-)
}
```

#### MathBlock Node

```typescript
// Node type: 'mathBlock' (block) + 'mathInline' (mark)
// Renders with KaTeX
// Input: $$ for block, $ for inline
interface MathBlockAttrs {
  katex: string;
}
// Inline renders as a non-editable span with source visible on click
```

#### TaskItem (enhanced)

```typescript
// Extends official TaskItem
// Adds: due date, assigned user, priority
interface TaskItemAttrs {
  checked: boolean;
  dueDate: string | null;  // ISO date
  assignee: string | null; // userId
  priority: 'low' | 'medium' | 'high' | null;
}
```

#### EmbedNode

```typescript
// Node type: 'embed'
// Handles: YouTube, Twitter/X, Vimeo, generic oEmbed
interface EmbedAttrs {
  url: string;
  provider: 'youtube' | 'twitter' | 'vimeo' | 'generic';
  embedHtml: string;   // server-resolved oEmbed HTML
  width: number | null;
  height: number | null;
  align: 'left' | 'center' | 'right';
}
```

#### Frontmatter Node

```typescript
// Node type: 'frontmatter'
// Position: always first node in document
// Renders as collapsed properties panel, not raw YAML
// Toggleable: click to expand/collapse
interface FrontmatterAttrs {
  yaml: string;        // raw YAML string
  collapsed: boolean;
}
```

### 4.3 Markdown Serializer Rules

```typescript
// libs/editor-core/src/serializer/markdown-serializer.ts
// Extends ProseMirror MarkdownSerializer

const customSerializerRules = {
  // WikiLink → [[target|alias]] or ![[target]]
  wikiLink: (state, node) => {
    const { target, alias, isEmbed } = node.attrs;
    const prefix = isEmbed ? '!' : '';
    const suffix = alias ? `|${alias}` : '';
    state.write(`${prefix}[[${target}${suffix}]]`);
  },

  // Callout → > [!TYPE] Title\n> content
  callout: (state, node) => {
    const { type, title } = node.attrs;
    state.write(`> [!${type.toUpperCase()}] ${title}\n`);
    state.renderContent(node, '> ');
  },

  // Math block → $$ \n formula \n $$
  mathBlock: (state, node) => {
    state.write(`$$\n${node.attrs.katex}\n$$`);
    state.closeBlock(node);
  },

  // Frontmatter → ---\nyaml\n---
  frontmatter: (state, node) => {
    state.write(`---\n${node.attrs.yaml}\n---\n`);
  },

  // TaskItem → - [ ] or - [x]
  taskItem: (state, node) => {
    state.write(node.attrs.checked ? '- [x] ' : '- [ ] ');
    state.renderInline(node);
    state.ensureNewLine();
  },

  // Embed → [embed](url)  — with provider metadata in HTML comment
  embed: (state, node) => {
    state.write(`[embed](${node.attrs.url})`);
    state.closeBlock(node);
  },
};
```

### 4.4 Slash Command Menu Items

```typescript
// libs/editor-core/src/slash-commands/items.ts

export const slashCommands: SlashCommandGroup[] = [
  {
    group: 'Basic Blocks',
    items: [
      { title: 'Text',           icon: 'Type',         command: 'setParagraph' },
      { title: 'Heading 1',      icon: 'Heading1',     command: 'setHeading', attrs: { level: 1 } },
      { title: 'Heading 2',      icon: 'Heading2',     command: 'setHeading', attrs: { level: 2 } },
      { title: 'Heading 3',      icon: 'Heading3',     command: 'setHeading', attrs: { level: 3 } },
      { title: 'Bulleted List',  icon: 'List',         command: 'toggleBulletList' },
      { title: 'Numbered List',  icon: 'ListOrdered',  command: 'toggleOrderedList' },
      { title: 'Task List',      icon: 'CheckSquare',  command: 'toggleTaskList' },
      { title: 'Quote',          icon: 'Quote',        command: 'toggleBlockquote' },
      { title: 'Divider',        icon: 'Minus',        command: 'setHorizontalRule' },
    ],
  },
  {
    group: 'Media',
    items: [
      { title: 'Image',          icon: 'Image',        command: 'insertImage' },
      { title: 'Embed',          icon: 'Link2',        command: 'insertEmbed' },
      { title: 'File',           icon: 'Paperclip',    command: 'insertFile' },
    ],
  },
  {
    group: 'Advanced',
    items: [
      { title: 'Code Block',     icon: 'Code',         command: 'setCodeBlock' },
      { title: 'Math Block',     icon: 'Sigma',        command: 'insertMathBlock' },
      { title: 'Callout',        icon: 'AlertCircle',  command: 'insertCallout' },
      { title: 'Table',          icon: 'Table',        command: 'insertTable', attrs: { rows: 3, cols: 3 } },
      { title: 'Mermaid Diagram',icon: 'GitBranch',    command: 'insertMermaid' },
      { title: 'Excalidraw',     icon: 'PenTool',      command: 'insertExcalidraw' },   // plugin
      { title: 'Kanban Board',   icon: 'Columns',      command: 'insertKanban' },        // plugin
      { title: 'Database',       icon: 'Database',     command: 'insertDatabase' },      // plugin
    ],
  },
  {
    group: 'Zettelkasten',
    items: [
      { title: 'Wiki Link',      icon: 'Link',         command: 'insertWikiLink' },
      { title: 'Note Embed',     icon: 'FileText',     command: 'insertNoteEmbed' },
      { title: 'Footnote',       icon: 'Superscript',  command: 'insertFootnote' },
      { title: 'Tag',            icon: 'Tag',          command: 'insertTag' },
    ],
  },
  {
    group: 'Templates',
    items: [
      { title: 'Insert Template',icon: 'Layout',       command: 'openTemplatePicker' }, // plugin
      { title: 'Daily Note',     icon: 'Calendar',     command: 'insertDailyNote' },    // plugin
    ],
  },
];
```

### 4.5 Keyboard Shortcuts (50+)

```typescript
// libs/editor-core/src/shortcuts/registry.ts

export const keyboardShortcuts: ShortcutDef[] = [
  // === FORMATTING ===
  { keys: 'Mod-b',           action: 'toggleBold',           label: 'Bold' },
  { keys: 'Mod-i',           action: 'toggleItalic',         label: 'Italic' },
  { keys: 'Mod-u',           action: 'toggleUnderline',      label: 'Underline' },
  { keys: 'Mod-Shift-s',     action: 'toggleStrike',         label: 'Strikethrough' },
  { keys: 'Mod-e',           action: 'toggleCode',           label: 'Inline Code' },
  { keys: 'Mod-Shift-h',     action: 'toggleHighlight',      label: 'Highlight' },
  { keys: 'Mod-.',           action: 'toggleSubscript',      label: 'Subscript' },
  { keys: 'Mod-Shift-.',     action: 'toggleSuperscript',    label: 'Superscript' },

  // === HEADINGS ===
  { keys: 'Mod-Alt-1',       action: 'setHeading1',          label: 'Heading 1' },
  { keys: 'Mod-Alt-2',       action: 'setHeading2',          label: 'Heading 2' },
  { keys: 'Mod-Alt-3',       action: 'setHeading3',          label: 'Heading 3' },
  { keys: 'Mod-Alt-4',       action: 'setHeading4',          label: 'Heading 4' },
  { keys: 'Mod-Alt-0',       action: 'setParagraph',         label: 'Normal Text' },

  // === BLOCKS ===
  { keys: 'Mod-Shift-b',     action: 'toggleBlockquote',     label: 'Blockquote' },
  { keys: 'Mod-Alt-c',       action: 'toggleCodeBlock',      label: 'Code Block' },
  { keys: 'Mod-Shift-7',     action: 'toggleOrderedList',    label: 'Numbered List' },
  { keys: 'Mod-Shift-8',     action: 'toggleBulletList',     label: 'Bullet List' },
  { keys: 'Mod-Shift-9',     action: 'toggleTaskList',       label: 'Task List' },

  // === ALIGNMENT ===
  { keys: 'Mod-Shift-l',     action: 'alignLeft',            label: 'Align Left' },
  { keys: 'Mod-Shift-e',     action: 'alignCenter',          label: 'Align Center' },
  { keys: 'Mod-Shift-r',     action: 'alignRight',           label: 'Align Right' },
  { keys: 'Mod-Shift-j',     action: 'alignJustify',         label: 'Justify' },

  // === EDITING ===
  { keys: 'Mod-z',           action: 'undo',                 label: 'Undo' },
  { keys: 'Mod-Shift-z',     action: 'redo',                 label: 'Redo' },
  { keys: 'Mod-a',           action: 'selectAll',            label: 'Select All' },
  { keys: 'Mod-c',           action: 'copy',                 label: 'Copy' },
  { keys: 'Mod-x',           action: 'cut',                  label: 'Cut' },
  { keys: 'Mod-v',           action: 'paste',                label: 'Paste' },
  { keys: 'Mod-Shift-v',     action: 'pasteWithoutFormat',   label: 'Paste Plain Text' },
  { keys: 'Tab',             action: 'indentList',           label: 'Indent' },
  { keys: 'Shift-Tab',       action: 'outdentList',          label: 'Outdent' },

  // === LINKS ===
  { keys: 'Mod-k',           action: 'openLinkModal',        label: 'Insert Link' },
  { keys: 'Mod-Shift-k',     action: 'insertWikiLink',       label: 'Insert Wiki Link' },

  // === TABLES ===
  { keys: 'Tab',             action: 'nextTableCell',        label: 'Next Cell', context: 'table' },
  { keys: 'Shift-Tab',       action: 'prevTableCell',        label: 'Previous Cell', context: 'table' },
  { keys: 'Mod-Alt-ArrowRight', action: 'addColumnAfter',   label: 'Add Column After' },
  { keys: 'Mod-Alt-ArrowLeft',  action: 'addColumnBefore',  label: 'Add Column Before' },
  { keys: 'Mod-Alt-ArrowDown',  action: 'addRowAfter',      label: 'Add Row After' },
  { keys: 'Mod-Alt-ArrowUp',    action: 'addRowBefore',     label: 'Add Row Before' },

  // === WORKSPACE ===
  { keys: 'Mod-p',           action: 'openCommandPalette',   label: 'Command Palette', global: true },
  { keys: 'Mod-o',           action: 'openQuickSwitcher',    label: 'Quick Switcher', global: true },
  { keys: 'Mod-Shift-f',     action: 'openGlobalSearch',     label: 'Global Search', global: true },
  { keys: 'Mod-n',           action: 'newNote',              label: 'New Note', global: true },
  { keys: 'Mod-Shift-n',     action: 'newNoteInNewPane',     label: 'New Note in New Pane', global: true },
  { keys: 'Mod-w',           action: 'closeTab',             label: 'Close Tab', global: true },
  { keys: 'Mod-Shift-w',     action: 'closePane',            label: 'Close Pane', global: true },
  { keys: 'Mod-\\',          action: 'splitVertical',        label: 'Split Vertically', global: true },
  { keys: 'Mod-Shift-\\',    action: 'splitHorizontal',      label: 'Split Horizontally', global: true },
  { keys: 'Mod-[',           action: 'navigateBack',         label: 'Navigate Back', global: true },
  { keys: 'Mod-]',           action: 'navigateForward',      label: 'Navigate Forward', global: true },
  { keys: 'Mod-,',           action: 'openSettings',         label: 'Open Settings', global: true },
  { keys: 'Mod-Shift-g',     action: 'openGraph',            label: 'Open Graph View', global: true },
  { keys: 'Mod-Shift-b',     action: 'toggleLeftSidebar',    label: 'Toggle Left Sidebar', global: true },
  { keys: 'Mod-Shift-e',     action: 'toggleRightSidebar',   label: 'Toggle Right Sidebar', global: true },
  { keys: 'Escape',          action: 'dismissModal',         label: 'Dismiss', global: true },
  { keys: 'Mod-Shift-p',     action: 'toggleFocusMode',      label: 'Focus Mode', global: true },
  { keys: 'F11',             action: 'toggleFullscreen',     label: 'Fullscreen', global: true },

  // === NAVIGATION (in editor) ===
  { keys: 'Mod-Home',        action: 'goToTop',              label: 'Go to Top' },
  { keys: 'Mod-End',         action: 'goToBottom',           label: 'Go to Bottom' },
  { keys: 'Mod-ArrowUp',     action: 'moveBlockUp',          label: 'Move Block Up' },
  { keys: 'Mod-ArrowDown',   action: 'moveBlockDown',        label: 'Move Block Down' },
  { keys: 'Mod-Enter',       action: 'insertBlockBelow',     label: 'Insert Block Below' },
  { keys: 'Mod-Shift-Enter', action: 'insertBlockAbove',     label: 'Insert Block Above' },
  { keys: 'Alt-ArrowUp',     action: 'swapBlockUp',          label: 'Swap Block Up' },
  { keys: 'Alt-ArrowDown',   action: 'swapBlockDown',        label: 'Swap Block Down' },
];
```

---

## 5. Window Management

### 5.1 Layout Data Model

The layout system maps exactly to `LayoutConfig` from `libs/contracts/src/workspace.ts`, extended with runtime state.

```typescript
// apps/web/src/features/workspace/model/layout.types.ts

/**
 * Serialized layout (persisted to server via /api/workspaces/:id/layouts)
 */
export interface LayoutConfig {
  panels: PanelConfig[];
  orientation: 'horizontal' | 'vertical';
}

export interface PanelConfig {
  id: string;                 // uuid
  type: PanelType;
  size: number;               // percentage 0–100
  minSize?: number;           // minimum percentage (default 10)
  tabs?: TabConfig[];         // present when type === 'editor'
  children?: {                // present when panel is a split container
    panels: PanelConfig[];
    orientation: 'horizontal' | 'vertical';
  };
}

export type PanelType =
  | 'editor'
  | 'graph'
  | 'kanban'
  | 'calendar'
  | 'excalidraw'
  | 'settings'
  | 'plugin';

export interface TabConfig {
  id: string;
  noteId?: string;
  pluginId?: string;
  title: string;
  icon?: string;
  isActive: boolean;
  isPinned: boolean;
  isDirty: boolean;           // unsaved changes indicator
  history: string[];          // noteIds — per-tab back/forward
  historyIndex: number;
}

/**
 * Runtime layout state (not persisted)
 */
export interface RuntimeLayoutState {
  config: LayoutConfig;
  resizingPanelId: string | null;
  draggedTabId: string | null;
  hoveredDropZone: DropZoneId | null;
  floatingWindows: FloatingWindow[];
}

export interface FloatingWindow {
  id: string;
  panelConfig: PanelConfig;
  position: { x: number; y: number };
  size: { width: number; height: number };
  isMinimized: boolean;
  zIndex: number;
}
```

### 5.2 Predefined Layout Templates

```typescript
// apps/web/src/features/workspace/lib/layout-templates.ts

export const LAYOUT_TEMPLATES: LayoutTemplate[] = [
  {
    id: 'single',
    name: 'Single Pane',
    icon: 'Square',
    config: {
      orientation: 'horizontal',
      panels: [{ id: 'main', type: 'editor', size: 100, tabs: [] }],
    },
  },
  {
    id: 'split-50-50',
    name: '50 / 50 Split',
    icon: 'Columns2',
    config: {
      orientation: 'horizontal',
      panels: [
        { id: 'left', type: 'editor', size: 50, tabs: [] },
        { id: 'right', type: 'editor', size: 50, tabs: [] },
      ],
    },
  },
  {
    id: 'split-70-30',
    name: '70 / 30 Split',
    icon: 'PanelRight',
    config: {
      orientation: 'horizontal',
      panels: [
        { id: 'main', type: 'editor', size: 70, tabs: [] },
        { id: 'side', type: 'editor', size: 30, tabs: [] },
      ],
    },
  },
  {
    id: 'split-30-70',
    name: '30 / 70 Split',
    icon: 'PanelLeft',
    config: {
      orientation: 'horizontal',
      panels: [
        { id: 'side', type: 'editor', size: 30, tabs: [] },
        { id: 'main', type: 'editor', size: 70, tabs: [] },
      ],
    },
  },
  {
    id: 'three-columns',
    name: '3 Columns',
    icon: 'Columns3',
    config: {
      orientation: 'horizontal',
      panels: [
        { id: 'left', type: 'editor', size: 33, tabs: [] },
        { id: 'center', type: 'editor', size: 34, tabs: [] },
        { id: 'right', type: 'editor', size: 33, tabs: [] },
      ],
    },
  },
  {
    id: 'grid-2x2',
    name: '2 × 2 Grid',
    icon: 'Grid2X2',
    config: {
      orientation: 'vertical',
      panels: [
        {
          id: 'top', type: 'editor', size: 50,
          children: {
            orientation: 'horizontal',
            panels: [
              { id: 'top-left', type: 'editor', size: 50, tabs: [] },
              { id: 'top-right', type: 'editor', size: 50, tabs: [] },
            ],
          },
        },
        {
          id: 'bottom', type: 'editor', size: 50,
          children: {
            orientation: 'horizontal',
            panels: [
              { id: 'bottom-left', type: 'editor', size: 50, tabs: [] },
              { id: 'bottom-right', type: 'editor', size: 50, tabs: [] },
            ],
          },
        },
      ],
    },
  },
  {
    id: 'editor-graph',
    name: 'Editor + Graph',
    icon: 'GitFork',
    config: {
      orientation: 'horizontal',
      panels: [
        { id: 'editor', type: 'editor', size: 65, tabs: [] },
        { id: 'graph', type: 'graph', size: 35, tabs: [] },
      ],
    },
  },
];
```

### 5.3 dnd-kit Snap Zones (Windows 11 Style)

```typescript
// apps/web/src/features/workspace/ui/PanelDropZone.tsx
// Activated when a tab/panel is dragged — shows visual snap targets

export type SnapZone =
  | 'center'          // drop on existing panel → merge as tab
  | 'left'            // split left 50%
  | 'right'           // split right 50%
  | 'top'             // split top 50%
  | 'bottom'          // split bottom 50%
  | 'left-third'      // split left 33%
  | 'right-third'     // split right 33%
  | 'top-third'       // split top 33%
  | 'bottom-third';   // split bottom 33%

// Snap zone rendering:
// - Zones appear as translucent overlays on existing panels while dragging
// - Color: accent/20 with accent border (2px)
// - Windows 11 snap layout picker appears after hovering edge for 300ms
// - Snap layout popup shows 6 predefined template icons

// dnd-kit setup:
// - useDraggable on each Tab (drag handle = tab chrome)
// - useDroppable on each Panel with 9 sub-zones (quadrant sensors)
// - DragOverlay for ghost tab visual
// - Collision detection: closestCenter with custom zone hit areas

// Edge detection thresholds:
const SNAP_ZONE_THRESHOLD = {
  edge: 80,          // px from panel edge to trigger left/right/top/bottom
  third: 120,        // px from edge to trigger third-splits
  center: 'remaining', // anything not matched → center (tab merge)
};
```

### 5.4 Resize Behavior

```typescript
// Resize handle: 4px invisible target, 1px visual separator
// On hover: separator becomes 2px accent color
// On drag: smooth resize with requestAnimationFrame
// Min panel size: 200px (absolute) or 10% (relative) — whichever is larger
// Behavior on resize below min: adjacent panel absorbs space; at minimum, resize blocked

// Implementation: react-resizable-panels (allotment alternative)
// - PanelGroup wraps sibling panels
// - PanelResizeHandle between each pair
// - Sizes stored as percentages in LayoutConfig.panels[n].size
// - autoSaveId not used (we persist to server, not localStorage)

// Keyboard resize:
// - Focus resize handle with Tab
// - Arrow keys: resize by 5% per press
// - Shift+Arrow: resize by 1%
```

### 5.5 Layout Persistence

```typescript
// Persistence strategy:
// 1. Optimistic local update → Zustand layout.store
// 2. Debounced (1000ms) POST to /api/workspaces/:id/layouts
// 3. On app mount: fetch layouts → load isDefault layout
// 4. Fallback: sessionStorage for unsaved draft layouts

// localStorage keys:
const STORAGE_KEYS = {
  ACTIVE_LAYOUT_ID: 'notesaner:layout:active',
  SIDEBAR_WIDTHS: 'notesaner:sidebar:widths',
  EXPANDED_FOLDERS: 'notesaner:sidebar:folders',
  LEFT_SIDEBAR_OPEN: 'notesaner:sidebar:left:open',
  RIGHT_SIDEBAR_OPEN: 'notesaner:sidebar:right:open',
} as const;
```

---

## 6. Routing

### 6.1 Route Map with Guards

```typescript
// All routes with their auth requirements and layout

const routes = [
  // === PUBLIC (no auth) ===
  {
    path: '/',
    component: 'HomePage',
    auth: 'none',
    redirect: 'If authenticated → /workspaces',
    layout: 'minimal',
  },
  {
    path: '/login',
    component: '(auth)/login/page.tsx',
    auth: 'none',
    redirect: 'If authenticated → /workspaces',
    layout: 'auth-card',
  },
  {
    path: '/register',
    component: '(auth)/register/page.tsx',
    auth: 'none',
    redirect: 'If authenticated → /workspaces',
    layout: 'auth-card',
  },
  {
    path: '/forgot-password',
    component: '(auth)/forgot-password/page.tsx',
    auth: 'none',
    layout: 'auth-card',
  },
  {
    path: '/reset-password',
    component: '(auth)/reset-password/page.tsx',
    auth: 'none',
    layout: 'auth-card',
    params: '?token=...',
  },
  {
    path: '/verify-email',
    component: '(auth)/verify-email/page.tsx',
    auth: 'none',
    layout: 'auth-card',
    params: '?token=...',
  },
  {
    path: '/sso/saml',
    component: '(auth)/sso/saml/page.tsx',
    auth: 'none',
    layout: 'auth-card',
    notes: 'Initiates SAML redirect; receives callback at /api/auth/saml/callback',
  },
  {
    path: '/sso/oidc',
    component: '(auth)/sso/oidc/page.tsx',
    auth: 'none',
    layout: 'auth-card',
  },

  // === PUBLIC VAULT (no auth) ===
  {
    path: '/public/:slug',
    component: 'public/[slug]/page.tsx',
    auth: 'none',
    layout: 'public-vault',
    rendering: 'ISR (revalidate: 60s)',
    notes: 'Published vault index',
  },
  {
    path: '/public/:slug/*path',
    component: 'public/[slug]/[...path]/page.tsx',
    auth: 'none',
    layout: 'public-vault',
    rendering: 'ISR (revalidate: 60s)',
    notes: 'Published note; path matches folder structure',
  },

  // === AUTHENTICATED WORKSPACE ROUTES ===
  {
    path: '/workspaces',
    component: '(workspace)/workspaces/page.tsx',
    auth: 'required',
    layout: 'workspace-picker',
    notes: 'Grid of workspace cards; redirects to last active if only one',
  },
  {
    path: '/workspaces/new',
    component: '(workspace)/workspaces/new/page.tsx',
    auth: 'required',
    layout: 'workspace-picker',
  },
  {
    path: '/workspaces/:workspaceId',
    component: '(workspace)/workspaces/[workspaceId]/page.tsx',
    auth: 'required',
    layout: 'workspace-shell',
    guard: 'WorkspaceMemberGuard',
    notes: 'Empty state; redirects to last opened note if available',
  },
  {
    path: '/workspaces/:workspaceId/notes/:noteId',
    component: '(workspace)/workspaces/[workspaceId]/notes/[noteId]/page.tsx',
    auth: 'required',
    layout: 'workspace-shell',
    guard: 'WorkspaceMemberGuard + NoteAccessGuard',
    notes: 'Primary editor route; noteId maps to tab in active panel',
  },
  {
    path: '/workspaces/:workspaceId/graph',
    component: '(workspace)/workspaces/[workspaceId]/graph/page.tsx',
    auth: 'required',
    layout: 'workspace-shell',
    guard: 'WorkspaceMemberGuard',
    notes: 'Full-screen graph view panel',
  },
  {
    path: '/workspaces/:workspaceId/search',
    component: '(workspace)/workspaces/[workspaceId]/search/page.tsx',
    auth: 'required',
    layout: 'workspace-shell',
    guard: 'WorkspaceMemberGuard',
    params: '?q=&folder=&tag=&sort=',
  },
  {
    path: '/workspaces/:workspaceId/plugins',
    component: '(workspace)/workspaces/[workspaceId]/plugins/page.tsx',
    auth: 'required',
    layout: 'workspace-shell',
    guard: 'WorkspaceMemberGuard',
    notes: 'Plugin marketplace browser',
  },
  {
    path: '/workspaces/:workspaceId/plugins/:pluginId',
    component: '(workspace)/workspaces/[workspaceId]/plugins/[pluginId]/page.tsx',
    auth: 'required',
    layout: 'workspace-shell',
    guard: 'WorkspaceMemberGuard',
  },

  // === SETTINGS ROUTES ===
  {
    path: '/workspaces/:workspaceId/settings',
    auth: 'required',
    layout: 'settings',
    guard: 'WorkspaceMemberGuard',
    redirect: 'Redirects to /settings/general',
  },
  {
    path: '/workspaces/:workspaceId/settings/general',
    component: 'settings/general/page.tsx',
    auth: 'required',
    guard: 'WorkspaceMemberGuard',
    layout: 'settings',
  },
  {
    path: '/workspaces/:workspaceId/settings/appearance',
    component: 'settings/appearance/page.tsx',
    auth: 'required',
    layout: 'settings',
  },
  {
    path: '/workspaces/:workspaceId/settings/editor',
    component: 'settings/editor/page.tsx',
    auth: 'required',
    layout: 'settings',
  },
  {
    path: '/workspaces/:workspaceId/settings/shortcuts',
    component: 'settings/shortcuts/page.tsx',
    auth: 'required',
    layout: 'settings',
  },
  {
    path: '/workspaces/:workspaceId/settings/sync',
    component: 'settings/sync/page.tsx',
    auth: 'required',
    layout: 'settings',
  },
  {
    path: '/workspaces/:workspaceId/settings/members',
    component: 'settings/members/page.tsx',
    auth: 'required',
    guard: 'AdminOrOwnerGuard',
    layout: 'settings',
  },
  {
    path: '/workspaces/:workspaceId/settings/plugins',
    component: 'settings/plugins/page.tsx',
    auth: 'required',
    layout: 'settings',
  },
  {
    path: '/workspaces/:workspaceId/settings/publish',
    component: 'settings/publish/page.tsx',
    auth: 'required',
    guard: 'AdminOrOwnerGuard',
    layout: 'settings',
  },
  {
    path: '/workspaces/:workspaceId/settings/danger',
    component: 'settings/danger/page.tsx',
    auth: 'required',
    guard: 'OwnerGuard',
    layout: 'settings',
  },

  // === ACCOUNT ROUTES ===
  {
    path: '/account/profile',
    component: '(workspace)/account/profile/page.tsx',
    auth: 'required',
    layout: 'account',
  },
  {
    path: '/account/security',
    component: '(workspace)/account/security/page.tsx',
    auth: 'required',
    layout: 'account',
    notes: 'Password change, 2FA setup, connected SSO providers',
  },
  {
    path: '/account/sessions',
    component: '(workspace)/account/sessions/page.tsx',
    auth: 'required',
    layout: 'account',
    notes: 'Active sessions with revoke capability',
  },
];
```

### 6.2 Route Guards (Middleware)

```typescript
// apps/web/src/app/middleware.ts  (Next.js middleware)

export function middleware(request: NextRequest) {
  const token = request.cookies.get('access_token');
  const { pathname } = request.nextUrl;

  const isAuthRoute = pathname.startsWith('/(auth)') ||
    ['/login', '/register', '/forgot-password', '/reset-password'].includes(pathname);
  const isPublicRoute = pathname.startsWith('/public/');
  const isApiRoute = pathname.startsWith('/api/');

  // Allow public routes and API routes through
  if (isPublicRoute || isApiRoute) return NextResponse.next();

  // Redirect unauthenticated users to login
  if (!token && !isAuthRoute) {
    return NextResponse.redirect(new URL(`/login?next=${pathname}`, request.url));
  }

  // Redirect authenticated users away from auth pages
  if (token && isAuthRoute) {
    return NextResponse.redirect(new URL('/workspaces', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons/).*)'],
};
```

---

## 7. Real-Time (Yjs)

### 7.1 Provider Setup

```typescript
// libs/sync-engine/src/yjs-provider.ts

export class NotesanerYjsProvider {
  private ydoc: Y.Doc;
  private wsProvider: WebsocketProvider;
  private idbProvider: IndexeddbPersistence;

  constructor(
    private readonly noteId: string,
    private readonly workspaceId: string,
    private readonly accessToken: string,
  ) {
    this.ydoc = new Y.Doc();

    // Offline persistence (IndexedDB) — loads first for instant restore
    this.idbProvider = new IndexeddbPersistence(
      `notesaner:${workspaceId}:${noteId}`,
      this.ydoc
    );

    // WebSocket provider — connects after idb loads
    this.idbProvider.whenSynced.then(() => {
      this.wsProvider = new WebsocketProvider(
        `${process.env.NEXT_PUBLIC_WS_URL}/sync`,
        `${workspaceId}:${noteId}`,
        this.ydoc,
        {
          params: { token: this.accessToken },
          connect: true,
          WebSocketPolyfill: undefined, // use native browser WS
        }
      );

      this.wsProvider.on('status', this.onStatusChange);
      this.wsProvider.awareness.on('change', this.onAwarenessChange);
    });
  }

  get doc(): Y.Doc { return this.ydoc; }
  get provider(): WebsocketProvider { return this.wsProvider; }
  get awareness(): Awareness { return this.wsProvider.awareness; }

  setLocalPresence(user: PresenceUser): void {
    this.wsProvider.awareness.setLocalStateField('user', user);
  }

  destroy(): void {
    this.wsProvider?.destroy();
    this.idbProvider?.destroy();
    this.ydoc.destroy();
  }
}
```

### 7.2 Cursor Rendering

```typescript
// features/sync/ui/CollaboratorCursors.tsx
// Uses @tiptap/extension-collaboration-cursor

// Cursor colors: deterministic from userId hash
export function getUserColor(userId: string): string {
  const colors = [
    '#E57373', '#F06292', '#BA68C8', '#7986CB',
    '#4FC3F7', '#4DB6AC', '#81C784', '#FFD54F',
    '#FF8A65', '#A1887F',
  ];
  const index = userId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return colors[index % colors.length];
}

// Cursor decorator renders:
// - Caret line: 2px colored vertical bar at cursor position
// - Name label: small pill above caret with user display name
// - Selection highlight: colored background with 40% opacity
// - Animation: fade in on appear, fade out after 3s of inactivity
```

### 7.3 Presence UI

```typescript
// features/sync/ui/PresenceAvatars.tsx
// Shown in the tab bar of the active note

interface PresenceAvatarsProps {
  noteId: string;
  max?: number;   // default 5 — overflow shows "+N"
}

// Each avatar:
// - UserAvatar component with colored ring matching cursor color
// - Tooltip: "DisplayName is viewing/editing"
// - Click: opens presence popover with full user list + "Go to cursor" button
// - Pulse animation when user is actively typing

// StatusBar presence:
// - Shows count of active collaborators: "3 people editing"
// - Click: opens same presence popover
```

### 7.4 Offline Handling

```typescript
// features/sync/ui/OfflineBanner.tsx
// Shown when WebSocket disconnects

// Banner content:
// - Icon: WifiOff
// - Text: "You're offline. Changes are saved locally and will sync when reconnected."
// - Optional: "Reconnect" button that retries the WebSocket connection
// - Disappears automatically when connection restored

// features/sync/lib/presence.ts
// Offline state detection:
window.addEventListener('online', () => syncStore.setOffline(false));
window.addEventListener('offline', () => syncStore.setOffline(true));

// Reconnection strategy:
// - wsProvider has built-in exponential backoff (y-websocket default)
// - On reconnect: Yjs auto-merges pending local changes with server state
// - No manual conflict resolution needed (CRDT guarantee)
// - Pending change count shown in StatusBar while offline
```

---

## 8. Theme System

### 8.1 CSS Custom Properties Architecture

```css
/* packages/ui/src/styles/tokens.css */

:root {
  /* === COLOR SYSTEM === */

  /* Backgrounds */
  --color-bg-base:          #1e1e2e;   /* main workspace background */
  --color-bg-surface:       #252537;   /* sidebar, panels */
  --color-bg-elevated:      #2d2d44;   /* cards, popovers */
  --color-bg-overlay:       #36365a;   /* modals, dropdowns */
  --color-bg-input:         #1a1a2e;   /* form inputs */
  --color-bg-hover:         rgba(255,255,255,0.05);
  --color-bg-active:        rgba(255,255,255,0.09);

  /* Text */
  --color-text-primary:     #cdd6f4;   /* main content */
  --color-text-secondary:   #a6adc8;   /* labels, hints */
  --color-text-muted:       #6c7086;   /* disabled, placeholders */
  --color-text-inverse:     #1e1e2e;   /* text on accent */

  /* Borders */
  --color-border:           rgba(255,255,255,0.08);
  --color-border-focus:     var(--color-accent);
  --color-border-error:     #f38ba8;

  /* Accent (user configurable) */
  --color-accent:           #89b4fa;   /* default: Catppuccin blue */
  --color-accent-hover:     #74a8f0;
  --color-accent-muted:     rgba(137,180,250,0.15);
  --color-accent-foreground: #1e1e2e;

  /* Semantic colors */
  --color-success:          #a6e3a1;
  --color-warning:          #fab387;
  --color-error:            #f38ba8;
  --color-info:             #89dceb;

  /* === SPACING (8pt grid) === */
  --space-1:  4px;
  --space-2:  8px;
  --space-3:  12px;
  --space-4:  16px;
  --space-5:  20px;
  --space-6:  24px;
  --space-8:  32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;

  /* === TYPOGRAPHY === */
  --font-sans:    'Inter Variable', system-ui, sans-serif;
  --font-mono:    'JetBrains Mono Variable', 'Fira Code', monospace;
  --font-serif:   'Lora', 'Georgia', serif;

  --text-xs:    12px;
  --text-sm:    13px;
  --text-base:  14px;   /* editor default */
  --text-md:    15px;
  --text-lg:    18px;
  --text-xl:    20px;
  --text-2xl:   24px;
  --text-3xl:   30px;

  --leading-tight:  1.25;
  --leading-normal: 1.5;
  --leading-relaxed: 1.75;  /* editor prose */

  /* === RADIUS === */
  --radius-sm:  4px;
  --radius-md:  6px;
  --radius-lg:  8px;
  --radius-xl:  12px;
  --radius-full: 9999px;

  /* === SHADOWS === */
  --shadow-sm:  0 1px 3px rgba(0,0,0,0.4);
  --shadow-md:  0 4px 12px rgba(0,0,0,0.5);
  --shadow-lg:  0 8px 24px rgba(0,0,0,0.6);
  --shadow-floating: 0 16px 48px rgba(0,0,0,0.7);

  /* === MOTION === */
  --ease-out:   cubic-bezier(0.22, 1, 0.36, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --duration-fast:   120ms;
  --duration-normal: 200ms;
  --duration-slow:   350ms;

  /* === LAYOUT === */
  --ribbon-width:        48px;
  --sidebar-width:       260px;
  --sidebar-min:         180px;
  --sidebar-max:         480px;
  --right-sidebar-width: 280px;
  --statusbar-height:    24px;
  --tabbar-height:       38px;
  --toolbar-height:      44px;
}
```

### 8.2 Light Theme Overrides

```css
/* packages/ui/src/styles/light.css */

[data-theme="light"] {
  --color-bg-base:      #fafafa;
  --color-bg-surface:   #f0f0f5;
  --color-bg-elevated:  #ffffff;
  --color-bg-overlay:   #ffffff;
  --color-bg-input:     #ffffff;
  --color-bg-hover:     rgba(0,0,0,0.04);
  --color-bg-active:    rgba(0,0,0,0.08);

  --color-text-primary:   #2d2d3a;
  --color-text-secondary: #5c5c7a;
  --color-text-muted:     #9999b3;
  --color-text-inverse:   #ffffff;

  --color-border:         rgba(0,0,0,0.1);
  --color-accent:         #1e6ef4;
  --color-accent-hover:   #1457cc;
  --color-accent-muted:   rgba(30,110,244,0.1);
  --color-accent-foreground: #ffffff;

  --shadow-sm:  0 1px 3px rgba(0,0,0,0.08);
  --shadow-md:  0 4px 12px rgba(0,0,0,0.12);
  --shadow-lg:  0 8px 24px rgba(0,0,0,0.15);
}
```

### 8.3 Obsidian-Like Palette (Default Dark)

The default dark theme is inspired by Catppuccin Mocha — the most popular Obsidian theme. Key aesthetic choices:

- Deep navy/purple background (`#1e1e2e`) — warmer than pure black, easier on eyes
- Cool blue accent (`#89b4fa`) — matches links, active state, focus rings
- Purple-tinted surfaces — gives "knowledge tool" rather than "code editor" feel
- High contrast text (`#cdd6f4`) — 7:1 against base background (AAA)
- Muted syntax colors for code blocks

### 8.4 Theme Provider Implementation

```typescript
// shared/lib/providers/ThemeProvider.tsx

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme, accentColor } = useSettingsStore();

  useEffect(() => {
    const root = document.documentElement;

    // Apply theme
    const resolvedTheme = theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      : theme;
    root.setAttribute('data-theme', resolvedTheme);

    // Apply accent color
    root.style.setProperty('--color-accent', accentColor);
    // Auto-derive hover and muted from accent
    root.style.setProperty('--color-accent-hover', darken(accentColor, 10));
    root.style.setProperty('--color-accent-muted', transparentize(accentColor, 0.85));
  }, [theme, accentColor]);

  return <>{children}</>;
}
```

---

## 9. i18n (next-intl)

### 9.1 File Structure

```
apps/web/src/
├── shared/i18n/
│   ├── routing.ts          # defineRouting({ locales, defaultLocale })
│   ├── navigation.ts       # createNavigation(routing) — typed Link, useRouter
│   └── request.ts          # getRequestConfig — server locale resolution
│
└── messages/
    ├── en.json             # English (default, source of truth)
    ├── de.json
    ├── fr.json
    ├── ja.json
    └── zh.json
```

### 9.2 Message Key Convention

```
{feature}.{component}.{element}[.{state}]

Examples:
  auth.login.title
  auth.login.emailLabel
  auth.login.passwordPlaceholder
  auth.login.submitButton
  auth.login.forgotPassword
  auth.login.error.invalidCredentials
  auth.login.error.tooManyAttempts

  editor.toolbar.bold
  editor.toolbar.italic
  editor.slashMenu.heading1
  editor.slashMenu.heading1.description

  workspace.sidebar.fileExplorer.emptyState.title
  workspace.sidebar.fileExplorer.emptyState.action

  settings.appearance.theme.label
  settings.appearance.theme.dark
  settings.appearance.theme.light
  settings.appearance.theme.system

  common.actions.save
  common.actions.cancel
  common.actions.delete
  common.actions.confirm
  common.errors.networkError
  common.errors.unauthorized
  common.time.justNow
  common.time.minutesAgo          # "{count} minutes ago" (plural)
```

### 9.3 Locale Configuration

```typescript
// shared/i18n/routing.ts
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'de', 'fr', 'ja', 'zh'],
  defaultLocale: 'en',
  localePrefix: 'as-needed',  // /en hidden, /de shown
});

// shared/i18n/request.ts  (server-side)
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as Locale)) {
    locale = routing.defaultLocale;
  }
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: 'UTC',
    now: new Date(),
  };
});
```

---

## 10. Performance

### 10.1 Code Splitting Boundaries

```
Boundary 1: Route level (automatic via Next.js App Router)
  - Each page.tsx = separate chunk
  - Layout.tsx shared within route group

Boundary 2: Feature level (dynamic imports)
  - Editor (TipTap): dynamic import — heavy (~400KB gzipped)
  - Graph panel: dynamic import — d3-force + WebGL (~200KB)
  - Command palette: dynamic import — loaded on first Cmd+P
  - Settings pages: dynamic import — not needed on initial load
  - Plugin sandbox: dynamic import per plugin

Boundary 3: Plugin level
  - Each plugin: loaded on demand from GitHub releases CDN
  - Excalidraw: ~1.5MB — only when first embed opened
  - Plugin code cached in localStorage after first load

Implementation:
  const NoteEditor = dynamic(() => import('@/features/editor/ui/NoteEditor'), {
    loading: () => <EditorSkeleton />,
    ssr: false,   // TipTap requires browser APIs
  });

  const GraphPanel = dynamic(() => import('@/widgets/graph-panel/ui/GraphPanel'), {
    loading: () => <GraphSkeleton />,
    ssr: false,
  });
```

### 10.2 Bundle Budgets

```
Target: Initial JS < 150KB gzipped for workspace shell

Breakdown:
  - Next.js runtime:      ~45KB
  - React + React DOM:    ~42KB
  - Zustand:              ~3KB
  - TanStack Query:       ~13KB
  - Radix primitives:     ~20KB (tree-shaken)
  - Tailwind:             ~5KB (purged)
  - next-intl runtime:    ~8KB
  - Shared utilities:     ~5KB
  - App shell code:       ~9KB
  ─────────────────────────────
  Total shell:           ~150KB ✓

  Deferred (lazy):
  - TipTap + extensions: ~380KB
  - D3 + graph:          ~190KB
  - KaTeX:               ~90KB
  - highlight.js (all):  ~220KB → use dynamic language loading instead
```

### 10.3 Prefetch Strategy

```typescript
// Route prefetching:
// - Next.js Link prefetches on hover (default behavior, keep enabled)
// - Workspace routes prefetched after auth confirmed
// - Settings prefetched after user enters workspace

// Data prefetching:
// Editor opens a note:
//   1. Prefetch note content (React Query prefetchQuery)
//   2. Prefetch backlinks
//   3. Prefetch adjacent notes in same folder (for quick navigation)

// Graph view:
//   - Prefetch graph data when user hovers graph icon in ribbon
//   - Cache for 60s (expensive endpoint)

// Search:
//   - Debounce 150ms before firing query
//   - Keep last 5 search results in cache for instant back-navigation

// Implementation:
function useNoteHoverPrefetch(noteId: string) {
  const queryClient = useQueryClient();
  return {
    onMouseEnter: () => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.notes.detail(workspaceId, noteId),
        queryFn: () => fetchNote(workspaceId, noteId),
        staleTime: 30_000,
      });
    },
  };
}
```

### 10.4 Core Web Vitals Targets

```
LCP (Largest Contentful Paint): < 1.8s (target: 1.2s)
  - Preload Inter Variable font
  - Use next/font for optimal loading
  - Skeleton screens prevent layout shift

FID/INP (Interaction to Next Paint): < 100ms
  - Editor input: Yjs updates on RAF, not synchronously
  - Search: debounced 150ms
  - All interactions: < 50ms main thread work

CLS (Cumulative Layout Shift): < 0.05
  - Fixed sidebar widths (no measurement flash)
  - Skeleton screens sized to match content
  - Images with explicit width/height

TTFB (Time to First Byte): < 600ms
  - Workspace shell: edge runtime middleware
  - Public pages: ISR with CDN
```

---

## 11. Design System Requirements for UI/UX Designer

This section enumerates every screen requiring design, with wireframe descriptions, component states, and responsive rules. Screens marked `[PRIORITY]` must be completed before engineering begins Wave 2.

---

### Screen 1: Login Page `[PRIORITY]`

**Route**: `/login`
**Layout**: Centered card (max-width 400px) on full-page background

**Wireframe description**:
- Top: Notesaner logo + wordmark centered
- Card: white/elevated surface with 24px padding
- Fields: Email input (full width), Password input (full width, with show/hide toggle)
- CTA: Primary "Sign In" button (full width)
- Links: "Forgot password?" (right-aligned below password), "Create account" (below button)
- Divider: "or continue with" (if SSO providers exist)
- SSO buttons: Icon + label buttons for each configured provider (SAML, OIDC, Google)
- Bottom: "Self-hosted instance" link for help

**Component states**:
- Default: empty form
- Filling: labels animate above inputs (floating label pattern)
- Loading: button shows spinner, inputs disabled
- Error: red border on fields, error message below form
- SSO redirect: full-page loading spinner with "Redirecting to your identity provider..."

**Responsive rules**:
- Mobile: full-width card, no decorative background pattern
- Tablet/Desktop: centered card on subtle background (CSS noise or gradient)

---

### Screen 2: Register Page `[PRIORITY]`

**Route**: `/register`
**Layout**: Same as Login

**Fields**: Display name, Email, Password, Confirm password
**Additions**: Password strength meter, Terms of service checkbox
**States**: Same as Login + validation inline

---

### Screen 3: Forgot Password / Reset Password

Two steps:
1. `/forgot-password`: Email input + "Send reset link" button + success state (email sent illustration)
2. `/reset-password?token=...`: New password + confirm + submit

---

### Screen 4: SSO Providers List Page

When multiple SSO providers are configured, show a full-page provider picker:
- List of SSO provider cards (icon + name + description)
- "Or sign in with email" link at bottom

---

### Screen 5: Main Workspace `[PRIORITY]`

**Route**: `/workspaces/:id`
**Layout**: Full viewport, no scroll on shell

```
┌─────────────────────────────────────────────────────────────────┐
│ [Ribbon 48px] │ [Left Sidebar 260px] │ [Editor Area] │ [Right Sidebar 280px] │
│               │                      │               │                        │
│  [Icons]      │ [Tab: Files/Search]  │ [Tab Bar]     │ [Tab: Outline]         │
│               │                      │ ─────────────  │                        │
│  File         │  ┌──────────┐        │ [Editor       │ [Outline headings]     │
│  Search       │  │ Folder   │        │  content]     │                        │
│  Graph        │  │  Note 1  │        │               │                        │
│  Bookmarks    │  │  Note 2  │        │               │                        │
│  Tags         │  └──────────┘        │               │                        │
│               │                      │               │                        │
│ ─────         │                      │               │                        │
│  Settings     │                      │               │                        │
│  [User]       │                      │               │                        │
├─────────────────────────────────────────────────────────────────────────────  │
│ [Status Bar: sync status | word count | cursor position | mode]               │
└─────────────────────────────────────────────────────────────────────────────  ┘
```

**Ribbon icons** (top-to-bottom): New Note, File Explorer, Search, Graph, Bookmarks, Tags. Bottom: Settings, User avatar.

**States**:
- Empty workspace (no notes): center illustration with "Create your first note" CTA
- Sidebar collapsed: editor area expands, toggle button visible on edge
- Split pane: two editor areas side by side with resize handle
- Focus mode: sidebars hidden, toolbar hidden, only editor visible

**Responsive rules**:
- Desktop (≥1280px): full layout as above
- Laptop (≥1024px): right sidebar collapsed by default
- Tablet (≥768px): left sidebar as drawer (slide over), no right sidebar
- Mobile (<768px): full-screen editor; sidebars as bottom sheet; ribbon as bottom nav bar

---

### Screen 6: Note Editor `[PRIORITY]`

**Embedded within**: Workspace editor area panel

**Layout description**:
- Fixed toolbar at top of editor panel (or floating, per setting)
- Note title: large editable H1 at top of editor
- Editor canvas: full width, constrained max-width (680px centered, configurable)
- Block drag handles: appear on left on hover (subtle, 20px wide)
- Frontmatter bar: collapsible properties section at very top

**Toolbar contents**:
```
[Undo][Redo] | [B][I][U][S][Code] | [H1][H2][H3] | [Align] | [Link][WikiLink] |
[Image][Embed] | [Table] | [Color] | [Comment] | [Publish toggle] | [Share]
```

**Floating selection toolbar** (appears on text select):
`[B][I][U][S][Code][Link][Highlight][Comment]` — small pill above selection

**States**:
- Empty: placeholder text "Write something, or press '/' for commands..."
- Typing: cursor visible, no toolbar by default unless text selected
- Loading: skeleton lines of varying width
- Read-only (Viewer role): no cursor, toolbar hidden, selection still works
- Focus mode: all chrome hidden except editor content

**Collaborative states**:
- Collaborator cursor: colored caret + name pill
- Collaborator selection: colored highlight range
- Comment anchor: underline + marker icon in margin
- Saving: subtle "Saving..." in status bar
- Saved: "Saved" checkmark fades in/out in status bar

---

### Screen 7: File Explorer Sidebar `[PRIORITY]`

**Panel**: Left sidebar, "Files" tab

**Layout**:
- Search bar at top (filter tree)
- Toolbar: New Note, New Folder, Sort options (chevron menu)
- Tree view:
  - Folder nodes: chevron + folder icon + name + count badge on hover
  - File nodes: doc icon + name + modified date (on hover)
  - Indent: 16px per level
  - Active note: highlighted with accent background
  - Context menu on right-click: Rename, Move, Duplicate, Share, Delete

**States**:
- Empty vault: illustration + "Create your first note" button
- Filtered: non-matching nodes hidden, matching highlighted
- Drag in progress: drag ghost + drop zone indicator on folders
- Rename inline: node becomes input field with save/cancel

---

### Screen 8: Graph View `[PRIORITY]`

**Route**: `/workspaces/:id/graph` or as a panel

**Layout**:
```
┌─────────────────────────────────────────────┐
│ [Toolbar: Search | Filter | Layout | Zoom]  │
│ ─────────────────────────────────────────── │
│                                             │
│     ○────○                                  │
│    ╱      ╲                                 │
│  ○          ○──────○                        │
│    ╲      ╱         ╲                       │
│     ○────○            ○                     │
│                                             │
│ [Mini-map bottom-right]                     │
│ [Legend bottom-left: color = tag]           │
└─────────────────────────────────────────────┘
```

**Node states**:
- Default: filled circle, size by connection count
- Hovered: enlarged, shows note title label + preview card
- Selected: accent border ring
- Active (currently open note): accent fill
- Orphan: dimmed/gray
- Filtered out: invisible or very dim

**Interactions**:
- Click node: open note in editor
- Right-click: context menu (Open, Open in New Pane, Create Link, Delete)
- Drag node: reposition in saved layout mode
- Draw edge: click node + drag to target node → creates wiki link
- Scroll: zoom
- Two-finger pinch: zoom
- Click empty space: deselect all
- Box-select: drag on empty space to multi-select

**Filter panel** (collapsible side panel):
- Tag filter: multi-select tag chips
- Folder filter: folder picker
- Date range
- Show orphans toggle
- Link type filter (when typed links feature active)

---

### Screen 9: Command Palette `[PRIORITY]`

**Trigger**: Cmd+P overlay, full-screen backdrop

**Layout**:
```
┌────────────────────────────────────────┐
│ [Search input with Cmd+P icon]         │
├────────────────────────────────────────┤
│ Recently opened                        │
│  [icon] Note Title                  ↵  │
│  [icon] Another Note                ↵  │
├────────────────────────────────────────┤
│ Commands                               │
│  [icon] New Note           Cmd+N    ↵  │
│  [icon] Split Vertically   Cmd+\   ↵  │
│  [icon] Open Settings      Cmd+,   ↵  │
└────────────────────────────────────────┘
```

- Groups: Recent notes, All commands, Navigate to note
- Keyboard: Arrow up/down to navigate, Enter to execute, Esc to close
- Filter: typing filters all groups simultaneously
- Shows keyboard shortcut on right of each item
- Max height: 480px, scroll if more results

---

### Screen 10: Search Results `[PRIORITY]`

**Route**: `/workspaces/:id/search?q=...` or Cmd+Shift+F overlay

**Layout** (as full-page):
```
┌──────────────────────────────────────────────────────┐
│ [Search input: "query"] [Filters chevron] [X clear]  │
├──────────────────┬───────────────────────────────────┤
│ [Filters panel]  │ [Results list]                    │
│                  │                                    │
│ Folder: [all ▾] │  Note Title               3 min ago│
│ Tag: [select]   │  ...matching context snippet...     │
│ Date: [range]   │  /Folder/Path                       │
│ Sort: [relevance]│                                    │
│                  │  Note Title 2             Yesterday│
│                  │  ...context snippet...              │
└──────────────────┴───────────────────────────────────┘
```

**States**:
- Empty query: shows recent searches + recent notes
- Typing: debounced results update in place
- No results: illustration + "Try different keywords" + suggestions
- Loading: skeleton result items

---

### Screen 11: Settings Pages `[PRIORITY]`

**Layout**: Full-page split — left nav (200px) + right content (scrollable)

**Navigation items**:
```
Workspace
  General
  Appearance
  Editor
  Keyboard Shortcuts
  Sync
  Members          (Admin/Owner only)
  Plugins
  Publishing       (Admin/Owner only)
  Danger Zone      (Owner only)
```

**11a. General Settings**:
- Workspace name (editable)
- Workspace slug (editable, with availability check)
- Description (textarea)
- Language (dropdown)
- Date format (dropdown with preview)
- Default editor mode (WYSIWYG / Source / Preview)

**11b. Appearance Settings**:
- Theme: Light / Dark / System (3 visual cards)
- Accent color: color picker grid + custom hex input
- Font family: Sans / Serif / Monospace (preview cards with sample text)
- Font size: slider (12–20px)
- Editor width: slider (600–1200px, shows "narrow / wide")
- Line spacing: selector (compact / normal / relaxed)
- Show line numbers: toggle

**11c. Editor Settings**:
- Spell check: toggle
- Vim mode: toggle
- Auto-save interval: dropdown (500ms / 1s / 2s / 5s)
- Tab size: 2 or 4 spaces
- Smart quotes: toggle
- Auto-close brackets: toggle
- Default new note template: note picker

**11d. Keyboard Shortcuts Settings**:
- Table: Action | Default shortcut | Custom shortcut
- Click shortcut cell → key capture mode (record new shortcut)
- "Reset to defaults" button per row and globally
- Filter input to search actions

**11e. Sync Settings**:
- Connection status indicator (connected / disconnected)
- WebSocket URL (admin configurable)
- Offline mode toggle
- "Clear local cache" button with confirmation

**11f. Members Settings** (Admin/Owner):
- Member table: Avatar | Name | Email | Role | Joined | Actions
- Invite: email input + role selector + "Send invite" button
- Pending invites section
- Role change: dropdown inline in table
- Remove member: confirmation dialog

**11g. Plugins Settings**:
- List of installed plugins: icon + name + version + enabled toggle + settings + uninstall
- "Browse marketplace" button → navigates to `/plugins`

**11h. Publishing Settings** (Admin/Owner):
- Enable publishing: main toggle
- Public URL slug: text input + preview of URL
- Custom domain: text input
- Theme: dropdown (default themes + imported themes)
- Enable search: toggle
- Enable graph view: toggle
- Enable comments: toggle
- Notes published: count + "Manage" link

**11i. Danger Zone**:
- Delete all notes: destructive button with type-to-confirm dialog
- Delete workspace: destructive button with type-to-confirm dialog
- Export vault: download as .zip of MD files

---

### Screen 12: Plugin Marketplace

**Route**: `/workspaces/:id/plugins`

**Layout**:
```
┌────────────────────────────────────────────────────────────┐
│ [Search: "Search plugins..."] [Tags: All | Editor | ...] │
├────────────────────────────────────────────────────────────┤
│ [Installed tab] [All tab] [Categories]                     │
├────────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│ │ Plugin   │ │ Plugin   │ │ Plugin   │ │ Plugin   │      │
│ │ [icon]   │ │ [icon]   │ │ [icon]   │ │ [icon]   │      │
│ │ Name     │ │ Name     │ │ Name     │ │ Name     │      │
│ │ Author   │ │ Author   │ │ Author   │ │ Author   │      │
│ │ ★4.8(92) │ │ ★4.2(14) │ │ ★5.0(3)  │ │ New      │      │
│ │[Install] │ │[Installed]│ │[Install] │ │[Install] │      │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
└────────────────────────────────────────────────────────────┘
```

**Plugin Card states**: Available, Installing (spinner), Installed (green badge + "Settings"), Update available

**Plugin Detail** (sheet/modal):
- Large icon + name + author + version + stars/downloads
- Description (markdown rendered)
- Screenshots carousel
- Permissions list (what the plugin can access)
- Changelog tab
- Install / Uninstall / Update button

---

### Screen 13: Public Published View

**Route**: `/public/:slug` and `/public/:slug/*path`

**Layout** (no auth, SEO-friendly):
```
┌──────────────────────────────────────────────────────────────┐
│ [Site header: vault name | search icon | theme toggle]       │
├───────────────────┬──────────────────────────────────────────┤
│ [Navigation tree] │ [Note content rendered as HTML]          │
│                   │                                          │
│ Folder            │  # Note Title                            │
│   Note 1          │                                          │
│   Note 2          │  Content...                              │
│ Folder 2          │                                          │
│   Note 3          │  [Table of contents floating right]      │
│                   │                                          │
├───────────────────┴──────────────────────────────────────────┤
│ [Footer: powered by Notesaner | edit this page link]         │
└──────────────────────────────────────────────────────────────┘
```

**States**:
- Note found: rendered content
- 404: custom "Note not found" page consistent with vault theme
- Private: "This note is not published" message

**Responsive**: Mobile collapses nav tree to hamburger drawer

---

### Screen 14: Note Properties Panel

**Panel**: Right sidebar, "Properties" tab

**Content**:
- Title (editable, synced with note H1)
- Tags: tag input with autocomplete
- Created date (read-only)
- Modified date (read-only)
- Author
- Status: dropdown (Draft / In Progress / Done / Archived)
- Custom frontmatter fields: key-value editor (add/remove rows)
- Aliases: editable list

---

### Screen 15: Backlinks Panel

**Panel**: Right sidebar, "Backlinks" tab

**Content**:
- Count: "5 notes link here"
- List of linking notes:
  - Note title (clickable → navigate)
  - Context snippet showing surrounding text of the link
  - Expand to see multiple mentions in same note
- Unlinked Mentions section (collapsed by default):
  - Notes mentioning this title without a wiki link
  - "Link" button on each to create the wiki link

---

### Screen 16: Outline Panel

**Panel**: Right sidebar, "Outline" tab

**Content**:
- Tree of headings (H1–H6) from current note
- Click heading → scroll editor to that heading
- Active heading highlighted (intersection observer)
- Collapse/expand sub-headings

---

### Screen 17: Comments Panel and Inline Comments

**Inline in editor**:
- Comment anchor: underline + small speech bubble icon in right margin
- Click icon: expands comment thread inline or in right sidebar

**Right sidebar Comments tab**:
- List of all comment threads in current note
- Each thread: avatar + author name + text + timestamp + reply count
- Resolved threads: collapsed, "Resolved" badge
- New comment: floating button appears when text selected in editor

**Comment thread card**:
- Original comment with resolve / reply actions
- Reply list (nested, max 2 levels)
- @mention autocomplete in reply input
- Resolve button → marks thread resolved, strikethrough styling

---

### Screen 18: Version History Modal

**Trigger**: Note menu → "View history"
**Layout**: Full-screen or large modal

- Left: timeline list of versions (date + author + word count delta)
- Right: diff view (additions green, deletions red)
- Actions: "Restore this version" button

---

### Screen 19: Share Note Modal

**Trigger**: Share button in editor toolbar
**Layout**: Sheet from right

- Share with workspace members: search input + role picker + invite
- Share link: toggle to create guest link (read-only)
- Guest link: copy to clipboard + optional expiry date
- Currently shared with: list of users with role + revoke button

---

### Screen 20: Presence Popover

**Trigger**: Clicking presence avatars in tab bar
**Layout**: Small popover

- List of active users in current note
- Each: avatar + name + "Viewing" or "Editing" status
- "Go to cursor" button jumps editor to their cursor position

---

### Screen 21: Workspace Picker / Landing

**Route**: `/workspaces`

- Grid of workspace cards (name + description + member count + last modified)
- "Create workspace" card at end of grid
- Each card: hover shows "Open" button

---

### Screen 22: New/Rename Note Dialog

**Trigger**: New Note button or rename action in file explorer
**Layout**: Small dialog (400px)

- Title input (focused on open)
- Location picker: folder selector (breadcrumb style)
- Template picker (optional)
- Cancel / Create buttons

---

### Screen 23: Delete Confirmation Dialogs

Standard pattern for destructive actions:
- AlertDialog with destructive variant
- Title: "Delete [item name]?"
- Description: explains consequences (links will break, etc.)
- Cancel button (default focus) + Delete button (destructive red)
- For workspace deletion: type-to-confirm input

---

### Screen 24: Onboarding Flow (First-Time User)

**Trigger**: After first login with empty workspace

Multi-step modal or full-page flow:
1. Welcome: "Welcome to Notesaner" + brief value prop
2. Theme picker: light/dark choice with live preview
3. Import: "Import from Obsidian vault" (zip upload) or "Start fresh"
4. First note: opens editor with template note showing key features
5. Done: dismiss + tooltip tour overlay (optional)

---

## 12. Open-Source References

### Novel (TipTap + shadcn/ui)

- **Repo**: `steven-tey/novel`
- **What to copy**:
  - Slash command implementation pattern (`/` trigger → popover with fuzzy search)
  - Bubble menu (floating toolbar on selection) component structure
  - AI autocomplete suggestion overlay (for future AI plugin)
  - TipTap + shadcn/ui wiring patterns
- **Key files**: `packages/novel/src/extensions/slash-command.tsx`, `bubble-menu.tsx`

### Obsidian CSS Patterns

- **Source**: Obsidian's published CSS variables (community themes on GitHub)
- **What to adopt**:
  - Variable naming convention: `--text-normal`, `--background-primary`, `--interactive-accent` — map to our tokens
  - Ribbon icon strip spacing and hover states
  - Workspace shell proportions (ribbon 48px, sidebar 260px default)
  - Split pane separator (1px, 4px hover target)
  - Status bar height (24px) and font size (12px)
  - File explorer indentation and icon sizing
- **Reference themes**: Minimal, AnuPpuccin, Catppuccin

### react-resizable-panels (allotment alternative)

- **Package**: `react-resizable-panels` by Bryan Vaughn
- **Why over allotment**: Better TypeScript support, smaller bundle, active maintenance
- **What to use**:
  - `PanelGroup` + `Panel` + `PanelResizeHandle` for split pane layout
  - `storage` prop for persistence hook (we replace with server persistence)
  - `onLayout` callback for size change → dispatch to layout store

### react-force-graph for Knowledge Graph

- **Package**: `react-force-graph` (wraps d3-force)
- **Also consider**: `@react-sigma/core` (sigma.js — better performance for large graphs)
- **What to use**:
  - `ForceGraph2D` for standard view
  - `ForceGraph3D` via `three-forcegraph` for immersive mode (future)
  - Custom node rendering via `nodeCanvasObject` prop (canvas-based, no DOM overhead)
  - `linkDirectionalArrowLength` for directed edges (typed links)
- **Performance notes**:
  - For graphs >500 nodes: enable `enableNodeDrag={false}` until layout stabilizes
  - Use `warmupTicks` to pre-simulate before render
  - WebGL renderer via `ForceGraph2D` with `renderer="webgl"` flag (experimental but fast)

### Additional References

| Library | Purpose | Notes |
|---------|---------|-------|
| `cmdk` | Command palette base | Used by shadcn/ui Command component |
| `vaul` | Drawer (mobile sheets) | Better than Radix Dialog on mobile |
| `react-hotkeys-hook` | Keyboard shortcut registration | Simpler than raw event listeners |
| `motion` (Framer Motion v12) | Animations | Use sparingly — only for sidebar, panels |
| `@xyflow/react` | Alternative to force-graph for smaller graphs | React Flow — better for structured layouts |
| `tiptap-markdown` | TipTap ↔ Markdown serialization | Saves reimplementing serializer from scratch |
| `y-prosemirror` | Lower-level Yjs ProseMirror binding | Used internally by TipTap collaboration ext |
| `react-virtual` (TanStack Virtual) | Virtual scrolling for file explorer with 10k+ files | |
| `shiki` | Syntax highlighting (alternative to lowlight) | Better language support, WASM-based |

---

*End of Frontend Architecture Specification*

*Next steps for engineering: implement in order — shared/ui components → workspace shell → editor → state management → real-time sync → graph → plugins.*
