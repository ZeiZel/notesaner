'use client';

import { useCallback } from 'react';
import { Button, Checkbox, Tooltip, Typography } from 'antd';
import { SwapOutlined } from '@ant-design/icons';
import type { SearchReplaceMatch } from '../model/search-replace-store';

const { Text } = Typography;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MatchResultItemProps {
  match: SearchReplaceMatch;
  replacementText: string;
  isExcluded: boolean;
  isReplacing: boolean;
  onToggleExclusion: (matchId: string) => void;
  onReplaceSingle: (matchId: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Displays a single search match with context, replacement preview,
 * and controls for individual replacement or exclusion.
 */
export function MatchResultItem({
  match,
  replacementText,
  isExcluded,
  isReplacing,
  onToggleExclusion,
  onReplaceSingle,
}: MatchResultItemProps) {
  const handleToggle = useCallback(() => {
    onToggleExclusion(match.id);
  }, [match.id, onToggleExclusion]);

  const handleReplace = useCallback(() => {
    onReplaceSingle(match.id);
  }, [match.id, onReplaceSingle]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '6px 8px',
        opacity: isExcluded ? 0.5 : 1,
        borderBottom: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
      }}
    >
      <Checkbox checked={!isExcluded} onChange={handleToggle} style={{ marginTop: 2 }} />

      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        {/* Line number */}
        <Text type="secondary" style={{ fontSize: 11 }}>
          Line {match.lineNumber}, Col {match.columnOffset}
        </Text>

        {/* Match context */}
        <div
          style={{
            fontFamily: 'monospace',
            fontSize: 12,
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            marginTop: 2,
          }}
        >
          <Text type="secondary">{truncateContext(match.contextBefore)}</Text>
          <Text
            style={{
              backgroundColor: 'var(--ant-color-warning-bg, #fff7e6)',
              borderRadius: 2,
              padding: '0 2px',
            }}
            strong
          >
            {match.matchText}
          </Text>
          <Text type="secondary">{truncateContext(match.contextAfter)}</Text>
        </div>

        {/* Replacement preview */}
        {replacementText !== undefined && (
          <div
            style={{
              fontFamily: 'monospace',
              fontSize: 12,
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              marginTop: 2,
            }}
          >
            <Text type="secondary">{truncateContext(match.contextBefore)}</Text>
            <Text
              style={{
                backgroundColor: 'var(--ant-color-success-bg, #f6ffed)',
                borderRadius: 2,
                padding: '0 2px',
              }}
              strong
            >
              {match.replacementPreview}
            </Text>
            <Text type="secondary">{truncateContext(match.contextAfter)}</Text>
          </div>
        )}
      </div>

      {/* Replace single */}
      <Tooltip title="Replace this match">
        <Button
          type="text"
          size="small"
          icon={<SwapOutlined />}
          disabled={isExcluded || isReplacing}
          onClick={handleReplace}
          aria-label="Replace this match"
        />
      </Tooltip>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncateContext(text: string, maxLen = 40): string {
  if (text.length <= maxLen) return text;
  return `...${text.slice(-maxLen)}`;
}
