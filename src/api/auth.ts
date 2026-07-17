import http from './http'
import type { UserConfig, UserLoginResponse, UserLoginRequest, UserRegisterRequest } from '@/types'

export const apiAuth = {
  // GET /user/config — public registration settings (no auth).
  getConfig: () => http.get<UserConfig>('/user/config'),
  // POST /user/login — email/password → JWT.
  login: (b: UserLoginRequest) => http.post<UserLoginResponse>('/user/login', b),
  // POST /user/register — create an account. Both 201 (verified/auto-login)
  // and 202 (verification pending) return a UserLoginResponse session, so the
  // caller can auto-log-in either way; the dashboard's verify banner then
  // guides a pending user to confirm their email.
  register: (b: UserRegisterRequest) => http.post<UserLoginResponse>('/user/register', b),
  // POST /user/verify-email — activate a pending account by token. Public.
  // cf is the optional Turnstile response (required when captcha is enabled).
  verifyEmail: (token: string, cf?: string) =>
    http.post('/user/verify-email', { token, cf_turnstile_response: cf }),
  // POST /user/resend-verification — re-send the verification email for a
  // pending account. Public; cf is the optional Turnstile response.
  resendVerification: (email: string, cf?: string) =>
    http.post('/user/resend-verification', { email, cf_turnstile_response: cf }),
  // POST /user/change-password — update the caller's own password.
  changePassword: (b: { old_password: string; new_password: string }) =>
    http.post('/user/change-password', b),
}
