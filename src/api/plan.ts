import http from './http'
import type { Plan } from '@/types/api'

export const apiPlan = {
  // GET /user/plans — enabled plans (with enabled prices) only.
  list: () => http.get<Plan[]>('/user/plans'),
}
