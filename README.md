# VGate User Frontend

User-facing portal for **VGate**, built with Vue 3 + Vite + TypeScript. Customers use
it to log in, subscribe to a node, browse plans, place and pay orders, and monitor
their traffic. It talks to the manager's REST API under `/api/v1`.

When paying, the portal renders a **QR code** for WeChat Pay (NATIVE) and opens a redirect
link for Alipay and Stripe Checkout, driven by the order's `pay_mode`.

## Tech stack

- [Vue 3](https://vuejs.org/) (Composition API, `<script setup>`)
- [Vite](https://vitejs.dev/) — dev server & build tool
- [TypeScript](https://www.typescriptlang.org/)
- [Element Plus](https://element-plus.org/) — UI components (auto-imported)
- [Pinia](https://pinia.vuejs.org/) — state management
- [Vue Router](https://router.vuejs.org/) — routing
- [Axios](https://axios-http.com/) — HTTP client
- [qrcode](https://github.com/soldair/node-qrcode) — subscription QR codes

## Prerequisites

- Node.js **18+**
- **npm** (this project ships `package-lock.json` only — there is no `pnpm-lock.yaml`,
  so use `npm`, not `pnpm`)

## Getting started

```bash
# install dependencies
npm install

# start the dev server (http://localhost:5174)
npm run dev

# type-check without emitting (vue-tsc)
npm run typecheck

# production build → dist/
npm run build

# preview the production build locally
npm run preview
```

### Dev proxy

In development, Vite proxies `/api` to the manager backend at
`http://localhost:8081` (see `server.proxy` in `vite.config.ts`), so the app talks to
the backend without CORS issues during local development. The user dev server runs on
port **5174** (the admin frontend uses 5173).

## Configuring the API address

The API base URL is read at **runtime** from a global variable
(`window.__ENV__.API_BASE_URL`) injected by `public/env.js`. The file is copied
verbatim into `dist/env.js` on build and is **not** bundled, so you can edit the
backend address after deployment **without rebuilding**.

`src/api/http.ts` uses it as the axios `baseURL`, falling back to the relative path
`/api/v1` when it is empty:

```js
// dist/env.js  — edit this file on the deployed server
window.__ENV__ = { API_BASE_URL: '' }   // ''  → relative /api/v1 (reverse-proxy / same-origin)
// window.__ENV__ = { API_BASE_URL: 'http://192.168.1.10:8081/api/v1' }  // separate host:port
```

- Leave `API_BASE_URL` empty when the frontend and backend are served from the same
  origin (e.g. behind an Nginx reverse proxy that routes `/api` to the manager).
- Set the full backend URL (including the `/api/v1` path) when the manager runs on a
  different host/port. In that case the manager must allow the frontend origin via its
  CORS `allowed_origins` system config.

## Authentication model (different from the admin)

User sessions use JWT access tokens that are **not refreshable**. The axios response
interceptor in `src/api/http.ts` treats a `401` as "session expired": it clears the
stored token and redirects the user to `/login` (there is no silent auto-refresh,
unlike the admin console). The login form also supports a Cloudflare Turnstile field
(`cf_turnstile_response`) when the manager requires it, and there is a `/verify-email`
flow for email verification.

## Routes / pages

- Public (no auth): `/login`, `/verify-email`
- Protected (under `UserLayout`, require auth):
  - `/` — Dashboard
  - `/subscription` — current subscription + QR code
  - `/plans` — browse and pick a plan
  - `/orders` — order history and pending orders
  - `/traffic` — traffic usage
  - `/invites` — invite codes / referral
  - `/announcements` — system announcements
  - `/settings` — account settings / change password

Unauthenticated users hitting a protected route are redirected to `/login`
(`?redirect=…`); already-authenticated users visiting a public route are sent to the
dashboard.

## Deployment

1. `npm run build` produces a static `dist/` directory.
2. Serve `dist/` with any static file server (Nginx, Caddy, etc.).
3. Edit `dist/env.js` to point `API_BASE_URL` at your manager backend.
4. (Recommended) Put a reverse proxy in front so `/api` is forwarded to the manager —
   then `API_BASE_URL` can stay empty and no CORS configuration is needed.
