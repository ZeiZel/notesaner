'use client';

import { useState, useCallback } from 'react';
import { Button, Typography, Space } from 'antd';
import {
  FileTextOutlined,
  DownOutlined,
  RightOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import type { NoteMatchGroup, SearchReplaceMatch } from '../model/search-replace-store';
import { MatchResultItem } from './MatchResultItem';

const { Text } = Typography;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface NoteMatchGroupItemProps {
  group: NoteMatchGroup;
  replacementText: string;
  excludedMatchIds: Set<string>;
  isReplacing: boolean;
  onToggleExclusion: (matchId: string) => void;
  onExcludeAllForNote: (noteId: string) => void;
  onIncludeAllForNote: (noteId: string) => void;
  onReplaceSingle: (matchId: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Collapsible group of matches belonging to a single note.
 * Shows note title, path, match count, and expand/collapse toggle.
 */
export function NoteMatchGroupItem({
  group,
  replacementText,
  excludedMatchIds,
  isReplacing,
  onToggleExclusion,
  onExcludeAllForNote,
  onIncludeAllForNote,
  onReplaceSingle,
}: NoteMatchGroupItemProps) {
  const [collapsed, setCollapsed] = useState(false);

  const allExcluded = group.matches.every((m: SearchReplaceMatch) => excludedMatchIds.has(m.id));

  const handleToggleCollapse = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  const handleToggleNoteExclusion = useCallback(() => {
    if (allExcluded) {
      onIncludeAllForNote(group.noteId);
    } else {
      onExcludeAllForNote(group.noteId);
    }
  }, [allExcluded, group.noteId, onExcludeAllForNote, onIncludeAllForNote]);

  return (
    <div style={{ marginBottom: 4 }}>
      {/* Note header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 8px',
          backgroundColor: 'var(--ant-color-bg-container, #fff)',
          borderBottom: '1px solid var(--ant-color-border, #d9d9d9)',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={handleToggleCollapse}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleToggleCollapse();
          }
        }}
      >
        {collapsed ? (
          <RightOutlined style={{ fontSize: 10 }} />
        ) : (
          <DownOutlined style={{ fontSize: 10 }} />
        )}

        <FileTextOutlined style={{ fontSize: 14 }} />

        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <Text strong ellipsis style={{ fontSize: 13 }}>
            {group.noteTitle}
          </Text>
          <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }} ellipsis>
            {group.notePath}
          </Text>
        </div>

        <Space size={4}>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {group.matches.length} match{group.matches.length !== 1 ? 'es' : ''}
          </Text>
          <Button
            type="text"
            size="small"
            icon={allExcluded ? <EyeOutlined /> : <EyeInvisibleOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              handleToggleNoteExclusion();
            }}
            title={
              allExcluded
                ? 'Include all matches for this note'
                : 'Exclude all matches for this note'
            }
          />
        </Space>
      </div>

      {/* Match list */}
      {!collapsed && (
        <div style={{ paddingLeft: 12 }}>
          {group.matches.map((match: SearchReplaceMatch) => (
            <MatchResultItem
              key={match.id}
              match={match}
              replacementText={replacementText}
              isExcluded={excludedMatchIds.has(match.id)}
              isReplacing={isReplacing}
              onToggleExclusion={onToggleExclusion}
              onReplaceSingle={onReplaceSingle}
            />
          ))}
        </div>
      )}
    </div>
  );
}
