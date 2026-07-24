import { defineStore } from 'pinia'
import { apiAuth } from '@/api/auth'

export const useAppStore = defineStore('app', {
  state: () => ({
    sidebarCollapsed: false as boolean,
    siteName: 'VGate' as string,
  }),
  actions: {
    toggleSidebar() {
      this.sidebarCollapsed = !this.sidebarCollapsed
    },
    // Loads the public site name from the public user config endpoint. Falls
    // back to a safe default on failure so the UI always has a value.
    async loadSiteName() {
      try {
        const { data } = await apiAuth.getConfig()
        this.siteName = data.site_name || 'VGate'
      } catch {
        this.siteName = 'VGate'
      }
    },
  },
})
