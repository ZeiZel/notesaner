'use client';

import { useState, useCallback, useEffect } from 'react';
import { Mentions, type MentionsProps } from 'antd';
import type { MentionsOptionProps } from 'antd/es/mentions';
import { useWorkspaceStore } from '@/shared/stores/workspace-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MentionInputProps extends Omit<MentionsProps, 'options'> {
  /** Called when the final text (with @mentions) changes. */
  onContentChange?: (value: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * MentionInput wraps Ant Design's Mentions component with workspace member
 * autocomplete. When the user types @, a dropdown appears with matching members.
 *
 * Usage:
 *   <MentionInput onContentChange={(val) => setContent(val)} />
 */
export function MentionInput({ onContentChange, ...props }: MentionInputProps) {
  const members = useWorkspaceStore((s) => s.members);
  const [options, setOptions] = useState<MentionsOptionProps[]>([]);

  // Build options from workspace members
  useEffect(() => {
    const memberOptions: MentionsOptionProps[] = members.map((m) => ({
      value: m.displayName,
      label: m.displayName,
    }));
    setOptions(memberOptions);
  }, [members]);

  const handleSearch = useCallback(
    (_text: string, prefix: string) => {
      if (prefix !== '@') return;

      const filtered = members
        .filter((m) => m.displayName.toLowerCase().includes(_text.toLowerCase()))
        .map((m) => ({
          value: m.displayName,
          label: m.displayName,
        }));

      setOptions(filtered);
    },
    [members],
  );

  const handleChange = useCallback(
    (value: string) => {
      onContentChange?.(value);
    },
    [onContentChange],
  );

  return (
    <Mentions
      {...props}
      prefix="@"
      options={options}
      onSearch={handleSearch}
      onChange={handleChange}
      placeholder="Type @ to mention someone..."
      autoSize={{ minRows: 2, maxRows: 6 }}
    />
  );
}
