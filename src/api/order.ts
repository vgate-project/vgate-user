import http from './http'
import type { CreateOrderRequest, CreateOrderResponse, Page, Order } from '@/types/api'

export const apiOrder = {
  // POST /user/orders — place an order for the caller; returns {order, pay_url}.
  create: (body: CreateOrderRequest) =>
    http.post<CreateOrderResponse>('/user/orders', body),
  // GET /user/orders — list the caller's own orders (paginated).
  list: (params?: { page?: number; page_size?: number }) =>
    http.get<Page<Order>>('/user/orders', { params }),
  // GET /user/orders/:id — single order (ownership enforced by backend).
  get: (id: string) => http.get<CreateOrderResponse['order']>(`/user/orders/${id}`),
  // POST /user/orders/:id/pay — regenerate a payment URL for the caller's pending order.
  pay: (id: string) => http.post<CreateOrderResponse>(`/user/orders/${id}/pay`),
  // POST /user/orders/:id/close — close the caller's own pending order.
  close: (id: string) => http.post(`/user/orders/${id}/close`),
}
