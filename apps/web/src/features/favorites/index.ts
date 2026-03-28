/**
 * features/favorites — Public API (barrel export).
 *
 * Exports UI components and hooks for the favorites/bookmarks feature.
 */

// -- UI components --
export { FavoriteToggleButton } from './ui/FavoriteToggleButton';
export { FavoritesPanel } from './ui/FavoritesPanel';

// -- Hooks --
export { useFavoriteShortcut } from './hooks/useFavoriteShortcut';
