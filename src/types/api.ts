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
  quota_bytes: number // 0 = unlimited
  quota_reset_enabled: boolean // participates in global monthly reset (day from system config)
  up_total: number
  down_total: number
  last_traffic_at?: string | null
  last_reset_at?: string | null
  enabled: boolean
  has_password?: boolean // derived: whether the user has a password set
  // Surfaced by the backend when the active product is a plan with a traffic
  // reset package: lets the user self-purchase a reset from the dashboard.
  current_plan_reset_enabled?: boolean
  current_plan_reset_price?: number // cents
  created_at: string
  updated_at: string
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
  alipay_trade_no?: string
  channel: string // pc | wap
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
  channel?: string // optional: "pc" | "wap" | "" (auto by UA)
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
