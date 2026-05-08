import axios from 'axios'
import { useAuthStore } from '@/stores/useAuthStore'

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
  (res) => res.data,   // unwrap so callers get the JSON body directly
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
