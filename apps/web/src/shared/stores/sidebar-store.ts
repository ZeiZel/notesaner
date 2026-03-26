import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

type LeftActiveTab = 'files' | 'search' | 'bookmarks' | 'tags';
type RightActiveTab = 'outline' | 'backlinks' | 'properties' | 'comments';

interface SidebarState {
  // State
  leftSidebarOpen: boolean;
  rightSidebarOpen: boolean;
  leftSidebarWidth: number;
  rightSidebarWidth: number;
  leftActiveTab: LeftActiveTab;
  rightActiveTab: RightActiveTab;
  expandedFolders: string[];
  selectedFileId: string | null;

  // Actions
  toggleLeftSidebar: () => void;
  toggleRightSidebar: () => void;
  setLeftSidebarOpen: (open: boolean) => void;
  setRightSidebarOpen: (open: boolean) => void;
  setLeftSidebarWidth: (width: number) => void;
  setRightSidebarWidth: (width: number) => void;
  setLeftTab: (tab: LeftActiveTab) => void;
  setRightTab: (tab: RightActiveTab) => void;
  toggleFolder: (folderId: string) => void;
  setSelectedFile: (fileId: string | null) => void;
}

const DEFAULT_LEFT_WIDTH = 260;
const DEFAULT_RIGHT_WIDTH = 280;

export const useSidebarStore = create<SidebarState>()(
  devtools(
    persist(
      (set) => ({
        // Initial state
        leftSidebarOpen: true,
        rightSidebarOpen: false,
        leftSidebarWidth: DEFAULT_LEFT_WIDTH,
        rightSidebarWidth: DEFAULT_RIGHT_WIDTH,
        leftActiveTab: 'files',
        rightActiveTab: 'outline',
        expandedFolders: [],
        selectedFileId: null,

        // Actions
        toggleLeftSidebar: () =>
          set(
            (state) => ({ leftSidebarOpen: !state.leftSidebarOpen }),
            false,
            'sidebar/toggleLeft',
          ),

        toggleRightSidebar: () =>
          set(
            (state) => ({ rightSidebarOpen: !state.rightSidebarOpen }),
            false,
            'sidebar/toggleRight',
          ),

        setLeftSidebarOpen: (open) =>
          set({ leftSidebarOpen: open }, false, 'sidebar/setLeftOpen'),

        setRightSidebarOpen: (open) =>
          set({ rightSidebarOpen: open }, false, 'sidebar/setRightOpen'),

        setLeftSidebarWidth: (width) =>
          set({ leftSidebarWidth: width }, false, 'sidebar/setLeftWidth'),

        setRightSidebarWidth: (width) =>
          set({ rightSidebarWidth: width }, false, 'sidebar/setRightWidth'),

        setLeftTab: (leftActiveTab) =>
          set({ leftActiveTab }, false, 'sidebar/setLeftTab'),

        setRightTab: (rightActiveTab) =>
          set({ rightActiveTab }, false, 'sidebar/setRightTab'),

        toggleFolder: (folderId) =>
          set(
            (state) => ({
              expandedFolders: state.expandedFolders.includes(folderId)
                ? state.expandedFolders.filter((id) => id !== folderId)
                : [...state.expandedFolders, folderId],
            }),
            false,
            'sidebar/toggleFolder',
          ),

        setSelectedFile: (selectedFileId) =>
          set({ selectedFileId }, false, 'sidebar/setSelectedFile'),
      }),
      {
        name: 'notesaner-sidebar',
        partialize: (state) => ({
          leftSidebarOpen: state.leftSidebarOpen,
          rightSidebarOpen: state.rightSidebarOpen,
          leftSidebarWidth: state.leftSidebarWidth,
          rightSidebarWidth: state.rightSidebarWidth,
          leftActiveTab: state.leftActiveTab,
          rightActiveTab: state.rightActiveTab,
          expandedFolders: state.expandedFolders,
        }),
      },
    ),
    { name: 'SidebarStore' },
  ),
);
