/**
 * Platform detection utilities for keyboard shortcut display.
 *
 * Uses navigator.platform for Cmd vs Ctrl determination.
 * Falls back to Ctrl for SSR contexts.
 */

/** Returns true if the current platform is macOS. */
export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  return navigator.platform.toUpperCase().includes('MAC');
}

/** Returns the platform-appropriate primary modifier label. */
export function getModifierLabel(): string {
  return isMacPlatform() ? 'Cmd' : 'Ctrl';
}

/** Returns the platform-appropriate modifier symbol (for compact display). */
export function getModifierSymbol(): string {
  return isMacPlatform() ? '\u2318' : 'Ctrl';
}

/** Returns the platform-appropriate shift symbol. */
export function getShiftSymbol(): string {
  return isMacPlatform() ? '\u21E7' : 'Shift';
}

/** Returns the platform-appropriate alt/option symbol. */
export function getAltSymbol(): string {
  return isMacPlatform() ? '\u2325' : 'Alt';
}
