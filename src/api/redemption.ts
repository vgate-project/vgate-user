import http from './http'
import type { RedemptionCode, RedeemRequest, RedeemResponse, RedemptionRecord } from '@/types'

// User-facing redemption: redeem a code and view own history.
export const apiRedemption = {
  // POST /user/redemption-codes/redeem — apply a code's benefit to the caller.
  redeem: (body: RedeemRequest) => http.post<RedeemResponse>('/user/redemption-codes/redeem', body),
  // GET /user/redemption-codes/records — caller's redemption history.
  records: () => http.get<{ items: RedemptionRecord[]; total: number }>('/user/redemption-codes/records'),
}
