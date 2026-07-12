import http from './http'
import type { User } from '@/types/api'

export const apiUser = {
  // GET /user/profile — the caller's own account/traffic summary.
  profile: () => http.get<User>('/user/profile'),
  // GET /user/subscribe — the caller's subscription content. `fmt` selects the
  // render format (base64/clash/...) via the backend's ?type= query param.
  subscribe: (fmt?: string) =>
    http.get<string>('/user/subscribe', { params: fmt ? { type: fmt } : {} }),
  // GET /user/subscribe-url — a randomized subscription share link (base URL
  // picked from the admin-configured pool, or the request origin as fallback).
  subscribeUrl: () => http.get<{ url: string; base64_url: string }>('/user/subscribe-url'),
  // POST /user/regenerate-credential — rotate the caller's VLESS credential.
  regenerateCredential: () =>
    http.post<{ credential: string }>('/user/regenerate-credential'),
  // POST /user/reset-sub-token — rotate the caller's subscription token.
  resetSubToken: () => http.post<{ sub_token: string }>('/user/reset-sub-token'),
}
