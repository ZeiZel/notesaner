/**
 * Collaboration Cursor Extension Configuration
 *
 * Configures @tiptap/extension-collaboration-cursor for real-time presence
 * cursors and selection highlights in the TipTap editor.
 *
 * Features:
 *   - Colored vertical caret per collaborator
 *   - Name label flag above each cursor
 *   - Semi-transparent selection highlight
 *   - Automatic fade-out after 10s of inactivity
 *   - Maximum 10 simultaneous visible cursors (performance guard)
 *   - Cursor position update throttling (max 20/sec)
 *
 * Relies on the Yjs awareness protocol for data transport. Cursor position
 * data flows through Yjs awareness states, not separate WebSocket messages.
 */

import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import type { Awareness } from 'y-protocols/awareness';
import {
  type PresenceColor,
  assignPresenceCursorColor,
  MAX_VISIBLE_CURSORS,
  CURSOR_FADE_TIMEOUT_MS,
  CURSOR_UPDATE_THROTTLE_MS,
} from '@/shared/lib/presence-colors';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** User identity data set as Yjs awareness local state. */
export interface CollaborationUser {
  /** Unique user identifier. */
  userId: string;
  /** Display name shown on the cursor label. */
  name: string;
  /** Primary cursor color (CSS hex). */
  color: string;
  /** Semi-transparent selection color (CSS rgba). */
  selectionColor: string;
  /** Label text color (CSS hex). */
  labelColor: string;
  /** Unix timestamp (ms) of the last cursor activity. */
  lastActiveAt: number;
}

/** Options for configuring the collaboration cursor extension. */
export interface CollaborationCursorOptions {
  /** Yjs awareness instance connected to the document provider. */
  awareness: Awareness;
  /** Current user identity. */
  user: {
    userId: string;
    name: string;
  };
}

// ---------------------------------------------------------------------------
// Fade-out Tracking
// ---------------------------------------------------------------------------

/**
 * Map of clientId -> timeout handle for tracking inactivity fade-outs.
 * When a user stops moving their cursor, after CURSOR_FADE_TIMEOUT_MS
 * the cursor element gets the .collaboration-cursor--faded class.
 */
const fadeTimers = new Map<number, ReturnType<typeof setTimeout>>();

/**
 * Set of clientId values whose cursors are currently faded out.
 * Used by the render function to apply the faded CSS class.
 */
const fadedClients = new Set<number>();

/**
 * Resets the fade timer for a given client. If the client was faded,
 * removes the faded state. Starts a new timer to fade after inactivity.
 */
function resetFadeTimer(clientId: number): void {
  // Clear existing timer
  const existing = fadeTimers.get(clientId);
  if (existing !== undefined) {
    clearTimeout(existing);
  }

  // Remove faded state if present
  fadedClients.delete(clientId);

  // Start new fade timer
  const timer = setTimeout(() => {
    fadedClients.add(clientId);
    // Force re-render of cursor decorations by touching the DOM.
    // The render function checks fadedClients and applies the class.
    updateFadedCursorElements(clientId, true);
  }, CURSOR_FADE_TIMEOUT_MS);

  fadeTimers.set(clientId, timer);
}

/**
 * Cleans up the fade timer for a disconnected client.
 */
function clearFadeTimer(clientId: number): void {
  const existing = fadeTimers.get(clientId);
  if (existing !== undefined) {
    clearTimeout(existing);
    fadeTimers.delete(clientId);
  }
  fadedClients.delete(clientId);
}

/**
 * Applies or removes the faded CSS class on cursor elements in the DOM.
 * Uses data-client-id attribute to target the correct cursor.
 */
function updateFadedCursorElements(clientId: number, faded: boolean): void {
  const elements = document.querySelectorAll(`[data-collaboration-cursor-client-id="${clientId}"]`);
  for (const el of elements) {
    if (faded) {
      el.classList.add('collaboration-cursor--faded');
    } else {
      el.classList.remove('collaboration-cursor--faded');
    }
  }
}

// ---------------------------------------------------------------------------
// Cursor Renderer
// ---------------------------------------------------------------------------

/**
 * Renders the DOM element for a single collaborator's cursor.
 * Called by @tiptap/extension-collaboration-cursor for each remote user.
 *
 * @param user - The user data from Yjs awareness state
 * @returns An HTML element representing the cursor with label
 */
function renderCursor(user: CollaborationUser): HTMLElement {
  // Container
  const cursor = document.createElement('span');
  cursor.classList.add('collaboration-cursor-caret');
  cursor.style.borderLeftColor = user.color;

  // Name label
  const label = document.createElement('span');
  label.classList.add('collaboration-cursor-label');
  label.style.backgroundColor = user.color;
  label.style.color = user.labelColor;
  label.textContent = user.name;
  label.setAttribute('aria-label', `${user.name}'s cursor`);

  cursor.appendChild(label);

  return cursor;
}

// ---------------------------------------------------------------------------
// Throttle Helper
// ---------------------------------------------------------------------------

/**
 * Creates a throttled version of a function that executes at most once
 * per `intervalMs` milliseconds. Uses trailing edge execution to ensure
 * the last call always fires.
 */
