import { defineStore } from 'pinia'
import { apiUser } from '@/api/user'
import { usePendingOrderStore } from './pendingOrder'
import { useTelegramStore } from './telegram'
import { useTicketStore } from './ticket'
import type { UserDashboard } from '@/types/api'

// Concurrent refreshes share a single in-flight request so that, e.g., the
// layout shell and a child view both calling refresh() on initial load only
// hit the network once.
let inflight: Promise<void> | null = null

export const useDashboardStore = defineStore('dashboard', {
  state: () => ({
    data: null as UserDashboard | null,
    loading: false,
  }),
  getters: {
    profile: (s) => s.data?.profile ?? null,
    announcements: (s) => s.data?.announcements ?? [],
    hourlyTraffic: (s) => s.data?.hourly_traffic ?? [],
    recentOrders: (s) => s.data?.recent_orders.items ?? [],
    nodes: (s) => s.data?.nodes ?? [],
    telegramStatus: (s) => s.data?.telegram_status ?? null,
  },
  actions: {
    async refresh() {
      if (inflight) return inflight
      this.loading = true
      inflight = (async () => {
        const { data } = await apiUser.dashboard()
        this.data = data
        // Keep the existing badge stores in sync so their consumers (sidebar
        // dots, alert banners) keep working without changes.
        const pending = usePendingOrderStore()
        pending.hasPendingOrder = !!data.pending_order
        const telegram = useTelegramStore()
        telegram.available = data.telegram_status.available
        telegram.bound = data.telegram_status.bound
        const ticket = useTicketStore()
        ticket.unreadCount = data.unread_tickets
      })()
      try {
        await inflight
      } finally {
        inflight = null
        this.loading = false
      }
    },
  },
})
