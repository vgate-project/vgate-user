import http from './http'
import type { UserNode } from '@/types/api'

export const apiNode = {
  // GET /user/nodes — nodes the caller can use, with server-computed online status.
  listMine: () => http.get<UserNode[]>('/user/nodes'),
}
