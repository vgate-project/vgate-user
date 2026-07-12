/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly API_BASE_URL?: string
}

interface Window {
  __ENV__?: { API_BASE_URL?: string }
}
