import axios, {
  type AxiosInstance,
  type InternalAxiosRequestConfig,
  type AxiosError,
} from 'axios'
import { ElMessage } from 'element-plus'

import { useAuthStore } from '@/stores/auth'
import { extractApiError } from '@/utils/error'

const STORAGE_KEY = 'vgate_user_auth'

// Use the runtime-configured API base URL (see public/env.js) when provided;
// otherwise fall back to the relative "/api/v1" (dev proxy / same-origin).
const http: AxiosInstance = axios.create({
  baseURL: window.__ENV__?.API_BASE_URL || '/api/v1',
  timeout: 15000,
})

// Request interceptor: attach the bearer token from localStorage (avoids a
// store call per request and import cycles).
http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw) {
    try {
      const sess = JSON.parse(raw)
      if (sess.token) config.headers.Authorization = `Bearer ${sess.token}`
    } catch {
      /* ignore malformed session */
    }
  }
  return config
})

// Response interceptor: surface backend errors and redirect on auth loss.
// User JWTs are not refreshable, so a 401 simply logs the user out.
http.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const status = error.response?.status
    const url = error.config?.url ?? ''

    // 401 on the login/verify endpoints themselves is an expected "bad creds"
    // path — let the caller surface it as a toast, do not force a redirect.
    if (status === 401 && !url.includes('/user/login') && !url.includes('/user/verify-email')) {
      const auth = useAuthStore()
      auth.logout()
      window.location.href = '/login'
      return Promise.reject(error)
    }

    ElMessage.error(extractApiError(error))
    return Promise.reject(error)
  },
)

export default http
