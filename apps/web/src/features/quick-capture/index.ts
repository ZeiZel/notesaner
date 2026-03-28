/**
 * features/quick-capture — Public API (barrel export).
 *
 * Exposes only the components and hooks needed by consumers outside
 * this feature slice. Internal implementation details stay encapsulated.
 */

// -- UI components --
export { QuickCaptureModal } from './ui/QuickCaptureModal';
export { QuickCaptureProvider } from './ui/QuickCaptureProvider';

// -- Hooks --
export { useQuickCapture } from './hooks/useQuickCapture';

// -- Store (for external programmatic open/close) --
export { useQuickCaptureStore } from './model/quick-capture-store';
export type { CaptureMode, QuickCaptureState } from './model/quick-capture-store';
