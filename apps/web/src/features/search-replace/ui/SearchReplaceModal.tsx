'use client';

import { useEffect, useCallback } from 'react';
import { Modal } from 'antd';
import { useSearchReplaceStore } from '../model/search-replace-store';
import { SearchReplacePanel } from './SearchReplacePanel';
import { keyboardManager } from '@/shared/lib/keyboard-manager';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * SearchReplaceModal — full-screen-ish modal for workspace-level search & replace.
 *
 * Registers the global keyboard shortcut (Cmd+Shift+H) to toggle visibility.
 * Wraps SearchReplacePanel in an Ant Design Modal.
 */
export function SearchReplaceModal() {
  const isOpen = useSearchReplaceStore((s) => s.isOpen);
  const setOpen = useSearchReplaceStore((s) => s.setOpen);
  const reset = useSearchReplaceStore((s) => s.reset);

  // Register keyboard shortcut
  useEffect(() => {
    const unregister = keyboardManager.register('global-search-replace', 'global', () => {
      setOpen(!useSearchReplaceStore.getState().isOpen);
    });

    return unregister;
  }, [setOpen]);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, [setOpen]);

  const handleAfterClose = useCallback(() => {
    // Reset state when modal is fully closed (animation complete)
    reset();
  }, [reset]);

  return (
    <Modal
      open={isOpen}
      onCancel={handleClose}
      afterClose={handleAfterClose}
      footer={null}
      width={640}
      styles={{
        body: {
          height: '70vh',
          padding: 0,
          overflow: 'hidden',
        },
      }}
      destroyOnHidden={false}
      keyboard
      closable
    >
      <SearchReplacePanel />
    </Modal>
  );
}
