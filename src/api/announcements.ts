import http from './http'
import type { Announcement } from '@/types'

// User-facing announcements: only active items, pinned first (server order).
export const apiAnnouncements = {
  // GET /user/announcements — active announcements for the authenticated user.
  list: () => http.get<{ items: Announcement[] }>('/user/announcements'),
}
