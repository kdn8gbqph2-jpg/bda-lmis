import axios from 'axios'
import { useAuthStore } from '@/stores/useAuthStore'
import { useToastStore } from '@/stores/useToastStore'

const client = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

// ── Request: attach access token ──────────────────────────────────────────────
client.interceptors.request.use((config) => {
  const token = useAuthStore.getState().access
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Response: silent token refresh on 401 ────────────────────────────────────
let refreshing = null   // deduplicate concurrent refresh calls

client.interceptors.response.use(
  (res) => {
    // Surface the "Sent for approval" toast automatically. The mixin
    // on the backend returns 202 Accepted + change_request_id when a
    // staff member's write got queued instead of applied.
    if (res.status === 202 && res.data?.change_request_id) {
      try {
        useToastStore.getState().push(
          res.data.detail || 'Sent for approval. An Admin or Superintendent will review your changes shortly.',
          { kind: 'success', duration: 6000 },
        )
      } catch { /* toast is best-effort */ }
    }
    return res.data   // unwrap so callers get the JSON body directly
  async (error) => {
    const original = error.config

    if (
      error.response?.status === 401 &&
      !original._retry &&
      !original.url?.includes('/auth/') // don't refresh on auth endpoints
    ) {
      original._retry = true

      if (!refreshing) {
        const refresh = useAuthStore.getState().refresh
        if (!refresh) {
          useAuthStore.getState().logout()
          return Promise.reject(error)
        }
        refreshing = axios
          .post('/api/auth/refresh/', { refresh })
          .then(({ data }) => {
            useAuthStore.getState().setTokens(data.access, data.refresh ?? refresh)
            return data.access
          })
          .catch(() => {
            useAuthStore.getState().logout()
            return Promise.reject(error)
          })
          .finally(() => { refreshing = null })
      }

      const newAccess = await refreshing
      if (newAccess) {
        original.headers.Authorization = `Bearer ${newAccess}`
        return client(original)
      }
    }

    return Promise.reject(error)
  }
)

export default client
