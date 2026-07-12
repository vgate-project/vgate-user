export function formatBytes(n: number): string {
  if (!n || n < 0) return '0 B'
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB']
  let i = 0
  let v = n
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v >= 100 ? 0 : 2)} ${units[i]}`
}

// formatPrice renders a server-side amount (cents) as ¥ currency.
export function formatPrice(cents: number): string {
  if (cents == null || isNaN(cents)) return '—'
  return '¥' + (cents / 100).toFixed(2)
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString()
}
