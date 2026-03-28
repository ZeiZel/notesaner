/**
 * AIInlinePopup — Selection-triggered inline popup for quick AI actions.
 *
 * Appears near the current text selection and provides fast access to
 * selection-based actions: rewrite, grammar check, translate, expand, simplify.
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { INLINE_ACTIONS, getAction } from './ai-actions';
import type { AIActionId } from './ai-actions';
import { useAIStore } from './ai-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PopupPosition {
  top: number;
  left: number;
}

export interface AIInlinePopupProps {
  /** Whether the popup is visible */
  visible: boolean;
  /** Position in viewport coordinates */
  position: PopupPosition;
  /** Currently selected text */
  selection: string;
  /** Called when an action is triggered */
  onAction: (actionId: AIActionId) => void;
  /** Called when the popup should close */
  onClose: () => void;
  /** Whether to show the translate sub-menu */
  showTranslate?: boolean;
}

const LANGUAGES = [
  'English',
  'Spanish',
  'French',
  'German',
  'Chinese',
  'Japanese',
  'Portuguese',
  'Italian',
  'Russian',
  'Arabic',
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AIInlinePopup({
  visible,
  position,
  selection,
  onAction,
  onClose,
  showTranslate = false,
}: AIInlinePopupProps): React.ReactElement | null {
  const popupRef = useRef<HTMLDivElement>(null);
  const { isStreaming, actions } = useAIStore();
  const [translateOpen, setTranslateOpen] = React.useState(false);

  // Close on outside click
  useEffect(() => {
    if (!visible) return;

    function handleOutsideClick(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [visible, onClose]);

  // Reset translate sub-menu when popup closes
  useEffect(() => {
    if (!visible) {
      setTranslateOpen(false);
    }
  }, [visible]);

  const handleAction = useCallback(
    (actionId: AIActionId, params?: Record<string, string>) => {
      const actionDef = getAction(actionId);
      actions.setPendingAction({
        actionId,
        selection: actionDef.requiresSelection ? selection : undefined,
        params,
      });
      onAction(actionId);
      onClose();
    },
    [selection, actions, onAction, onClose],
  );

  const handleTranslateClick = useCallback(
    (lang: string) => {
      handleAction('translate', { targetLanguage: lang });
    },
    [handleAction],
  );

  if (!visible) return null;

  return (
    <div
      ref={popupRef}
      className="ai-popup"
      role="menu"
      aria-label="AI quick actions"
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      <style>{POPUP_STYLES}</style>

      {INLINE_ACTIONS.map((actionId) => {
        if (actionId === 'translate') {
          if (!showTranslate) return null;

          return (
            <div key={actionId} className="ai-popup-translate-wrapper">
              <button
                className="ai-popup-btn"
                role="menuitem"
                disabled={isStreaming}
                onClick={() => setTranslateOpen((o) => !o)}
                aria-expanded={translateOpen}
                aria-haspopup="menu"
              >
                {getAction(actionId).label}
                <span className="ai-popup-arrow" aria-hidden="true">
                  {translateOpen ? '▲' : '▼'}
                </span>
              </button>

              {translateOpen && (
                <div className="ai-popup-submenu" role="menu" aria-label="Select language">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang}
                      className="ai-popup-btn ai-popup-btn--lang"
                      role="menuitem"
                      disabled={isStreaming}
                      onClick={() => handleTranslateClick(lang)}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        }

        const action = getAction(actionId);
        return (
          <button
            key={actionId}
            className="ai-popup-btn"
            role="menuitem"
            disabled={isStreaming}
            onClick={() => handleAction(actionId)}
            title={action.description}
          >
            {action.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Utility: compute popup position from a Selection object
// ---------------------------------------------------------------------------

/**
 * Compute the top-left position for the popup based on a browser Selection.
 * Positions the popup just above the selection, clamped to the viewport.
 */
export function computePopupPosition(
  selection: Selection,
  popupWidth = 200,
  popupHeight = 40,
): PopupPosition {
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;

  let top = rect.top + scrollY - popupHeight - 8;
  let left = rect.left + scrollX;

  // Ensure popup stays within viewport
  if (left + popupWidth > viewportWidth + scrollX) {
    left = viewportWidth + scrollX - popupWidth - 8;
  }

  if (top < scrollY + 8) {
    // Show below selection instead
    top = rect.bottom + scrollY + 8;
  }

  return { top: Math.max(scrollY + 8, top), left: Math.max(scrollX + 8, left) };
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const POPUP_STYLES = `
  .ai-popup {
    position: absolute;
    z-index: 9999;
    display: flex;
    align-items: stretch;
    gap: 2px;
    padding: 3px;
    border-radius: 8px;
    border: 1px solid var(--color-border, #e2e8f0);
    background: var(--color-bg, #fff);
    box-shadow: 0 4px 16px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08);
    flex-wrap: wrap;
    max-width: 280px;
  }

  .ai-popup-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: 5px;
    border: none;
    background: transparent;
    color: var(--color-text, #1a1a1a);
    font-size: 12px;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.1s;
  }

  .ai-popup-btn:hover:not(:disabled) {
    background: var(--color-bg-hover, #f1f5f9);
    color: var(--color-accent, #6366f1);
  }

  .ai-popup-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .ai-popup-arrow {
    font-size: 8px;
    margin-left: 2px;
  }

  .ai-popup-translate-wrapper {
    position: relative;
  }

  .ai-popup-submenu {
    position: absolute;
    top: 100%;
    left: 0;
    z-index: 10000;
    margin-top: 4px;
    padding: 3px;
    border-radius: 8px;
    border: 1px solid var(--color-border, #e2e8f0);
    background: var(--color-bg, #fff);
    box-shadow: 0 4px 16px rgba(0,0,0,0.12);
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 130px;
  }

  .ai-popup-btn--lang {
    padding: 4px 10px;
    justify-content: flex-start;
  }
`;
