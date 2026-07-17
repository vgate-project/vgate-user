import http from './http'
import type { Ticket, TicketDetail, Page, TicketStatus, TicketPriority, TicketCreateRequest } from '@/types'

// User-side ticket operations: open, list, view, and reply to own tickets.
export const apiTickets = {
  list: (params: { status?: TicketStatus; page?: number; page_size?: number }) =>
    http.get<Page<Ticket>>('/user/tickets', { params }),
  get: (id: string) => http.get<TicketDetail>(`/user/tickets/${id}`),
  create: (b: TicketCreateRequest) => http.post<Ticket>('/user/tickets', b),
  reply: (id: string, content: string) =>
    http.post<Ticket>(`/user/tickets/${id}/messages`, { content }),
  close: (id: string) => http.post<Ticket>(`/user/tickets/${id}/close`),
}

export type { TicketPriority }
