/**
 * Shared type re-exports for ClipperPopup and related components.
 * Using a separate types file avoids circular imports between the popup,
 * the store, and the settings page.
 */

export type { ClipMode, ClipDestination } from './clip-store';

/** A folder option for the destination picker. */
export interface FolderOption {
  id: string;
  name: string;
  path: string;
}
