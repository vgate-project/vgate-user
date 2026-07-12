import http from './http'
import type { InviteCode, InviteStatus, InviteRequest } from '@/types'

// User-owned invite codes. Types live in @/types (types.ts) alongside the
// other stubbed auth/config DTOs.
export const apiInvites = {
  // GET /user/invites — codes owned by the caller.
  list: () => http.get<{ items: InviteCode[]; total: number }>('/user/invites'),
  // GET /user/invites/status — used/issued/quota against the caller's cap.
  status: () => http.get<InviteStatus>('/user/invites/status'),
  // POST /user/invites — mint a code within the caller's quota.
  create: (body: InviteRequest) => http.post<InviteCode>('/user/invites', body),
  // DELETE /user/invites/:id — remove an unused own code.
  remove: (id: string) => http.delete(`/user/invites/${id}`),
}
