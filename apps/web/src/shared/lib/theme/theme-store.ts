import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import {
  BUILT_IN_THEMES,
  COMMUNITY_THEMES_STORAGE_KEY,
  CUSTOM_CSS_STORAGE_KEY,
  THEME_STORAGE_KEY,
  type CommunityTheme,
  type Theme,
  type ThemePreference,
} from './themes';

interface ThemeState {
  /** User preference: 'dark' | 'light' | 'system' | a custom/community theme id */
  preference: ThemePreference;
  /** Community themes that have been downloaded and installed */
  communityThemes: CommunityTheme[];
  /** Custom CSS snippet injected after theme CSS variables */
  customCss: string;

  // Actions
  setPreference: (preference: ThemePreference) => void;
  addCommunityTheme: (theme: CommunityTheme) => void;
  removeCommunityTheme: (id: string) => void;
  setCustomCss: (css: string) => void;

  // Derived helpers
  getAllThemes: () => Theme[];
  getThemeById: (id: string) => Theme | undefined;
}

export const useThemeStore = create<ThemeState>()(
  devtools(
    persist(
      (set, get) => ({
        preference: 'dark',
        communityThemes: [],
        customCss: '',

        setPreference: (preference) =>
          set({ preference }, false, 'theme/setPreference'),

        addCommunityTheme: (theme) =>
          set(
            (state) => ({
              communityThemes: [
                ...state.communityThemes.filter((t) => t.id !== theme.id),
                theme,
              ],
            }),
            false,
            'theme/addCommunityTheme',
          ),

        removeCommunityTheme: (id) =>
          set(
            (state) => ({
              communityThemes: state.communityThemes.filter((t) => t.id !== id),
            }),
            false,
            'theme/removeCommunityTheme',
          ),

        setCustomCss: (customCss) =>
          set({ customCss }, false, 'theme/setCustomCss'),

        getAllThemes: () => {
          const { communityThemes } = get();
          return [...BUILT_IN_THEMES, ...communityThemes];
        },

        getThemeById: (id) => {
          return get().getAllThemes().find((t) => t.id === id);
        },
      }),
      {
        name: THEME_STORAGE_KEY,
        partialize: (state) => ({
          preference: state.preference,
          communityThemes: state.communityThemes,
          customCss: state.customCss,
        }),
        // Migrate legacy string values stored in localStorage prior to
        // the Zustand store introduction (e.g. 'notesaner-theme' = 'dark').
        // The migrate function receives the persisted value and version.
        migrate: (persisted: unknown, version: number) => {
          if (version === 0 && typeof persisted === 'string') {
            return { preference: persisted, communityThemes: [], customCss: '' };
          }
          return persisted as ThemeState;
        },
        version: 1,
      },
    ),
    { name: 'ThemeStore' },
  ),
);

// Re-export storage keys so the provider can access them without
// importing from themes.ts directly.
export { COMMUNITY_THEMES_STORAGE_KEY, CUSTOM_CSS_STORAGE_KEY, THEME_STORAGE_KEY };
