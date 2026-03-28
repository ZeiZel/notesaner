'use client';

/**
 * EditorModeWrapper — orchestrates which editor surface to render based on
 * the current mode from the editor-mode-store.
 *
 * This is the single entry point for the note editing area. It reads the
 * active mode and renders the appropriate component:
 *
 *   - wysiwyg:  TipTap editor (placeholder until TipTap is integrated)
 *   - source:   CodeMirror SourceModeEditor
 *   - preview:  LivePreviewEditor (split: source + rendered)
 *   - reading:  ReadingModeView
 *
 * Content synchronization:
 *   - A shared `markdown` string in the editor-mode-store acts as the source
 *     of truth when switching modes.
 *   - Each editor surface reads from and writes to this shared string.
 *   - On mode switch, the outgoing editor's content is already in the store
 *     (via onChange), so the incoming editor picks it up seamlessly.
 *
 * No useEffect for mode switching — mode is a Zustand selector, and the
 * component renders the correct surface immediately based on the current value.
 */

import { useEditorModeStore } from '../model/editor-mode.store';
import { SourceModeEditor } from './SourceModeEditor';
import { LivePreviewEditor } from './LivePreviewEditor';
import { ReadingModeView } from './ReadingModeView';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EditorModeWrapperProps {
  /** Note title for display in reading mode. */
  title?: string;
  /** Breadcrumb path segments. */
  breadcrumb?: string[];
  /** Additional CSS class names for the wrapper. */
  className?: string;
}

// ---------------------------------------------------------------------------
// WYSIWYG Placeholder
// ---------------------------------------------------------------------------

/**
 * Placeholder for the TipTap WYSIWYG editor surface.
 *
 * In production, this would be the full TipTap editor from libs/editor-core.
 * For now, it provides a contenteditable div as a simple editing surface
 * that syncs with the markdown store.
 */
function WysiwygPlaceholder({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div
      className="flex flex-1 flex-col items-center overflow-y-auto py-12"
      data-testid="wysiwyg-editor"
    >
      <div className="w-full max-w-prose px-6">
        <div
          className="min-h-[200px] text-base outline-none"
          style={{
            fontFamily: 'var(--ns-font-sans)',
            lineHeight: 'var(--ns-leading-loose)',
            color: 'var(--ns-color-foreground)',
          }}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="Note editor"
          data-placeholder="Start writing..."
          onInput={(e) => {
            const target = e.currentTarget;
            onChange(target.innerText);
          }}
          onBlur={(e) => {
            onChange(e.currentTarget.innerText);
          }}
          dangerouslySetInnerHTML={{ __html: value.replace(/\n/g, '<br/>') }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EditorModeWrapper({ title, breadcrumb, className }: EditorModeWrapperProps) {
  const mode = useEditorModeStore((s) => s.mode);
  const markdown = useEditorModeStore((s) => s.markdown);
  const setMarkdown = useEditorModeStore((s) => s.setMarkdown);
  const toggleReadingMode = useEditorModeStore((s) => s.toggleReadingMode);

  return (
    <div
      className={`flex h-full flex-col ${className ?? ''}`}
      data-testid="editor-mode-wrapper"
      data-mode={mode}
    >
      {mode === 'wysiwyg' && <WysiwygPlaceholder value={markdown} onChange={setMarkdown} />}

      {mode === 'source' && (
        <SourceModeEditor value={markdown} onChange={setMarkdown} className="flex-1" />
      )}

      {mode === 'preview' && (
        <LivePreviewEditor value={markdown} onChange={setMarkdown} className="flex-1" />
      )}

      {mode === 'reading' && (
        <ReadingModeView
          content={markdown}
          title={title}
          breadcrumb={breadcrumb}
          onExitReadingMode={toggleReadingMode}
        />
      )}
    </div>
  );
}

EditorModeWrapper.displayName = 'EditorModeWrapper';
