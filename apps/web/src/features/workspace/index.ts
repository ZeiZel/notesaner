/**
 * features/workspace — Public API (barrel export).
 *
 * Only exports that are consumed outside the workspace feature slice.
 * Internal implementation details stay encapsulated within ui/, model/, hooks/, lib/.
 */

// -- UI components --
export { SnapLayoutPicker } from './ui/SnapLayoutPicker';
export { MobileBottomNav, type MobileNavTab } from './ui/MobileBottomNav';
export { NavigationButtons } from './ui/NavigationButtons';
export { StatusBar } from './ui/StatusBar';
export { LayoutPresetManager } from './ui/LayoutPresetManager';
export { SidebarContainer } from './ui/SidebarContainer';
export { CommandPaletteDialog } from './ui/CommandPaletteDialog';
export { MembersList } from './ui/MembersList';
export { InviteMemberForm } from './ui/InviteMemberForm';
export { PendingInvitesSection } from './ui/PendingInvitesSection';
export { RemoveMemberDialog } from './ui/RemoveMemberDialog';

// -- Model (stores, types, registry) --
export {
  getPanelDefinition,
  getDefaultPanelLayout,
  registerPanel,
  unregisterPanel,
} from './model/PanelRegistry';
export type { PanelDefinition, SidebarSide } from './model/PanelRegistry';

export {
  useMembersStore,
  selectSortedMembers,
  canManageMembers,
  canChangeRole,
  canRemoveMember,
} from './model/members-store';
export type {
  WorkspaceMember,
  MemberRole,
  PendingInvitation,
  InviteMemberPayload,
} from './model/members-store';

export { useNavigationHistoryStore } from './model/navigation-history-store';

export type { SavedLayout, SnapTemplateId, SnapTemplate } from './model/snap-layout-types';
export { SNAP_TEMPLATES } from './model/snap-layout-types';

// -- Lib (hooks, utilities) --
export { useSnapLayout } from './lib/useSnapLayout';
export { useLayoutPersistence } from './lib/useLayoutPersistence';
