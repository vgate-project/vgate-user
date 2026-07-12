import type { AxiosError } from 'axios'

// extractApiError pulls the backend's {error: "..."} message out of an axios
// error, falling back to the network message or a generic string.
export function extractApiError(err: unknown): string {
  const e = err as AxiosError<{ error?: string }>
  return e?.response?.data?.error ?? e?.message ?? 'request failed'
}
