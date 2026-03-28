'use client';

/**
 * MentionInput -- text input with @mention autocomplete.
 *
 * Uses Ant Design Mentions component to provide user mention suggestions.
 * Workspace members are fetched from the workspace store (already loaded
 * when the workspace is active).
 *
 * No useEffect -- member data comes from the Zustand workspace store.
 */

import { Mentions } from 'antd';
import type { MentionsProps } from 'antd';
import { useWorkspaceStore } from '@/shared/stores/workspace-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MentionInputProps {
  /** Current input value. */
  value: string;
  /** Called when the value changes. */
  onChange: (value: string) => void;
  /** Placeholder text. */
  placeholder?: string;
  /** Called when Enter is pressed (without Shift). */
  onSubmit?: () => void;
  /** Whether the input is disabled. */
  disabled?: boolean;
  /** Auto-focus when mounted. */
  autoFocus?: boolean;
  /** Number of visible rows. */
  rows?: number;
  /** Additional CSS class name. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MentionInput({
  value,
  onChange,
  placeholder = 'Add a comment... Use @ to mention someone',
  onSubmit,
  disabled = false,
  autoFocus = false,
  rows = 2,
  className,
}: MentionInputProps) {
  const members = useWorkspaceStore((s) => s.members);

  const mentionOptions = members.map((member) => ({
    value: member.displayName,
    label: member.displayName,
  }));

  const handleKeyDown: MentionsProps['onKeyDown'] = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit?.();
    }
  };

  return (
    <Mentions
      value={value}
      onChange={onChange}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      disabled={disabled}
      autoFocus={autoFocus}
      rows={rows}
      autoSize={{ minRows: rows, maxRows: 6 }}
      options={mentionOptions}
      className={className}
      variant="borderless"
      style={{ fontSize: 13 }}
    />
  );
}

MentionInput.displayName = 'MentionInput';
