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
    // Loads the configured site name from the public user config endpoint.
    // Falls back to "VGate" on any failure so the UI always has a label.
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
