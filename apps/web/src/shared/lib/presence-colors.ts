/**
 * Presence Color Palette for Collaboration Cursors
 *
 * 8 high-contrast colors chosen for visibility against both light and dark
 * editor backgrounds. Each color has a primary (cursor line, label) and
 * a semi-transparent variant (selection highlight).
 *
 * Colors are assigned deterministically from user ID so the same user always
 * gets the same color across sessions and devices.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PresenceColor {
  /** Human-readable name for the color (for debugging and accessibility). */
  readonly name: string;
  /** Primary hex color for cursor line and label background. */
  readonly primary: string;
  /** Semi-transparent version for selection highlighting (rgba). */
  readonly selection: string;
  /** Foreground color for text on the label (white or black). */
  readonly labelText: string;
}

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------

/**
 * 8 distinct, high-contrast presence colors.
 * Tested against both Catppuccin Mocha (dark) and Catppuccin Latte (light) backgrounds.
 */
export const PRESENCE_CURSOR_COLORS: readonly PresenceColor[] = [
  {
    name: 'coral',
    primary: '#f38ba8',
    selection: 'rgba(243, 139, 168, 0.20)',
    labelText: '#1e1e2e',
  },
  {
    name: 'blue',
    primary: '#89b4fa',
    selection: 'rgba(137, 180, 250, 0.20)',
    labelText: '#1e1e2e',
  },
  {
    name: 'green',
    primary: '#a6e3a1',
    selection: 'rgba(166, 227, 161, 0.20)',
    labelText: '#1e1e2e',
  },
  {
    name: 'mauve',
    primary: '#cba6f7',
    selection: 'rgba(203, 166, 247, 0.20)',
    labelText: '#1e1e2e',
  },
  {
    name: 'peach',
    primary: '#fab387',
    selection: 'rgba(250, 179, 135, 0.20)',
    labelText: '#1e1e2e',
  },
  {
    name: 'sky',
    primary: '#89dceb',
    selection: 'rgba(137, 220, 235, 0.20)',
    labelText: '#1e1e2e',
  },
  {
    name: 'yellow',
    primary: '#f9e2af',
    selection: 'rgba(249, 226, 175, 0.20)',
    labelText: '#1e1e2e',
  },
  {
    name: 'teal',
    primary: '#94e2d5',
    selection: 'rgba(148, 226, 213, 0.20)',
    labelText: '#1e1e2e',
  },
] as const;

// ---------------------------------------------------------------------------
// Assignment
// ---------------------------------------------------------------------------

/**
 * Maximum simultaneous cursors rendered in the editor.
 * Beyond this limit, additional collaborator cursors are not displayed
 * to prevent layout thrashing and performance degradation.
 */
export const MAX_VISIBLE_CURSORS = 10;

/**
 * Inactivity timeout (milliseconds) after which a cursor fades out.
 * The cursor reappears immediately when the user resumes editing.
 */
export const CURSOR_FADE_TIMEOUT_MS = 10_000;

/**
 * Maximum cursor position updates per second sent over the wire.
 * Translates to a minimum interval of 50ms between updates.
 */
export const CURSOR_UPDATE_THROTTLE_MS = 50;

/**
 * Assigns a deterministic color from the 8-color palette based on user ID.
 * The same user ID always maps to the same color.
 *
 * Uses a simple DJB2-style string hash for fast, uniform distribution.
 */
export function assignPresenceCursorColor(userId: string): PresenceColor {
  let hash = 5381;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) + hash + userId.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % PRESENCE_CURSOR_COLORS.length;
  return PRESENCE_CURSOR_COLORS[index];
}
