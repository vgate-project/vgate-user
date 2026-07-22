import DOMPurify from 'dompurify'

// Renders an (admin-authored) plan/traffic-package description as HTML. The
// HTML is sanitized to strip scripts/handlers/unsafe markup (XSS-safe) while
// keeping safe formatting such as inline style, <p>/<span>/<strong>, and inline
// <svg> (e.g. pasted Element Plus icon markup).
export function renderDescription(html: string): string {
  return DOMPurify.sanitize(html, { ADD_ATTR: ['style'] })
}
