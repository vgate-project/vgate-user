// Decode a JWT's payload (part [1]) without verifying the signature. Used only
// for client-side UI gating (user_id/username) — the backend enforces real auth.
export function decodeJwtPayload<T>(token: string): T {
  const parts = token.split('.')
  if (parts.length < 2) return {} as T
  let payload = parts[1]
  // base64url → base64
  payload = payload.replace(/-/g, '+').replace(/_/g, '/')
  // pad
  while (payload.length % 4) payload += '='
  try {
    const json = atob(payload)
    // handle UTF-8
    const decoded = decodeURIComponent(
      json
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(''),
    )
    return JSON.parse(decoded) as T
  } catch {
    return {} as T
  }
}
