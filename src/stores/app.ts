import { defineStore } from 'pinia'
import { apiAuth } from '@/api/auth'
import type { UserConfig } from '@/types'

export const useAppStore = defineStore('app', {
  state: () => ({
    sidebarCollapsed: false as boolean,
    siteName: 'VGate' as string,
    // Public config (site name + captcha knobs) is shared across pages; loaded
    // once by the app shell so individual views don't each re-fetch /user/config.
    config: null as UserConfig | null,
  }),
  getters: {
    captchaEnabled: (s) => !!s.config?.captcha_enabled,
    captchaSiteKey: (s) => s.config?.captcha_site_key ?? '',
  },
  actions: {
    toggleSidebar() {
      this.sidebarCollapsed = !this.sidebarCollapsed
    },
    // Loads the public site config (site name + captcha). Falls back to a safe
    // default on failure so the UI always has a value. Only fetched once; call
    // sites read `config`/`siteName` from the store afterwards.
    async loadConfig() {
      try {
        const { data } = await apiAuth.getConfig()
        this.siteName = data.site_name || 'VGate'
        this.config = data
      } catch {
        this.siteName = 'VGate'
        this.config = null
      }
    },
    // Backwards-compatible alias used by the shell to load the site name.
    async loadSiteName() {
      return this.loadConfig()
    },
  },
})
