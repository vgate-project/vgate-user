import { defineStore } from 'pinia'
import { apiUser } from '@/api/user'

export const useTelegramStore = defineStore('telegram', {
  state: () => ({
    available: false as boolean,
    bound: false as boolean,
  }),
  getters: {
    // Telegram is offered by the system but this account is not yet linked.
    needsBind: (s) => s.available && !s.bound,
  },
  actions: {
    async refresh() {
      try {
        const { data } = await apiUser.telegramStatus()
        this.available = data.available
        this.bound = data.bound
      } catch {
        /* non-fatal; Telegram is optional */
      }
    },
  },
})
