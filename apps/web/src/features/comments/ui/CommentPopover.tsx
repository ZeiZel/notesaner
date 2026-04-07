'use client';

/**
 * CommentPopover -- Ant Design Popover that displays a comment thread.
 *
 * Shown when a user clicks on a highlighted text range in the editor.
 * Displays:
 *   - The quoted text the thread is anchored to
 *   - All comments in chronological order with author avatars and timestamps
 *   - A reply input with @mention autocomplete
 *   - Resolve/re-open and delete thread actions
 *
 * Design decisions:
 *   - No useEffect -- thread data is read from the comment store.
 *   - Reply submission uses event handlers, not effects.
 *   - Mutations use TanStack Query hooks from the comments feature API.
 *   - Ant Design Avatar, List, Button, Popover for UI consistency.
 */

import { useState } from 'react';
import { Popover, Button, Avatar, Typography, Space, Divider, Tooltip, Flex } from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  UndoOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { formatRelativeTime, getPresenceColor } from '@/shared/lib/utils';
import {
  useCommentStore,
  selectThreadById,
  type CommentThread,
  type Comment,
} from '@/shared/stores/comment-store';
import { MentionInput } from './MentionInput';

const { Text, Paragraph } = Typography;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CommentPopoverProps {
  /** The thread ID to display. */
  threadId: string;
  /** Current user ID (for showing edit/delete on own comments). */
  currentUserId: string;
  /** Current user display name (for new replies). */
  currentUserName: string;
  /** Whether the popover is open. */
  open: boolean;
  /** Called when the popover should close. */
  onClose: () => void;
  /** Called when a reply is submitted. */
  onReply?: (threadId: string, content: string) => void;
  /** Called when the thread resolve state is toggled. */
  onResolve?: (threadId: string) => void;
  /** Called when the thread is deleted. */
  onDelete?: (threadId: string) => void;
  /** Called when a comment is edited. */
  onEditComment?: (threadId: string, commentId: string, content: string) => void;
  /** Called when a comment is deleted. */
  onDeleteComment?: (threadId: string, commentId: string) => void;
  /** Popover trigger element (the highlighted text). */
  children: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Comment Item sub-component
// ---------------------------------------------------------------------------

function CommentItem({
  comment,
  isOwn,
  onEdit,
  onDelete,
}: {
  comment: Comment;
  isOwn: boolean;
  onEdit: (commentId: string, content: string) => void;
  onDelete: (commentId: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);

  if (comment.isDeleted) {
    return (
      <Flex gap={8} align="start" style={{ padding: '8px 0', opacity: 0.5 }}>
        <Avatar
          size={24}
          style={{
            backgroundColor: getPresenceColor(comment.authorId),
            fontSize: 10,
            flexShrink: 0,
          }}
        >
          {comment.authorName.charAt(0).toUpperCase()}
        </Avatar>
        <Text type="secondary" italic style={{ fontSize: 12 }}>
          This comment has been deleted.
        </Text>
      </Flex>
    );
  }

  function handleSaveEdit() {
    if (editContent.trim() && editContent !== comment.content) {
      onEdit(comment.id, editContent.trim());
    }
    setIsEditing(false);
  }

  return (
    <Flex gap={8} align="start" style={{ padding: '8px 0' }} className="group">
      <Tooltip title={comment.authorName}>
        <Avatar
          size={24}
          style={{
            backgroundColor: getPresenceColor(comment.authorId),
            fontSize: 10,
            flexShrink: 0,
          }}
        >
          {comment.authorName.charAt(0).toUpperCase()}
        </Avatar>
      </Tooltip>

      <Flex vertical style={{ flex: 1, minWidth: 0 }}>
        <Flex gap={6} align="baseline">
          <Text strong style={{ fontSize: 12 }}>
            {comment.authorName}
          </Text>
          <Text type="secondary" style={{ fontSize: 10 }}>
            {formatRelativeTime(comment.createdAt)}
          </Text>
          {comment.updatedAt && (
            <Text type="secondary" style={{ fontSize: 10 }}>
              (edited)
            </Text>
          )}
        </Flex>

        {isEditing ? (
          <Flex vertical gap={4} style={{ marginTop: 4 }}>
            <MentionInput
              value={editContent}
              onChange={setEditContent}
              onSubmit={handleSaveEdit}
              autoFocus
              rows={2}
            />
            <Flex gap={4}>
              <Button size="small" type="primary" onClick={handleSaveEdit}>
                Save
              </Button>
              <Button
                size="small"
                onClick={() => {
                  setEditContent(comment.content);
                  setIsEditing(false);
                }}
              >
                Cancel
              </Button>
            </Flex>
          </Flex>
        ) : (
          <Paragraph
            style={{
              fontSize: 12,
              margin: '2px 0 0',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {comment.content}
          </Paragraph>
        )}

        {isOwn && !isEditing && (
          <Flex
            gap={8}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ marginTop: 2 }}
          >
            <Button
              type="link"
              size="small"
              style={{ fontSize: 10, padding: 0, height: 'auto' }}
              onClick={() => setIsEditing(true)}
            >
              Edit
            </Button>
            <Button
              type="link"
              size="small"
              danger
              style={{ fontSize: 10, padding: 0, height: 'auto' }}
              onClick={() => onDelete(comment.id)}
            >
              Delete
            </Button>
          </Flex>
        )}
      </Flex>
    </Flex>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function CommentPopover({
  threadId,
  currentUserId,
  currentUserName: _currentUserName,
  open,
  onClose,
  onReply,
  onResolve,
  onDelete,
  onEditComment,
  onDeleteComment,
  children,
}: CommentPopoverProps) {
  const threads = useCommentStore((s) => s.threads);
  const [replyContent, setReplyContent] = useState('');

  const thread: CommentThread | undefined = selectThreadById(threads, threadId);

  function handleReply() {
    const content = replyContent.trim();
    if (!content || !thread) return;
    onReply?.(threadId, content);
    setReplyContent('');
  }

  function handleResolve() {
    onResolve?.(threadId);
  }

  function handleDeleteThread() {
    onDelete?.(threadId);
    onClose();
  }

  function handleEditComment(commentId: string, content: string) {
    onEditComment?.(threadId, commentId, content);
  }

  function handleDeleteComment(commentId: string) {
    onDeleteComment?.(threadId, commentId);
  }

  const popoverContent = thread ? (
    <Flex vertical style={{ width: 340, maxHeight: 420, overflow: 'hidden' }}>
      {/* Quoted text */}
      <Flex
        vertical
        gap={4}
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--ant-color-border)',
        }}
      >
        <Flex justify="space-between" align="center">
          <Text
            type="secondary"
            style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}
          >
            Comment on
          </Text>
          <Button
            type="text"
            size="small"
            icon={<CloseOutlined style={{ fontSize: 10 }} />}
            onClick={onClose}
            style={{ width: 20, height: 20 }}
          />
        </Flex>
        <Text
          italic
          style={{
            fontSize: 12,
            borderLeft: '2px solid var(--ant-color-primary)',
            paddingLeft: 8,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {thread.range.text}
        </Text>
      </Flex>

      {/* Resolved badge */}
      {thread.isResolved && (
        <Flex
          gap={6}
          align="center"
          style={{
            padding: '6px 12px',
            backgroundColor: 'rgba(74, 222, 128, 0.1)',
          }}
        >
          <CheckOutlined style={{ fontSize: 12, color: '#22c55e' }} />
          <Text style={{ fontSize: 12, color: '#22c55e', fontWeight: 500 }}>Resolved</Text>
        </Flex>
      )}

      {/* Comments list */}
      <Flex
        vertical
        style={{
          flex: 1,
          overflowY: 'auto',
          maxHeight: 220,
          padding: '0 12px',
        }}
      >
        {thread.comments
          .filter((c) => !c.isDeleted || c.id === thread.comments[0]?.id)
          .map((comment, idx, arr) => (
            <Flex vertical key={comment.id}>
              <CommentItem
                comment={comment}
                isOwn={comment.authorId === currentUserId}
                onEdit={handleEditComment}
                onDelete={handleDeleteComment}
              />
              {idx < arr.length - 1 && <Divider style={{ margin: 0 }} />}
            </Flex>
          ))}
      </Flex>

      {/* Reply input */}
      <Flex
        vertical
        gap={8}
        style={{
          padding: '8px 12px',
          borderTop: '1px solid var(--ant-color-border)',
        }}
      >
        <MentionInput
          value={replyContent}
          onChange={setReplyContent}
          onSubmit={handleReply}
          placeholder="Reply... (Enter to send)"
          rows={1}
        />
        <Flex justify="space-between" align="center">
          <Space size={4}>
            <Tooltip title={thread.isResolved ? 'Re-open thread' : 'Resolve thread'}>
              <Button
                type="text"
                size="small"
                icon={
                  thread.isResolved ? (
                    <UndoOutlined style={{ fontSize: 12 }} />
                  ) : (
                    <CheckOutlined style={{ fontSize: 12 }} />
                  )
                }
                onClick={handleResolve}
                style={{
                  color: thread.isResolved ? '#eab308' : '#22c55e',
                  fontSize: 11,
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
                icon={<DeleteOutlined style={{ fontSize: 12 }} />}
                onClick={handleDeleteThread}
                style={{ fontSize: 11 }}
              >
                Delete
              </Button>
            </Tooltip>
          </Space>

          <Button
            type="primary"
            size="small"
            icon={<SendOutlined style={{ fontSize: 11 }} />}
            disabled={!replyContent.trim()}
            onClick={handleReply}
          >
            Reply
          </Button>
        </Flex>
      </Flex>
    </Flex>
  ) : null;

  return (
    <Popover
      content={popoverContent}
      trigger="click"
      open={open && Boolean(thread)}
      onOpenChange={(visible) => {
        if (!visible) onClose();
      }}
      placement="bottomLeft"
      styles={{ body: { padding: 0 } }}
      destroyOnHidden
    >
      {children}
    </Popover>
  );
}

CommentPopover.displayName = 'CommentPopover';
