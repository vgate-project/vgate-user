// Public system settings consumed by the registration page.
export interface UserConfig {
  register_enabled: boolean
  register_require_invite: boolean
  register_require_email_verify: boolean
  captcha_enabled: boolean
  captcha_site_key: string
  site_name: string
}

export interface UserLoginResponse {
  token: string
  expires_at: string
  level: number
}

export interface UserLoginRequest {
  email: string
  password: string
  cf_turnstile_response?: string
}

export interface UserRegisterRequest {
  username: string
  email: string
  password: string
  invite_code?: string
  cf_turnstile_response?: string
}

// 201 → auto-login (data is UserLoginResponse). 202 → pending verification
// (data is { message, pending: true }).
export interface UserRegisterPending {
  message: string
  pending: boolean
}

export interface Announcement {
  id: string
  title: string
  content: string
  pinned: boolean
  active: boolean
  author_admin_id: number
  created_at: string
  updated_at: string
}

export interface InviteCode {
  id: string
  code: string
  created_by_user_id?: string | null
  created_by_admin_id?: number | null
  note?: string
  max_uses: number
  used_count: number
  expires_at?: string | null
  created_at: string
  updated_at: string
}

export interface InviteStatus {
  used: number
  issued: number
  quota: number
}

export interface InviteRequest {
  max_uses?: number
  expires_at?: string | null
  note?: string
}

// --- Redemption codes ---
export type RedeemType = 'traffic' | 'duration' | 'plan' | 'reset'

export interface RedemptionCode {
  id: string
  code: string
  type: RedeemType
  max_uses: number
  used_count: number
  expires_at?: string | null
  note?: string
  quota_bytes?: number
  duration_days?: number
  plan_id?: string | null
  created_by_admin_id?: number | null
  created_at: string
  updated_at: string
}

export interface RedeemRequest {
  code: string
}

export interface RedeemResponse {
  record: RedemptionRecord
  type: RedeemType
  message: string
}

export interface RedemptionRecord {
  id: string
  code_id: string
  user_id: string
  type: RedeemType
  redeemed_at: string
}

export interface UserProfile {
  id: string
  email: string
  username?: string
  level: number
  expire_at?: string
  quota_bytes: number
  quota_reset_enabled: boolean
  up_total: number
  down_total: number
  enabled: boolean
  email_verified?: boolean
  max_invites?: number
  created_at: string
  updated_at: string
}

// JwtClaims mirrors the manager's service.Claims (HS256, type=user).
export interface JwtClaims {
  type?: 'admin' | 'user'
  user_id?: string
  username?: string
  level?: number
  exp?: number
  iat?: number
}

export interface Page<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

// --- Tickets (support work-orders) ---
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed'
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent'
export type TicketSender = 'user' | 'admin'

export interface Ticket {
  id: string
  user_id: string
  subject: string
  priority: TicketPriority
  status: TicketStatus
  created_at: string
  updated_at: string
}

export interface TicketMessage {
  id: string
  ticket_id: string
  sender: TicketSender
  sender_id: string
  content: string
  created_at: string
}

export interface TicketDetail {
  ticket: Ticket
  messages: TicketMessage[]
}

export interface TicketCreateRequest {
  subject: string
  content: string
  priority?: TicketPriority
  notify_method?: 'none' | 'email' | 'telegram'
}
