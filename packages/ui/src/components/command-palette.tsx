'use client';

import * as React from 'react';
import { Command } from 'cmdk';
import { cn } from '../lib/cn';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CommandPaletteAction {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  shortcut?: string[];
  group?: string;
  keywords?: string[];
  onSelect: () => void;
  disabled?: boolean;
}

export interface CommandPaletteProps {
  /** Whether the palette is visible. */
  open: boolean;
  /** Called when the palette should close. */
  onClose: () => void;
  /** The list of available actions. */
  actions: CommandPaletteAction[];
  /** Placeholder text shown in the search input. */
  placeholder?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Command palette UI built on top of cmdk.
 *
 * Accessibility:
 * - Renders as role="dialog" aria-modal="true" wrapping the cmdk Command.
 * - cmdk manages aria-activedescendant and aria-selected on its Command.Item
 *   elements automatically — it sets the correct ARIA pattern for listbox
 *   keyboard navigation.
 * - Keyboard: Arrow Up/Down navigates, Enter selects, Escape closes.
 * - Groups are labeled with aria-label via cmdk's Command.Group heading.
 * - The overlay is aria-hidden so screen readers focus only the dialog.
 */
function CommandPalette({
  open,
  onClose,
  actions,
  placeholder = 'Type a command or search...',
}: CommandPaletteProps) {
  // Group actions by their `group` key, preserving insertion order
  const grouped = React.useMemo(() => {
    const map = new Map<string, CommandPaletteAction[]>();
    for (const action of actions) {
      const group = action.group ?? 'Actions';
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push(action);
    }
    return map;
  }, [actions]);

  if (!open) return null;

  return (
    // Outer wrapper: full-screen backdrop + centering container
    <div
      className={cn(
        'fixed inset-0 z-[var(--ns-z-spotlight,50)]',
        'flex items-start justify-center',
        'pt-[15vh]',
      )}
      role="presentation"
    >
      {/* Overlay — closes on click, hidden from assistive technology */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog wrapper — required for ARIA modal semantics */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className={cn(
          'relative z-10',
          'w-full max-w-xl overflow-hidden',
          'rounded-xl border border-border bg-card shadow-floating',
        )}
      >
        {/* cmdk Command — owns aria-activedescendant pattern internally */}
        <Command
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
          }}
          loop
        >
          {/* Search input */}
          <div
            className="flex items-center border-b border-border px-3"
            cmdk-input-wrapper=""
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-2 h-4 w-4 shrink-0 text-foreground-muted"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <Command.Input
              autoFocus
              placeholder={placeholder}
              aria-label="Search commands"
              className={cn(
                'flex h-11 w-full bg-transparent py-3',
                'text-sm text-foreground placeholder:text-foreground-muted',
                'outline-none',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            />
          </div>

          {/* Results */}
          <Command.List
            className="max-h-[min(60vh,400px)] overflow-y-auto p-2"
            aria-label="Commands"
          >
            <Command.Empty className="py-8 text-center text-sm text-foreground-muted">
              No results found.
            </Command.Empty>

            {Array.from(grouped.entries()).map(([group, groupActions]) => (
              <Command.Group
                key={group}
                heading={group}
                aria-label={group}
                className={cn(
                  '[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5',
                  '[&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold',
                  '[&_[cmdk-group-heading]]:text-foreground-muted [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider',
                )}
              >
                {groupActions.map((action) => (
                  <Command.Item
                    key={action.id}
                    value={[action.label, ...(action.keywords ?? [])].join(' ')}
                    disabled={action.disabled}
                    onSelect={() => {
                      if (!action.disabled) {
                        action.onSelect();
                      }
                    }}
                    className={cn(
                      'relative flex cursor-default select-none items-center gap-3',
                      'rounded-md px-3 py-2 text-sm',
                      'outline-none transition-colors duration-[var(--ns-duration-fast,150ms)]',
                      'aria-selected:bg-primary/10 aria-selected:text-primary',
                      'data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50',
                      'text-foreground',
                    )}
                  >
                    {action.icon && (
                      <span
                        className="flex h-5 w-5 shrink-0 items-center justify-center text-foreground-muted"
                        aria-hidden="true"
                      >
                        {action.icon}
                      </span>
                    )}
                    <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                      <span className="truncate font-medium">{action.label}</span>
                      {action.description && (
                        <span className="truncate text-xs text-foreground-muted">
                          {action.description}
                        </span>
                      )}
                    </div>
                    {action.shortcut && action.shortcut.length > 0 && (
                      <div
                        className="flex shrink-0 items-center gap-1"
                        aria-label={`Shortcut: ${action.shortcut.join(' ')}`}
                      >
                        {action.shortcut.map((key) => (
                          <kbd
                            key={key}
                            className={cn(
                              'inline-flex h-5 items-center justify-center',
                              'rounded border border-border px-1.5',
                              'text-[10px] font-mono font-medium text-foreground-muted',
                            )}
                          >
                            {key}
                          </kbd>
                        ))}
                      </div>
                    )}
                  </Command.Item>
                ))}
              </Command.Group>
            ))}
          </Command.List>

          {/* Footer hints */}
          <div className="flex items-center gap-3 border-t border-border px-4 py-2.5">
            <FooterHint keys={['↑', '↓']} label="navigate" />
            <FooterHint keys={['↵']} label="select" />
            <FooterHint keys={['esc']} label="close" />
          </div>
        </Command>
      </div>
    </div>
  );
}
CommandPalette.displayName = 'CommandPalette';

export { CommandPalette };

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface FooterHintProps {
  keys: string[];
  label: string;
}

function FooterHint({ keys, label }: FooterHintProps) {
  return (
    <span className="flex items-center gap-1 text-[10px] text-foreground-muted">
      {keys.map((k) => (
        <kbd
          key={k}
          className="inline-flex h-4 items-center justify-center rounded border border-border px-1 font-mono text-[10px]"
        >
          {k}
        </kbd>
      ))}
      {label}
    </span>
  );
}
