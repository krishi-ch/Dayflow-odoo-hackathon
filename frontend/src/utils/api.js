import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 15000,
})

// ── Attach access token to every request ──
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('dayflow:access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Handle 401 → auto-refresh, then logout if refresh fails ──
let isRefreshing = false
let failedQueue = []

const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error)
    else resolve(token)
  })
  failedQueue = []
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config

    if (err.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        // Queue this request until refresh completes
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`
          return api.request(original)
        })
      }

      original._retry = true
      isRefreshing = true

      const refresh = localStorage.getItem('dayflow:refresh_token')
      if (refresh) {
        try {
          const { data } = await axios.post('/api/v1/auth/refresh', { refresh_token: refresh })
          localStorage.setItem('dayflow:access_token', data.access_token)
          localStorage.setItem('dayflow:refresh_token', data.refresh_token)
          localStorage.setItem('dayflow:user', JSON.stringify(data.user))
          original.headers.Authorization = `Bearer ${data.access_token}`
          processQueue(null, data.access_token)
          isRefreshing = false
          return api.request(original)
        } catch {
          processQueue(err, null)
          isRefreshing = false
        }
      }

      isRefreshing = false
      localStorage.removeItem('dayflow:access_token')
      localStorage.removeItem('dayflow:refresh_token')
      localStorage.removeItem('dayflow:user')
      window.location.href = '/login'
    }

    // Network errors → retry once (for transient failures)
    if (!err.response && !original._networkRetry) {
      original._networkRetry = true
      return new Promise((resolve) => setTimeout(resolve, 1000)).then(() => api.request(original))
    }

    return Promise.reject(err)
  },
)

/**
 * Extract a human-readable error message from an API error response.
 * Handles: string detail, { field, message }[] errors, Pydantic validation errors.
 */
export const extractError = (err, fallback = 'Something went wrong') => {
  const data = err.response?.data
  if (!data) {
    if (err.message === 'Network Error') return 'Network error — check your connection'
    if (err.code === 'ECONNABORTED') return 'Request timed out — server may be slow'
    return fallback
  }
  if (typeof data.detail === 'string') return data.detail
  if (Array.isArray(data.errors)) return data.errors.map((e) => `${e.field}: ${e.message}`).join(' | ')
  if (data.detail && typeof data.detail === 'object') {
    if (Array.isArray(data.detail)) return data.detail.map((d) => d.msg || String(d)).join(' | ')
  }
  return fallback
}

/**
 * Create an AbortController that auto-cancels after `ms` milliseconds.
 * Use with: api.get(url, { signal: createTimeout(5000).signal })
 */
export const createTimeout = (ms = 15000) => {
  const controller = new AbortController()
  setTimeout(() => controller.abort(), ms)
  return controller
}

export default api
