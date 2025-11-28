import { useAuthStore } from '../stores/authStore'

let isRefreshing = false
let refreshPromise: Promise<boolean> | null = null

/**
 * Wrapper around fetch that automatically handles token refresh on 401 responses
 */
export async function apiFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const authStore = useAuthStore.getState()
  const { token, refreshAccessToken } = authStore

  // Add authorization header if token exists
  const headers = new Headers(options.headers)
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  // Make the initial request
  let response = await fetch(url, {
    ...options,
    headers,
  })

  // If we get a 401, try to refresh the token
  if (response.status === 401 && token) {
    // Prevent multiple simultaneous refresh attempts
    if (!isRefreshing) {
      isRefreshing = true
      refreshPromise = refreshAccessToken()
    }

    // Wait for the refresh to complete
    const refreshed = await refreshPromise
    isRefreshing = false
    refreshPromise = null

    if (refreshed) {
      // Retry the original request with the new token
      const newToken = useAuthStore.getState().token
      if (newToken) {
        headers.set('Authorization', `Bearer ${newToken}`)
        response = await fetch(url, {
          ...options,
          headers,
        })
      }
    }
  }

  return response
}

/**
 * Convenience method for JSON API calls
 */
export async function apiJson<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await apiFetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }))
    throw new Error(error.message || 'Request failed')
  }

  return response.json()
}

