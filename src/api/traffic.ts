import http from './http'
import type { Page, UserTrafficRow, HourlyStat, TrafficPackage } from '@/types/api'

// Original user-traffic stats API (hourly + own traffic rows).
export const apiTraffic = {
  // GET /user/traffic — the caller's own traffic rows (paginated).
  listMine: (params?: { page?: number; page_size?: number }) =>
    http.get<Page<UserTrafficRow>>('/user/traffic', { params }),
  // GET /user/traffic/hourly — the caller's hourly usage stats.
  hourly: () => http.get<HourlyStat[]>('/user/traffic/hourly'),
}

// One-time traffic package catalog for users.
export const apiTrafficPackage = {
  // GET /user/traffic-packages — enabled traffic packages only.
  list: () => http.get<TrafficPackage[]>('/user/traffic-packages'),
}
