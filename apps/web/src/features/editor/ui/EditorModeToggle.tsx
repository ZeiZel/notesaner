'use client';

/**
 * EditorModeToggle — toolbar button group for switching between editor modes.
 *
 * Displays the current mode with an icon and label. Clicking cycles through
 * edit modes (WYSIWYG -> Source -> Live Preview). A separate reading mode
 * button toggles in/out of reading mode.
 *
 * Keyboard shortcuts:
 *   - Cmd+E: Cycle through edit modes (handled by KeyboardShortcutsProvider)
 *   - Cmd+Shift+E: Toggle reading mode (handled by KeyboardShortcutsProvider)
 *
 * No useEffect — all state is derived from the Zustand store and interactions
 * are handled in event handlers.
 *
 * Ant Design: uses Tooltip for keyboard shortcut hints and Button for the
 * reading mode toggle.
 */

import { Tooltip, Button, Flex } from 'antd';
import {
  useEditorModeStore,
  EDITOR_MODE_LABELS,
  type EditorMode,
} from '../model/editor-mode.store';

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function WysiwygIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <path d="M2 3a1 1 0 011-1h10a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V3zm2 1v2h8V4H4zm0 4v1h5V8H4zm0 3v1h8v-1H4z" />
    </svg>
  );
}

function SourceIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <path d="M5.854 4.146a.5.5 0 010 .708L3.207 7.5H5.5a.5.5 0 010 1H3.207l2.647 2.646a.5.5 0 01-.708.708l-3.5-3.5a.5.5 0 010-.708l3.5-3.5a.5.5 0 01.708 0zM10.146 4.146a.5.5 0 00-.001.708L12.793 7.5H10.5a.5.5 0 000 1h2.293l-2.647 2.646a.5.5 0 00.708.708l3.5-3.5a.5.5 0 000-.708l-3.5-3.5a.5.5 0 00-.708 0z" />
    </svg>
  );
}

function PreviewIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <path d="M2 3a1 1 0 011-1h10a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V3zm5.5 1v8h5V4h-5zM4 4v8h2V4H4z" />
    </svg>
  );
}

function ReadingIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <path d="M8 1.5c-2.363 0-4.535.712-6.185 1.905A.5.5 0 001.5 3.87V13a.5.5 0 00.748.434C3.81 12.397 5.847 11.5 8 11.5s4.19.897 5.752 1.934A.5.5 0 0014.5 13V3.87a.5.5 0 00-.315-.465C12.535 2.212 10.363 1.5 8 1.5zM3 4.59c1.29-.712 2.88-1.09 4.5-1.09v7c-1.715 0-3.367.397-4.5 1.034V4.59zm10 6.944c-1.133-.637-2.785-1.034-4.5-1.034v-7c1.62 0 3.21.378 4.5 1.09v6.944z" />
    </svg>
  );
}

const MODE_ICONS: Record<EditorMode, typeof WysiwygIcon> = {
  wysiwyg: WysiwygIcon,
  source: SourceIcon,
  preview: PreviewIcon,
  reading: ReadingIcon,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface EditorModeToggleProps {
  /** Additional CSS class names. */
  className?: string;
}

export function EditorModeToggle({ className }: EditorModeToggleProps) {
  const mode = useEditorModeStore((s) => s.mode);
  const cycleEditMode = useEditorModeStore((s) => s.cycleEditMode);
  const toggleReadingMode = useEditorModeStore((s) => s.toggleReadingMode);

  const CurrentIcon = MODE_ICONS[mode];
  const isReading = mode === 'reading';

  return (
    <Flex gap={2} align="center" className={className} role="toolbar" aria-label="Editor mode">
      {/* Main mode cycle button */}
      <Tooltip title={`${EDITOR_MODE_LABELS[mode]} (Cmd+E)`} placement="bottom">
        <Button
          type={isReading ? 'text' : 'default'}
          size="small"
          onClick={cycleEditMode}
          aria-label={`Editor mode: ${EDITOR_MODE_LABELS[mode]}. Click to cycle modes.`}
          icon={<CurrentIcon className="h-3.5 w-3.5" />}
        >
          <span className="hidden sm:inline">{EDITOR_MODE_LABELS[mode]}</span>
        </Button>
      </Tooltip>

      {/* Reading mode toggle */}
      <Tooltip
        title={isReading ? 'Exit reading mode (Cmd+Shift+E)' : 'Reading mode (Cmd+Shift+E)'}
        placement="bottom"
      >
        <Button
          type={isReading ? 'primary' : 'text'}
          size="small"
          onClick={toggleReadingMode}
          aria-label={isReading ? 'Exit reading mode' : 'Enter reading mode'}
          aria-pressed={isReading}
          icon={<ReadingIcon className="h-3.5 w-3.5" />}
        />
      </Tooltip>
    </Flex>
  );
}

EditorModeToggle.displayName = 'EditorModeToggle';
