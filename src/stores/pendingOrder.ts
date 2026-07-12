import { defineStore } from 'pinia'
import { apiOrder } from '@/api/order'

export const usePendingOrderStore = defineStore('pendingOrder', {
  state: () => ({
    hasPendingOrder: false as boolean,
  }),
  actions: {
    async refresh() {
      try {
        const { data } = await apiOrder.list({ page: 1, page_size: 50 })
        this.hasPendingOrder = data.items.some((o) => o.status === 'pending')
      } catch {
        /* non-fatal */
      }
    },
  },
})
