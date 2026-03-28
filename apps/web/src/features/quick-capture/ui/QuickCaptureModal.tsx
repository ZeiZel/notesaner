'use client';

/**
 * QuickCaptureModal — Lightweight modal for instant note capture.
 *
 * Accessible from any page via Cmd+Shift+N. Renders via Ant Design Modal
 * (React portal) to stay outside the workspace layout tree.
 *
 * Design priorities:
 * - Instant load: no TipTap, uses plain textarea for content
 * - Minimal UI: title, content, tags, folder picker
 * - Keyboard-first: Cmd+Enter to save, Escape to cancel
 * - URL detection: auto-extracts title when a URL is pasted
 */

import { useCallback, useRef, type ClipboardEvent, type KeyboardEvent } from 'react';
import { Modal, Input, Select, TreeSelect, Typography, Space, Alert, Flex } from 'antd';
import type { TextAreaRef } from 'antd/es/input/TextArea';
import {
  FileTextOutlined,
  FolderOutlined,
  TagOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { Box } from '@/shared/ui';
import { cn } from '@/shared/lib/utils';
import { formatCombo } from '@/shared/lib/keyboard-shortcuts';
import { useQuickCapture } from '../hooks/useQuickCapture';
import { useTagsAutocomplete } from '../hooks/useTagsAutocomplete';
import { useFolderTree } from '../hooks/useFolderTree';

const { TextArea } = Input;
const { Text } = Typography;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function QuickCaptureModal() {
  const {
    isOpen,
    content,
    title,
    tags,
    targetFolderId,
    isSaving,
    saveError,
    setTitle,
    setTags,
    setTargetFolderId,
    handleContentChange,
    handlePaste,
    saveAndClose,
    discardAndClose,
  } = useQuickCapture();

  const { data: tagOptions, isLoading: tagsLoading } = useTagsAutocomplete();
  const { treeData: folderTreeData, isLoading: foldersLoading } = useFolderTree();

  const contentRef = useRef<TextAreaRef>(null);

  // Derived: tag autocomplete options for Ant Select
  const tagSelectOptions = (tagOptions ?? []).map((t) => ({
    label: t.name,
    value: t.name,
  }));

  /**
   * Handle Cmd+Enter to save, Escape to cancel.
   * Keyboard handling in event handler, not useEffect.
   */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const isMod = e.metaKey || e.ctrlKey;

      if (isMod && e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        void saveAndClose();
        return;
      }

      // Escape is handled by Modal's onCancel, but we add explicit handling
      // for safety when focus is inside child elements.
      if (e.key === 'Escape') {
        e.preventDefault();
        discardAndClose();
      }
    },
    [saveAndClose, discardAndClose],
  );

  /**
   * Handle paste in the content textarea to detect URLs.
   */
  const handleContentPaste = useCallback(
    (e: ClipboardEvent<HTMLTextAreaElement>) => {
      const pastedText = e.clipboardData.getData('text/plain');
      if (pastedText) {
        handlePaste(pastedText);
      }
    },
    [handlePaste],
  );

  /**
   * Focus the content textarea when the modal opens.
   * afterOpenChange is called after the open animation completes.
   */
  const handleAfterOpenChange = useCallback((open: boolean) => {
    if (open) {
      // Short delay to ensure the textarea is fully mounted
      requestAnimationFrame(() => {
        contentRef.current?.focus();
      });
    }
  }, []);

  // Platform-aware shortcut labels
  const saveShortcutLabel = formatCombo({ key: 'Enter', mod: true });
  const escLabel = 'Esc';

  return (
    <Modal
      open={isOpen}
      onCancel={discardAndClose}
      onOk={saveAndClose}
      okText={`Save ${saveShortcutLabel}`}
      cancelText="Discard"
      okButtonProps={{
        loading: isSaving,
        disabled: !content.trim() && !title.trim(),
        icon: <ThunderboltOutlined />,
      }}
      title={
        <Flex align="center" gap={8}>
          <ThunderboltOutlined />
          <span>Quick Capture</span>
        </Flex>
      }
      width={560}
      destroyOnClose
      afterOpenChange={handleAfterOpenChange}
      keyboard
      maskClosable={false}
      styles={{
        body: { paddingTop: 12 },
      }}
    >
      <Box onKeyDown={handleKeyDown}>
        <Space direction="vertical" size="middle" className="w-full">
          {/* Error banner */}
          {saveError && (
            <Alert type="error" message="Save failed" description={saveError} closable showIcon />
          )}

          {/* Title field */}
          <Input
            placeholder="Note title (optional -- auto-generated from content)"
            prefix={<FileTextOutlined className="text-token-text-tertiary" />}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            allowClear
            autoComplete="off"
          />

          {/* Content textarea -- lightweight, no TipTap */}
          <TextArea
            ref={contentRef}
            placeholder="Start typing your note... (supports Markdown syntax)"
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            onPaste={handleContentPaste}
            autoSize={{ minRows: 5, maxRows: 14 }}
            className={cn('font-mono text-sm', '!resize-none')}
            autoComplete="off"
            spellCheck
          />

          {/* Tags and folder row */}
          <Flex gap={8} wrap="wrap">
            {/* Tag selector with autocomplete */}
            <Select
              mode="tags"
              placeholder="Add tags..."
              suffixIcon={<TagOutlined />}
              value={tags}
              onChange={(values: string[]) => setTags(values)}
              options={tagSelectOptions}
              loading={tagsLoading}
              tokenSeparators={[',', ' ']}
              maxTagCount="responsive"
              className="min-w-[200px] flex-1"
              allowClear
              notFoundContent={tagsLoading ? 'Loading...' : 'Type to create a new tag'}
            />

            {/* Folder destination picker */}
            <TreeSelect
              placeholder="Inbox"
              suffixIcon={<FolderOutlined />}
              value={targetFolderId || undefined}
              onChange={(value: string) => setTargetFolderId(value ?? '')}
              treeData={folderTreeData}
              loading={foldersLoading}
              treeDefaultExpandAll
              allowClear
              className="min-w-[160px] flex-1"
              popupMatchSelectWidth={false}
              dropdownStyle={{ maxHeight: 300, overflow: 'auto' }}
            />
          </Flex>

          {/* Keyboard hint footer */}
          <Flex justify="space-between" align="center">
            <Text type="secondary" className="text-xs">
              Markdown supported: **bold**, *italic*, [links](url)
            </Text>
            <Text type="secondary" className="text-xs">
              {saveShortcutLabel} save &middot; {escLabel} discard
            </Text>
          </Flex>
        </Space>
      </Box>
    </Modal>
  );
}