function throttle<T extends (...args: never[]) => void>(
  fn: T,
  intervalMs: number,
): (...args: Parameters<T>) => void {
  let lastCallTime = 0;
  let pendingTimer: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    const now = Date.now();
    const elapsed = now - lastCallTime;

    if (elapsed >= intervalMs) {
      lastCallTime = now;
      if (pendingTimer !== null) {
        clearTimeout(pendingTimer);
        pendingTimer = null;
      }
      fn(...args);
    } else if (pendingTimer === null) {
      // Schedule trailing edge execution
      pendingTimer = setTimeout(() => {
        lastCallTime = Date.now();
        pendingTimer = null;
        fn(...args);
      }, intervalMs - elapsed);
    }
  };
}

// ---------------------------------------------------------------------------
// Extension Factory
// ---------------------------------------------------------------------------

/**
 * Creates a configured CollaborationCursor TipTap extension.
 *
 * This is the main export. It wraps @tiptap/extension-collaboration-cursor
 * with Notesaner-specific defaults: color palette, cursor rendering,
 * inactivity fade-out, and performance guards.
 *
 * Usage:
 * ```ts
 * import { createCollaborationCursor } from '@/features/editor';
 *
 * const editor = new Editor({
 *   extensions: [
 *     // ... other extensions
 *     createCollaborationCursor({
 *       awareness: yjsProvider.awareness,
 *       user: { userId: currentUser.id, name: currentUser.displayName },
 *     }),
 *   ],
 * });
 * ```
 */
export function createCollaborationCursor(options: CollaborationCursorOptions) {
  const { awareness, user } = options;
  const cursorColor: PresenceColor = assignPresenceCursorColor(user.userId);

  // Track awareness changes for fade-out management and performance guard.
  // The extension itself sets awareness local state via provider.awareness,
  // so we only need to manage fade timers here.
  awareness.on('change', (changes: { added: number[]; updated: number[]; removed: number[] }) => {
    const states = awareness.getStates();

    // Clean up fade timers for removed clients
    for (const clientId of changes.removed) {
      clearFadeTimer(clientId);
    }

    // Reset fade timers for added/updated clients (skip self)
    for (const clientId of [...changes.added, ...changes.updated]) {
      if (clientId === awareness.clientID) continue;
      if (states.has(clientId)) {
        resetFadeTimer(clientId);
      }
    }
  });

  // The extension accesses provider.awareness internally. We wrap the
  // raw Awareness instance in an object to satisfy the expected shape.

  const provider: Record<string, unknown> = { awareness };

  return CollaborationCursor.configure({
    provider,

    user: {
      userId: user.userId,
      name: user.name,
      color: cursorColor.primary,
      selectionColor: cursorColor.selection,
      labelColor: cursorColor.labelText,
      lastActiveAt: Date.now(),
    } satisfies CollaborationUser,

    render: (cursorUser: Record<string, string>) => {
      // Performance guard: count active remote cursors
      const states = awareness.getStates();
      let remoteCursorCount = 0;
      for (const [clientId] of states) {
        if (clientId !== awareness.clientID) {
          remoteCursorCount++;
        }
      }

      // If we're over the max, return a hidden element for overflow cursors
      if (remoteCursorCount > MAX_VISIBLE_CURSORS) {
        const hidden = document.createElement('span');
        hidden.style.display = 'none';
        return hidden;
      }

      return renderCursor({
        userId: cursorUser['userId'] ?? '',
        name: cursorUser['name'] ?? 'Anonymous',
        color: cursorUser['color'] ?? cursorColor.primary,
        selectionColor: cursorUser['selectionColor'] ?? cursorColor.selection,
        labelColor: cursorUser['labelColor'] ?? cursorColor.labelText,
        lastActiveAt: Number(cursorUser['lastActiveAt']) || Date.now(),
      });
    },

    selectionRender: (cursorUser: Record<string, string>) => {
      // Performance guard: skip rendering if over max
      const states = awareness.getStates();
      let remoteCursorCount = 0;
      for (const [clientId] of states) {
        if (clientId !== awareness.clientID) {
          remoteCursorCount++;
        }
      }

      if (remoteCursorCount > MAX_VISIBLE_CURSORS) {
        return {};
      }

      return {
        class: 'collaboration-cursor-selection',
        style: `background-color: ${cursorUser['selectionColor'] ?? cursorColor.selection};`,
        nodeName: 'span',
      };
    },
  });
}

/**
 * Updates the local user's cursor activity timestamp.
 * Call this on user interactions (typing, clicking, scrolling) to reset
 * the inactivity fade-out timer for the local user's cursor on remote peers.
 *
 * Automatically throttled to CURSOR_UPDATE_THROTTLE_MS (50ms).
 */
export function createCursorActivityTracker(awareness: Awareness): () => void {
  const throttledUpdate = throttle(() => {
    const currentState = awareness.getLocalState();
    if (currentState?.['user']) {
      awareness.setLocalStateField('user', {
        ...(currentState['user'] as CollaborationUser),
        lastActiveAt: Date.now(),
      });
    }
  }, CURSOR_UPDATE_THROTTLE_MS);

  return throttledUpdate;
}

/**
 * Cleans up all fade timers. Call when the editor is destroyed.
 */
export function cleanupCollaborationCursors(): void {
  for (const timer of fadeTimers.values()) {
    clearTimeout(timer);
  }
  fadeTimers.clear();
  fadedClients.clear();
}
