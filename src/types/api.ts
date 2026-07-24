// User mirrors model.User's JSON-serialized fields (manager/internal/model/user.go).
export interface User {
  id: string // stable internal PK (NOT the VLESS credential)
  credential: string // rotatable VLESS UUID in the subscription link / node push
  current_product_id?: string // currently active plan/traffic-package id
  current_product_name?: string // display name of current_product_id (populated by backend)
  current_product_kind?: string // "plan" | "traffic" — kind of current_product_id (populated by backend)
  email: string
  username?: string | null
  sub_token: string // share-URL credential
  level: number
  expire_at?: string | null
  quota_bytes: number // -1 = unlimited, 0 = no quota, >0 = capped (bytes)
  quota_reset_enabled: boolean // participates in global monthly reset (day from system config)
  up_total: number
  down_total: number
  last_traffic_at?: string | null
  last_reset_at?: string | null
  enabled: boolean
  email_verified?: boolean // whether the user proved ownership of Email
  has_password?: boolean // derived: whether the user has a password set
  // Surfaced by the backend when the active product is a plan with a traffic
  // reset package: lets the user self-purchase a reset from the dashboard.
  current_plan_reset_enabled?: boolean
  current_plan_reset_price?: number // cents
  // Telegram link state (manager/internal/model/user.go). telegram_id is
  // not exposed; only the derived link flag and the notification opt-in.
  telegram_bound?: boolean
  telegram_notify?: boolean
  // reminder_channel selects how the user receives traffic reminders:
  // "" (auto), "email", "telegram", or "none". Mirrors model.User.ReminderChannel.
  reminder_channel?: string
  // Per-user speed cap (bytes/sec, 0 = unlimited). Effective cap is the
  // minimum of this and the node's global limit; sourced from the active plan.
  speed_limit_up_bps?: number
  speed_limit_down_bps?: number
  // Wallet balance in cents (general ledger, spendable on any future purchase).
  balance_cents?: number
  created_at: string
  updated_at: string
}

// ChangePlanRequest is the body for POST /user/change-plan.
export interface ChangePlanRequest {
  plan_id: string
  plan_price_id: string
}

// ChangePlanResult is returned by POST /user/change-plan (and GET
// /user/change-plan/preview, where the order/pay fields are omitted). All
// changes take effect immediately; when paid is true the wallet fully covered
// the net charge and the effect is already applied. For a preview, paid is
// false and only credit_cents / net_charge_cents carry meaning.
export interface ChangePlanResult {
  order?: Order
  pay_url: string
  pay_mode?: 'redirect' | 'qr'
  paid: boolean
  credit_cents: number // old plan's remaining value credited to the wallet
  net_charge_cents: number // net amount charged (to wallet or gateway; negative = refund)
  immediate: boolean
}

// BalanceLedgerEntry mirrors a single wallet ledger row (model.BalanceTransaction).
export interface BalanceLedgerEntry {
  id: string
  type: 'credit' | 'debit'
  amount_cents: number
  reason: string
  ref_order_id?: string
  balance_after: number
  remark?: string
  created_at: string
}

// BalanceResponse mirrors GET /user/balance.
export interface BalanceResponse {
  balance_cents: number
  ledger: BalanceLedgerEntry[]
  total: number
  page: number
  page_size: number
}

// PlanPrice mirrors model.PlanPrice (manager/internal/model/plan_price.go).
export interface PlanPrice {
  id: string
  plan_id: string
  period: string // month | quarter | half_year | year
  price: number // cents (server truth)
  duration_days: number
  sort: number
  enabled: boolean
}

// Plan mirrors model.Plan (manager/internal/model/plan.go). Pricing lives in
// the nested prices list (one entry per billing period).
export interface Plan {
  id: string
  name: string
  quota_bytes: number
  description: string
  level: number
  enabled: boolean
  allow_renew_off_shelf?: boolean
  prices?: PlanPrice[]
  created_at: string
  updated_at: string
}

// TrafficPackage mirrors model.TrafficPackage (manager/internal/model/traffic_package.go).
export interface TrafficPackage {
  id: string
  name: string
  price: number // cents
  quota_bytes: number
  validity_days: number // 0 = no expiry extension
  description: string
  enabled: boolean
  created_at: string
  updated_at: string
}

// Order mirrors model.Order (manager/internal/model/order.go).
export interface Order {
  id: string
  user_id: string
  kind: string // plan | traffic
  plan_id?: string
  plan_price_id?: string
  period?: string
  duration_days: number
  traffic_package_id?: string
  validity_days: number
  amount: number // cents, copied from source
  status: string // pending | paid | closed
  out_trade_no: string
  trade_no?: string // gateway-assigned transaction id
  platform?: string // payment gateway: alipay | manual | (future)
  paid_at?: string | null
  expired_at?: string | null
  created_at: string
  updated_at: string
}

// Order kind constants.
export const OrderKindPlan = 'plan'
export const OrderKindTraffic = 'traffic'
export const OrderKindReset = 'reset'

export interface CreateOrderRequest {
  kind: string // "plan" | "traffic" | "reset"
  plan_id?: string // required when kind=plan or kind=reset
  plan_price_id?: string // required when kind=plan
  traffic_package_id?: string // required when kind=traffic
  platform?: string // payment gateway; defaults to alipay
}

export interface CreateOrderResponse {
  order: Order
  pay_url: string
  // How to present pay_url to the user: "redirect" (open in browser) or
  // "qr" (render pay_url as a QR code to scan, e.g. wechat NATIVE).
  pay_mode?: 'redirect' | 'qr'
}

// UserNode mirrors dto.UserNodeView (manager/internal/api/dto/dto.go).
export interface UserNode {
  id: string
  name: string
  address: string
  port: number
  enabled: boolean
  online: boolean
  last_seen_at?: string | null
  traffic_multiplier?: number
}

// UserTrafficRow mirrors service.UserTrafficRow (manager/internal/service/traffic.go).
export interface UserTrafficRow {
  node_id: string
  node_name: string
  up_total: number
  down_total: number
}

// HourlyStat mirrors dto.HourlyStat (manager/internal/api/dto/dto.go).
export interface HourlyStat {
  hour: string // ISO time (UTC, truncated to hour)
  up: number
  down: number
}

// Page is the generic paginated-list envelope returned by list endpoints.
export interface Page<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}
