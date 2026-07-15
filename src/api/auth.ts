import http from './http'
import type { UserConfig, UserLoginResponse, UserLoginRequest, UserRegisterRequest } from '@/types'

export const apiAuth = {
  // GET /user/config — public registration settings (no auth).
  getConfig: () => http.get<UserConfig>('/user/config'),
  // POST /user/login — email/password → JWT.
  login: (b: UserLoginRequest) => http.post<UserLoginResponse>('/user/login', b),
  // POST /user/register — create an account. Returns 201 (auto-login body) or
  // 202 (pending email verification). The caller must inspect resp.status.
  register: (b: UserRegisterRequest) => http.post<UnknownResponse>('/user/register', b),
  // POST /user/verify-email — activate a pending account by token. Public.
  // cf is the optional Turnstile response (required when captcha is enabled).
  verifyEmail: (token: string, cf?: string) =>
    http.post('/user/verify-email', { token, cf_turnstile_response: cf }),
  // POST /user/change-password — update the caller's own password.
  changePassword: (b: { old_password: string; new_password: string }) =>
    http.post('/user/change-password', b),
}

// Both response shapes are valid; callers branch on the HTTP status instead of
// the typed body, so we keep the body loosely typed here.
type UnknownResponse = UserLoginResponse | { message: string; pending: boolean }
