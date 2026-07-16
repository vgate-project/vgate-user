import { defineStore } from 'pinia'

import { apiAuth } from '@/api/auth'
import { decodeJwtPayload } from '@/utils/jwt'
import type { JwtClaims, UserLoginResponse } from '@/types/auth'

export const AUTH_STORAGE_KEY = 'vgate_user_auth'

interface StoredSession {
  token: string
  expires_at: string
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: '' as string,
    expiresAt: '' as string,
    userId: '' as string,
    username: '' as string,
    level: 0 as number,
    emailVerified: false as boolean,
  }),
  getters: {
    isAuthenticated: (s) => !!s.token,
  },
  actions: {
    async login(email: string, password: string, cfTurnstileResponse?: string) {
      const { data } = await apiAuth.login({ email, password, cf_turnstile_response: cfTurnstileResponse })
      this.setSession(data)
    },
    logout() {
      this.token = ''
      this.expiresAt = ''
      this.userId = ''
      this.username = ''
      this.level = 0
      this.emailVerified = false
      localStorage.removeItem(AUTH_STORAGE_KEY)
    },
    // hydrate() loads any saved session on app boot.
    hydrate() {
      const raw = localStorage.getItem(AUTH_STORAGE_KEY)
      if (!raw) return
      try {
        const s: StoredSession = JSON.parse(raw)
        this.token = s.token
        this.expiresAt = s.expires_at
        this.applyClaims(s.token)
      } catch {
        localStorage.removeItem(AUTH_STORAGE_KEY)
      }
    },
    // setSession is called by the register flow on 201 (auto-login) and by login.
    setSession(data: UserLoginResponse) {
      this.token = data.token
      this.expiresAt = data.expires_at
      this.level = data.level ?? 0
      this.applyClaims(data.token)
      this.persist()
    },
    applyClaims(token: string) {
      const c = decodeJwtPayload<JwtClaims>(token)
      this.userId = c.user_id ?? ''
      this.username = c.username ?? ''
    },
    // setUsername updates the displayed name after a self-service rename, so
    // the sidebar reflects the change without requiring a re-login. The JWT
    // claims still carry the old name and are refreshed on next login.
    setUsername(username: string) {
      this.username = username
    },
    persist() {
      const s: StoredSession = {
        token: this.token,
        expires_at: this.expiresAt,
      }
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(s))
    },
  },
})
