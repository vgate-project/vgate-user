import http from './http'
import type { PaymentMethodInfo } from '@/types/api'

export const apiPayment = {
  // GET /user/payment-methods — admin-enabled, configured channels.
  getMethods: () => http.get<PaymentMethodInfo[]>('/user/payment-methods'),
  // POST /user/orders/:id/apple-verify — submit a signed App Store
  // transaction JWS after an in-app purchase.
  appleVerify: (orderId: string, transaction: string) =>
    http.post(`/user/orders/${orderId}/apple-verify`, { transaction }),
}
