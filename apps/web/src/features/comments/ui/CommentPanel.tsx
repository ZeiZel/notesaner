'use client';

/**
 * CommentPanel -- right sidebar panel showing all comment threads in order.
 *
 * Displays a filterable, scrollable list of all comment threads for the
 * current note using Ant Design List with Avatar, and Input.TextArea for replies.
 *
 * Features:
 *   - Filter tabs: All / Open / Resolved
 *   - Thread cards with quoted text, author avatar, reply count, timestamp
 *   - Click to expand thread and show all replies
 *   - Inline reply with @mention autocomplete
 *   - Unresolved count badge on filter tabs
 *
 * Design decisions:
 *   - No useEffect -- all data derived from the comment store.
 *   - Filter mode stored in comment store for persistence.
 *   - Threads sorted by document position (top to bottom).
 *   - Active thread highlighted and auto-scrolled via ref callback.
 */

import { useCallback, useState } from 'react';
import { Avatar, Badge, Button, Divider, Empty, Flex, Segmented, Tooltip, Typography } from 'antd';
import {
  CheckOutlined,
  CommentOutlined,
  DeleteOutlined,
  MessageOutlined,
  PlusOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import { cn } from '@/shared/lib/utils';
import { formatRelativeTime, getPresenceColor } from '@/shared/lib/utils';
import {
  useCommentStore,
  selectFilteredThreads,
  selectUnresolvedCount,
  selectTotalCommentCount,
  type CommentFilterMode,
  type CommentThread,
} from '@/shared/stores/comment-store';
import { MentionInput } from './MentionInput';

const { Text, Paragraph } = Typography;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CommentPanelProps {
  /** Current user ID. */
  currentUserId: string;
  /** Current user display name. */
  currentUserName: string;
  /** Called when the panel should close. */
  onClose?: () => void;
  /** Called when a thread card is clicked (scroll editor to position). */
  onThreadClick?: (threadId: string) => void;
  /** Called when a reply is submitted. */
  onReply?: (threadId: string, content: string) => void;
  /** Called when resolve is toggled. */
  onResolve?: (threadId: string) => void;
  /** Called when a thread is deleted. */
  onDeleteThread?: (threadId: string) => void;
  /** Called to initiate new comment (enter selection mode). */
  onNewComment?: () => void;
  /** Additional CSS class name. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Filter label mapping
// ---------------------------------------------------------------------------

const FILTER_OPTIONS: Array<{ label: string; value: CommentFilterMode }> = [
  { label: 'All', value: 'all' },
  { label: 'Open', value: 'unresolved' },
  { label: 'Resolved', value: 'resolved' },
];

// ---------------------------------------------------------------------------
// Thread Card sub-component
// ---------------------------------------------------------------------------

function ThreadCard({
  thread,
  isActive,
  isExpanded,
  currentUserId: _currentUserId,
  onClick,
  onToggleExpand,
  onReply,
  onResolve,
  onDelete,
}: {
  thread: CommentThread;
  isActive: boolean;
  isExpanded: boolean;
  currentUserId: string;
  onClick: (threadId: string) => void;
  onToggleExpand: (threadId: string) => void;
  onReply?: (threadId: string, content: string) => void;
  onResolve?: (threadId: string) => void;
  onDelete?: (threadId: string) => void;
}) {
  const [replyContent, setReplyContent] = useState('');
  const firstComment = thread.comments[0];
  const visibleComments = thread.comments.filter((c) => !c.isDeleted);
  const replyCount = Math.max(0, visibleComments.length - 1);

  const cardRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (node && isActive) {
        node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    },
    [isActive],
  );

  if (!firstComment) return null;

  const authorColor = getPresenceColor(firstComment.authorId);

  function handleReply() {
    const content = replyContent.trim();
    if (!content) return;
    onReply?.(thread.id, content);
    setReplyContent('');
  }

  return (
    <div
      ref={cardRef}
      className={cn(
        'rounded-lg border p-3 transition-colors cursor-pointer',
        isActive
          ? 'border-blue-400/40 bg-blue-50/50'
          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/50',
        thread.isResolved && !isActive && 'opacity-60',
      )}
      role="button"
      tabIndex={0}
      onClick={() => onClick(thread.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(thread.id);
        }
      }}
      aria-label={`Thread by ${firstComment.authorName}: ${thread.range.text.slice(0, 40)}`}
    >
      {/* Quoted text */}
      <Text
        italic
        type="secondary"
        style={{
          fontSize: 11,
          borderLeft: '2px solid var(--ant-color-primary-border)',
          paddingLeft: 8,
          marginBottom: 8,
          display: '-webkit-box',
          WebkitLineClamp: 1,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {thread.range.text}
      </Text>

      {/* First comment preview */}
      <Flex gap={8} align="start" style={{ marginTop: 8 }}>
        <Avatar size={20} style={{ backgroundColor: authorColor, fontSize: 9, flexShrink: 0 }}>
          {firstComment.authorName.charAt(0).toUpperCase()}
        </Avatar>
        <Flex vertical style={{ flex: 1, minWidth: 0 }}>
          <Flex gap={4} align="baseline">
            <Text strong style={{ fontSize: 12 }}>
              {firstComment.authorName}
            </Text>
            <Text type="secondary" style={{ fontSize: 10 }}>
              {formatRelativeTime(firstComment.createdAt)}
            </Text>
          </Flex>
          <Paragraph
            type="secondary"
            style={{
              fontSize: 12,
              margin: '2px 0 0',
              display: '-webkit-box',
              WebkitLineClamp: isExpanded ? undefined : 2,
              WebkitBoxOrient: 'vertical',
              overflow: isExpanded ? 'visible' : 'hidden',
            }}
          >
            {firstComment.isDeleted ? 'This comment has been deleted.' : firstComment.content}
          </Paragraph>
        </Flex>
      </Flex>

      {/* Footer: reply count + resolved badge */}
      <Flex justify="space-between" align="center" style={{ marginTop: 8 }}>
        <Flex gap={8} align="center">
          {replyCount > 0 && (
            <Button
              type="link"
              size="small"
              icon={<MessageOutlined style={{ fontSize: 11 }} />}
              style={{ fontSize: 11, padding: 0, height: 'auto' }}
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand(thread.id);
              }}
            >
              {replyCount} repl{replyCount === 1 ? 'y' : 'ies'}
            </Button>
          )}
        </Flex>
        <Flex gap={4} align="center">
          {thread.isResolved && (
            <Flex gap={4} align="center">
              <CheckOutlined style={{ fontSize: 10, color: '#22c55e' }} />
              <Text style={{ fontSize: 10, color: '#22c55e', fontWeight: 500 }}>Resolved</Text>
            </Flex>
          )}
        </Flex>
      </Flex>

      {/* Expanded: all replies + reply input + actions */}
      {isExpanded && (
        <Flex vertical style={{ marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
          <Divider style={{ margin: '4px 0 8px' }} />

          {/* Replies */}
          {visibleComments.slice(1).map((comment) => (
            <Flex key={comment.id} gap={8} align="start" style={{ padding: '6px 0 6px 28px' }}>
              <Avatar
                size={18}
                style={{
                  backgroundColor: getPresenceColor(comment.authorId),
                  fontSize: 8,
                  flexShrink: 0,
                }}
              >
                {comment.authorName.charAt(0).toUpperCase()}
              </Avatar>
              <Flex vertical style={{ flex: 1, minWidth: 0 }}>
                <Flex gap={4} align="baseline">
                  <Text strong style={{ fontSize: 11 }}>
                    {comment.authorName}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 9 }}>
                    {formatRelativeTime(comment.createdAt)}
                  </Text>
                </Flex>
                <Text style={{ fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {comment.content}
                </Text>
              </Flex>
            </Flex>
          ))}

          {/* Reply input */}
          <Flex vertical gap={4} style={{ marginTop: 8, paddingLeft: 28 }}>
            <MentionInput
              value={replyContent}
              onChange={setReplyContent}
              onSubmit={handleReply}
              placeholder="Reply..."
              rows={1}
            />
          </Flex>

          {/* Actions */}
          <Flex gap={4} justify="end" style={{ marginTop: 8 }}>
            <Tooltip title={thread.isResolved ? 'Re-open' : 'Resolve'}>
              <Button
                type="text"
                size="small"
                icon={
                  thread.isResolved ? (
                    <UndoOutlined style={{ fontSize: 11 }} />
                  ) : (
                    <CheckOutlined style={{ fontSize: 11 }} />
                  )
                }
                onClick={(e) => {
                  e.stopPropagation();
                  onResolve?.(thread.id);
                }}
                style={{
                  color: thread.isResolved ? '#eab308' : '#22c55e',
                  fontSize: 10,
                }}
              >
                {thread.isResolved ? 'Re-open' : 'Resolve'}
              </Button>
            </Tooltip>
            <Tooltip title="Delete thread">
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined style={{ fontSize: 11 }} />}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.(thread.id);
                }}
                style={{ fontSize: 10 }}
              >
                Delete
              </Button>
            </Tooltip>
          </Flex>
        </Flex>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function CommentPanel({
  currentUserId,
  currentUserName: _currentUserName,
  onClose,
  onThreadClick,
  onReply,
  onResolve,
  onDeleteThread,
  onNewComment,
  className,
}: CommentPanelProps) {
  const threads = useCommentStore((s) => s.threads);
  const activeThreadId = useCommentStore((s) => s.activeThreadId);
  const filterMode = useCommentStore((s) => s.filterMode);
  const setFilterMode = useCommentStore((s) => s.setFilterMode);
  const setActiveThread = useCommentStore((s) => s.setActiveThread);

  const [expandedThreadId, setExpandedThreadId] = useState<string | null>(null);

  // Derived values -- computed at render time, no effects
  const filteredThreads = selectFilteredThreads(threads, filterMode);
  const unresolvedCount = selectUnresolvedCount(threads);
  const totalCommentCount = selectTotalCommentCount(threads);
  const totalThreadCount = threads.size;

  function handleThreadClick(threadId: string) {
    const nextActive = activeThreadId === threadId ? null : threadId;
    setActiveThread(nextActive);
    if (nextActive) {
      onThreadClick?.(threadId);
    }
  }

  function handleToggleExpand(threadId: string) {
    setExpandedThreadId(expandedThreadId === threadId ? null : threadId);
  }

  return (
    <Flex
      vertical
      className={cn('h-full bg-white', className)}
      role="complementary"
      aria-label="Comments panel"
    >
      {/* Header */}
      <Flex
        justify="space-between"
        align="center"
        style={{ padding: '12px 16px', borderBottom: '1px solid var(--ant-color-border)' }}
      >
        <Flex gap={8} align="center">
          <CommentOutlined style={{ fontSize: 16 }} />
          <Text strong style={{ fontSize: 14 }}>
            Comments
          </Text>
          {totalCommentCount > 0 && (
            <Badge
              count={totalCommentCount}
              size="small"
              style={{ backgroundColor: 'var(--ant-color-text-quaternary)' }}
            />
          )}
        </Flex>

        <Flex gap={4} align="center">
          <Tooltip title="Add new comment (select text first)">
            <Button type="text" size="small" icon={<PlusOutlined />} onClick={onNewComment} />
          </Tooltip>
          {onClose && (
            <Button type="text" size="small" onClick={onClose} aria-label="Close comments panel">
              <svg viewBox="0 0 16 16" width={14} height={14} fill="currentColor">
                <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
              </svg>
            </Button>
          )}
        </Flex>
      </Flex>

      {/* Filter tabs */}
      <Flex style={{ padding: '8px 16px', borderBottom: '1px solid var(--ant-color-border)' }}>
        <Segmented
          size="small"
          value={filterMode}
          onChange={(value) => setFilterMode(value as CommentFilterMode)}
          options={FILTER_OPTIONS.map((opt) => ({
            label: (
              <Flex gap={4} align="center">
                <span>{opt.label}</span>
                {opt.value === 'unresolved' && unresolvedCount > 0 && (
                  <Badge
                    count={unresolvedCount}
                    size="small"
                    style={{ backgroundColor: '#faad14' }}
                  />
                )}
                {opt.value === 'all' && totalThreadCount > 0 && (
                  <Badge
                    count={totalThreadCount}
                    size="small"
                    style={{ backgroundColor: 'var(--ant-color-text-quaternary)' }}
                  />
                )}
              </Flex>
            ),
            value: opt.value,
          }))}
          block
        />
      </Flex>

      {/* Thread list */}
      <Flex
        vertical
        gap={8}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 12px',
        }}
      >
        {filteredThreads.length === 0 ? (
          <Flex
            vertical
            align="center"
            justify="center"
            style={{ paddingTop: 48, paddingBottom: 48 }}
          >
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                filterMode === 'resolved'
                  ? 'No resolved comments'
                  : filterMode === 'unresolved'
                    ? 'No open comments'
                    : 'No comments yet'
              }
            />
            <Text type="secondary" style={{ fontSize: 11, marginTop: 8 }}>
              Select text in the editor to add a comment
            </Text>
          </Flex>
        ) : (
          filteredThreads.map((thread) => (
            <ThreadCard
              key={thread.id}
              thread={thread}
              isActive={activeThreadId === thread.id}
              isExpanded={expandedThreadId === thread.id}
              currentUserId={currentUserId}
              onClick={handleThreadClick}
              onToggleExpand={handleToggleExpand}
              onReply={onReply}
              onResolve={onResolve}
              onDelete={onDeleteThread}
            />
          ))
        )}
      </Flex>

      {/* Footer summary */}
      {totalThreadCount > 0 && (
        <Flex
          style={{
            padding: '8px 16px',
            borderTop: '1px solid var(--ant-color-border)',
          }}
        >
          <Text type="secondary" style={{ fontSize: 10 }}>
            {totalThreadCount} thread{totalThreadCount !== 1 ? 's' : ''} &middot;{' '}
            {totalCommentCount} comment{totalCommentCount !== 1 ? 's' : ''} &middot;{' '}
            {unresolvedCount} open
          </Text>
        </Flex>
      )}
    </Flex>
  );
}

CommentPanel.displayName = 'CommentPanel';
