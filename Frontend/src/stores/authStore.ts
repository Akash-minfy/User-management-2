import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User, LoginResponse, SignupResponse } from '../types/auth'

interface AuthState {
  user: User | null
  token: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string, name?: string) => Promise<void>
  logout: () => void
  refreshAccessToken: () => Promise<boolean>
  setUser: (user: User) => void
  setToken: (token: string) => void
  setTokens: (token: string, refreshToken: string) => void
  setLoading: (loading: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (email: string, password: string) => {
        set({ isLoading: true })
        try {
          const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
          })

          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.message || 'Login failed')
          }

          const data: LoginResponse = await response.json()

          if (data.tempToken) {
            // Handle password reset required or TOTP flows
            localStorage.setItem('tempToken', data.tempToken)
            // If server indicates password reset is required, redirect there
            if (data.message === 'PASSWORD_RESET_REQUIRED') {
              window.location.href = '/change-password'
              return
            }
            if (data.totpSetupRequired) {
              window.location.href = '/totp-setup'
              return
            }

            if (data.twofaMethod === 'EMAIL') {
              window.location.href = '/email-verify'
              return
            }

            if (data.twofaMethod === 'TOTP') {
              window.location.href = '/totp-verify'
              return
            }

            // fallback only
            console.warn("Unknown 2FA method, defaulting to email")
            window.location.href = '/email-verify'

            return
          }

          // Store refresh token in memory (not localStorage)
          if (data.refreshToken) {
            refreshTokenStorage.set(data.refreshToken)
          }

          set({
            user: data.user,
            token: data.token || null,
            refreshToken: data.refreshToken || null, // Keep in state for immediate use
            isAuthenticated: true,
            isLoading: false,
          })
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },

      signup: async (email: string, password: string, name?: string) => {
        set({ isLoading: true })
        try {
          const response = await fetch('/api/auth/signup', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password, name }),
          })

          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.message || 'Signup failed')
          }

          const data: SignupResponse = await response.json()

          set({
            user: data.user,
            isAuthenticated: false,
            isLoading: false,
          })
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },

      logout: async () => {
        const refreshToken = refreshTokenStorage.get() || get().refreshToken

        // Optionally revoke refresh token on backend
        if (refreshToken) {
          try {
            await fetch('/api/auth/logout', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ refreshToken }),
            })
          } catch (error) {
            // Ignore errors during logout
          }
        }

        // Clear memory storage
        refreshTokenStorage.clear()

        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
        })
        localStorage.removeItem('tempToken')
      },

      refreshAccessToken: async () => {
        // Get refresh token from memory first, fallback to state
        const refreshToken = refreshTokenStorage.get() || get().refreshToken
        if (!refreshToken) {
          return false
        }

        try {
          const response = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refreshToken }),
          })

          if (!response.ok) {
            // If refresh fails, logout user
            refreshTokenStorage.clear()
            get().logout()
            return false
          }

          const data = await response.json()

          // Store new refresh token in memory
          if (data.refreshToken) {
            refreshTokenStorage.set(data.refreshToken)
          }

          set({
            token: data.token,
            refreshToken: data.refreshToken, // Keep in state for immediate use
            isAuthenticated: true,
          })
          return true
        } catch (error) {
          refreshTokenStorage.clear()
          get().logout()
          return false
        }
      },

      setUser: (user: User) => {
        set({ user })
      },

      setToken: (token: string) => {
        set({ token, isAuthenticated: true })
      },

      setTokens: (token: string, refreshToken: string) => {
        // Store refresh token in memory (not localStorage)
        refreshTokenStorage.set(refreshToken)
        set({ token, refreshToken, isAuthenticated: true })
      },

      setLoading: (isLoading: boolean) => {
        set({ isLoading })
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        // Only persist non-sensitive data to localStorage
        user: state.user,
        token: state.token, // Access token is short-lived (1h), acceptable risk
        // refreshToken is NOT persisted - stored only in memory
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)

// Store refresh token in sessionStorage (more secure than localStorage)
// sessionStorage is cleared when tab closes and is less accessible than localStorage
// Still vulnerable to XSS, but better than localStorage persistence
const REFRESH_TOKEN_KEY = 'refresh_token_session'

// Helper functions to manage refresh token storage
export const refreshTokenStorage = {
  get: (): string | null => {
    try {
      return sessionStorage.getItem(REFRESH_TOKEN_KEY)
    } catch {
      return null
    }
  },
  set: (token: string | null) => {
    try {
      if (token) {
        sessionStorage.setItem(REFRESH_TOKEN_KEY, token)
      } else {
        sessionStorage.removeItem(REFRESH_TOKEN_KEY)
      }
    } catch {
      // Ignore storage errors (e.g., private browsing mode)
    }
  },
  clear: () => {
    try {
      sessionStorage.removeItem(REFRESH_TOKEN_KEY)
    } catch {
      // Ignore storage errors
    }
  }
}