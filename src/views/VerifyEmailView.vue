<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

import { apiAuth } from '@/api/auth'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import type { UserConfig } from '@/types'

const route = useRoute()
const router = useRouter()
const app = useAppStore()
const auth = useAuthStore()

// After verifying, an already-authenticated user (the A1 auto-login case)
// should return to the dashboard, where the profile re-fetch clears the
// verify banner; an unauthenticated user goes to login.
const nextLabel = computed(() => (auth.isAuthenticated ? 'Go to dashboard' : 'Go to login'))
function goNext() {
  router.push(auth.isAuthenticated ? '/' : '/login')
}

type Status = 'idle' | 'verifying' | 'success' | 'error'
const status = ref<Status>('idle')
const message = ref('')
// Guard against double-submit: block re-entry while a request is in flight or
// already finished, so the user cannot click through to a false "failed".
const submitting = ref(false)

const token = (route.query.token as string) || ''

// Captcha: when enabled the verification must be gated behind a Turnstile
// challenge, so we show a widget + button instead of auto-verifying on mount.
const config = ref<UserConfig | null>(null)
const captchaEnabled = ref(false)
const captchaToken = ref('')
const captchaEl = ref<HTMLElement | null>(null)
let activeWidgetId: number | null = null
let turnstileLoading = false

function ensureTurnstile(cb: () => void) {
  if ((window as any).turnstile) {
    cb()
    return
  }
  if (turnstileLoading) return
  turnstileLoading = true
  const s = document.createElement('script')
  s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
  s.async = true
  s.defer = true
  s.onload = () => cb()
  document.head.appendChild(s)
}

function renderCaptcha() {
  const el = captchaEl.value
  const sitekey = config.value?.captcha_site_key
  if (!el || !(window as any).turnstile || !sitekey) return
  activeWidgetId = (window as any).turnstile.render(el, {
    sitekey,
    callback: (t: string) => {
      captchaToken.value = t
    },
    'expired-callback': () => {
      captchaToken.value = ''
    },
    'error-callback': () => {
      captchaToken.value = ''
    },
  })
}

async function doVerify() {
  // Fool-proofing: never run twice (e.g. auto-POST on mount racing a manual
  // click, or the user mashing the button). The backend is idempotent for
  // already-verified accounts, but skipping the duplicate keeps the UI clean.
  if (submitting.value || status.value === 'success' || status.value === 'error') {
    return
  }
  if (!token) {
    status.value = 'error'
    message.value = 'Missing verification token in the link.'
    return
  }
  if (captchaEnabled.value && !captchaToken.value) {
    ElMessage.warning('Please complete the captcha')
    return
  }
  submitting.value = true
  status.value = 'verifying'
  try {
    await apiAuth.verifyEmail(token, captchaEnabled.value ? captchaToken.value : undefined)
    status.value = 'success'
    message.value = 'Email verified. Your account is now active — you can log in.'
    ElMessage.success('Email verified')
  } catch (e: any) {
    const msg = e?.response?.data?.error || ''
    // If the account is already verified, show success instead of "failed":
    // a repeated/auto-fired request after a successful verify is expected,
    // not an error. Backend returns 400 for genuinely bad/expired tokens.
    if (msg.includes('already verified') || msg.includes('already active')) {
      status.value = 'success'
      message.value = 'Email verified. Your account is now active — you can log in.'
      ElMessage.success('Email verified')
    } else {
      // Error (e.g. expired/invalid token) surfaced by the http interceptor.
      status.value = 'error'
      message.value = 'Verification failed. The link may be invalid or expired.'
      if (activeWidgetId !== null && (window as any).turnstile) {
        ;(window as any).turnstile.reset(activeWidgetId)
        captchaToken.value = ''
      }
    }
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  try {
    const { data } = await apiAuth.getConfig()
    config.value = data
    captchaEnabled.value = !!data.captcha_enabled
    app.siteName = data.site_name || 'VGate'
  } catch {
    captchaEnabled.value = false
  }

  if (!captchaEnabled.value) {
    // No captcha gate: verify immediately as before.
    await doVerify()
    return
  }

  // Captcha gated: render the widget and wait for the user to click Verify.
  await nextTick()
  ensureTurnstile(renderCaptcha)
})
</script>

<template>
  <div class="wrap">
    <el-card class="card" shadow="always">
      <h2 class="title">VGate</h2>

      <el-result
        v-if="status === 'success'"
        icon="success"
        title="Verified"
        :sub-title="message"
      >
        <template #extra>
          <el-button type="primary" @click="goNext">{{ nextLabel }}</el-button>
        </template>
      </el-result>

      <el-result
        v-else-if="status === 'error'"
        icon="error"
        title="Verification failed"
        :sub-title="message"
      >
        <template #extra>
          <el-button type="primary" @click="goNext">{{ nextLabel }}</el-button>
        </template>
      </el-result>

      <div v-else-if="status === 'verifying'" class="pending">
        <el-icon class="is-loading" :size="32" color="#409eff"><Loading /></el-icon>
        <p>Verifying your email…</p>
      </div>

      <div v-else class="gate">
        <p>Please complete the captcha to verify your email address.</p>
        <div ref="captchaEl" class="captcha-box"></div>
        <el-button type="primary" :disabled="!token || submitting" @click="doVerify">Verify email</el-button>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.wrap {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
}
.card {
  width: 420px;
  padding: 8px 8px 16px;
}
.title {
  text-align: center;
  color: #409eff;
  margin: 8px 0 24px;
}
.pending {
  text-align: center;
  color: #909399;
  padding: 24px 0;
}
.gate {
  text-align: center;
  color: #606266;
}
.gate .captcha-box {
  display: flex;
  justify-content: center;
  margin: 8px 0 16px;
}
</style>
