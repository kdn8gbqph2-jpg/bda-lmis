import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user:    null,
      access:  null,
      refresh: null,

      setAuth: (user, access, refresh) => set({ user, access, refresh }),

      setTokens: (access, refresh) => set((s) => ({
        access,
        refresh: refresh ?? s.refresh,
      })),

      logout: () => {
        // Best-effort blacklist the refresh token
        const refresh = get().refresh
        if (refresh) {
          fetch('/api/auth/logout/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh }),
          }).catch(() => {})
        }
        set({ user: null, access: null, refresh: null })
      },

      isAuthenticated: () => !!get().access,

      // Role helpers
      isAdmin:          () => get().user?.role === 'admin',
      isSuperintendent: () => get().user?.role === 'superintendent',
      isStaffOrAbove:   () =>
        ['admin', 'superintendent', 'staff'].includes(get().user?.role),
    }),
    {
      name: 'bda-auth',
      // Only persist tokens + user (not functions)
      partialize: (s) => ({ user: s.user, access: s.access, refresh: s.refresh }),
    }
  )
)
