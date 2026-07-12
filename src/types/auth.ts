export interface UserLoginResponse {
  token: string
  expires_at: string
  level?: number
}

// JwtClaims mirrors the manager's service.Claims (HS256, type=user).
export interface JwtClaims {
  type?: 'admin' | 'user'
  admin_id?: number
  username?: string
  role?: 'super_admin' | 'admin'
  user_id?: string
  exp?: number
  iat?: number
}
