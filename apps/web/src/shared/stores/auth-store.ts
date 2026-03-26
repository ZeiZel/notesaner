import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

// Inline types to avoid depending on @notesaner/contracts before it's built
interface UserDto {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: 'admin' | 'member' | 'viewer';
  createdAt: string;
}

interface AuthProviderDto {
  id: string;
  name: string;
  type: 'saml' | 'oidc' | 'local';
  iconUrl?: string;
}

interface AuthState {
  // State
  user: UserDto | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  accessToken: string | null;
  providers: AuthProviderDto[];

  // Actions
  setUser: (user: UserDto | null) => void;
  setAccessToken: (token: string | null) => void;
  setProviders: (providers: AuthProviderDto[]) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set) => ({
        // Initial state
        user: null,
        isAuthenticated: false,
        isLoading: true,
        accessToken: null,
        providers: [],

        // Actions
        setUser: (user) =>
          set({ user, isAuthenticated: user !== null }, false, 'auth/setUser'),

        setAccessToken: (token) =>
          set({ accessToken: token }, false, 'auth/setAccessToken'),

        setProviders: (providers) =>
          set({ providers }, false, 'auth/setProviders'),

        setLoading: (isLoading) =>
          set({ isLoading }, false, 'auth/setLoading'),

        logout: () =>
          set(
            { user: null, isAuthenticated: false, accessToken: null },
            false,
            'auth/logout',
          ),
      }),
      {
        name: 'notesaner-auth',
        // Only persist token — user data refreshed from server on load
        partialize: (state) => ({
          accessToken: state.accessToken,
        }),
      },
    ),
    { name: 'AuthStore' },
  ),
);
