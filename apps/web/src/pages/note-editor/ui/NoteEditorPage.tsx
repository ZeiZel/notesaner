'use client';

/**
 * NoteEditorPage — client component that composes the editor toolbar with
 * the mode-aware editor surface.
 *
 * Reads the current editor mode from the Zustand store and renders:
 *   - A toolbar with breadcrumb navigation and the EditorModeToggle button
 *   - The EditorModeWrapper which renders the appropriate editor surface
 *
 * No useEffect for data syncing — the markdown content is loaded once from
 * a placeholder string and managed by the editor-mode-store thereafter.
 */

import {
  useEditorModeStore,
  EditorModeToggle,
  EditorModeWrapper,
  useNoteCssClass,
} from '@/features/editor';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';
import { NoteBreadcrumb } from '@/features/workspace/ui/NoteBreadcrumb';
import { useWorkspaceStore } from '@/shared/stores/workspace-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NoteEditorPageProps {
  workspaceId: string;
  noteId: string;
}

// ---------------------------------------------------------------------------
// Sample content for demo purposes
// ---------------------------------------------------------------------------

const DEMO_MARKDOWN = `# Welcome to Notesaner

This is a **demo note** that showcases the different editor modes available.

## Features

- **WYSIWYG Mode**: Rich-text editing with TipTap
- **Source Mode**: Plain Markdown editing with CodeMirror
- **Live Preview**: Split view with source and rendered preview
- **Reading Mode**: Distraction-free reading with adjustable typography

## Getting Started

Use \`Cmd+E\` to cycle between edit modes, or \`Cmd+Shift+E\` to toggle reading mode.

### Code Example

\`\`\`typescript
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
\`\`\`

> "The best way to predict the future is to invent it." — Alan Kay

## Links and Formatting

Check out the [Notesaner documentation](https://notesaner.dev) for more details.

You can use **bold**, *italic*, ~~strikethrough~~, and \`inline code\` formatting.

---

This note is stored as a Markdown file on the filesystem — the file is the source of truth.
`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NoteEditorPage({
  workspaceId: _workspaceId,
  noteId: _noteId,
}: NoteEditorPageProps) {
  // workspaceId and noteId will be used for loading note content from server.
  // For now, we use demo markdown content from the store.
  void _workspaceId;
  void _noteId;

  const mode = useEditorModeStore((s) => s.mode);
  const markdown = useEditorModeStore((s) => s.markdown);
  const setMarkdown = useEditorModeStore((s) => s.setMarkdown);
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);

  // Derive CSS class from frontmatter `cssClass` / `cssclass` property.
  // Applied to the editor container for per-note styling.
  const noteCssClass = useNoteCssClass();

  // Hydrate the markdown store with demo content if empty.
  // This is a derived decision, not an effect — it happens synchronously
  // on the first render where markdown is empty.
  if (markdown === '' && typeof window !== 'undefined') {
    // Use queueMicrotask to avoid setState during render warning
    queueMicrotask(() => setMarkdown(DEMO_MARKDOWN));
  }

  const breadcrumb = ['Workspace', 'Untitled note'];
  const isReading = mode === 'reading';

  // Demo note path — will be replaced with real note data when server integration lands.
  const demoNotePath = 'Untitled note';
  const workspaceName = activeWorkspace?.name ?? 'Workspace';

  return (
    <div className={`flex h-full flex-col${noteCssClass ? ` ${noteCssClass}` : ''}`}>
      {/* Breadcrumb toolbar — hidden in reading mode (ReadingModeView has its own) */}
      {!isReading && (
        <div className="flex h-11 items-center justify-between border-b border-border px-4">
          <NoteBreadcrumb
            workspaceName={workspaceName}
            notePath={demoNotePath}
            className="min-w-0 flex-1 mr-4"
          />

          <div className="flex items-center gap-2 shrink-0">
            {/* Word count (visible in all edit modes) */}
            <span className="text-xs text-foreground-muted">
              {countWords(markdown).toLocaleString()} words
            </span>

            {/* Editor mode toggle */}
            <EditorModeToggle />
          </div>
        </div>
      )}

      {/* Editor surface — renders based on active mode, isolated by error boundary */}
      <ErrorBoundary moduleName="Editor" remountOnRetry>
        <EditorModeWrapper title="Untitled note" breadcrumb={breadcrumb} className="flex-1" />
      </ErrorBoundary>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function countWords(text: string): number {
  const stripped = text.replace(/[#*_`~\[\]()>!|-]/g, ' ').trim();
  if (stripped.length === 0) return 0;
  return stripped.split(/\s+/).length;
}
