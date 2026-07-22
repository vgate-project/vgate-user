import { defineStore } from 'pinia'
import { apiTickets } from '@/api/tickets'

// Tracks how many of the current user's tickets have an unread admin reply,
// powering the red dot on the Tickets sidebar item.
export const useTicketStore = defineStore('ticket', {
  state: () => ({
    unreadCount: 0 as number,
  }),
  actions: {
    async refresh() {
      try {
        const { data } = await apiTickets.unread()
        this.unreadCount = data.count
      } catch {
        /* non-fatal: a transient failure must not break the app shell */
      }
    },
  },
})
