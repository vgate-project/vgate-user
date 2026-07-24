import http from './http'
import type { ChangePlanRequest, ChangePlanResult } from '@/types/api'

export const apiChangePlan = {
  // POST /user/change-plan — switch the caller to a different plan. Returns a
  // ChangePlanResult describing whether the switch is immediate/paid or
  // covered entirely by the wallet.
  changePlan: (body: ChangePlanRequest) =>
    http.post<ChangePlanResult>('/user/change-plan', body),
  // GET /user/change-plan/preview — compute the proration numbers (remaining
  // credit + net charge) for a prospective plan change without mutating
  // anything.
  previewChangePlan: (params: { plan_id: string; plan_price_id: string }) =>
    http.get<ChangePlanResult>('/user/change-plan/preview', { params }),
}
