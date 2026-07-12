<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

import { apiAuth } from '@/api/auth'
import type { UserConfig } from '@/types'

const route = useRoute()
const router = useRouter()

type Status = 'idle' | 'verifying' | 'success' | 'error'
const status = ref<Status>('idle')
const message = ref('')

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
  if (!token) {
    status.value = 'error'
    message.value = 'Missing verification token in the link.'
    return
  }
  if (captchaEnabled.value && !captchaToken.value) {
    ElMessage.warning('Please complete the captcha')
    return
  }
  status.value = 'verifying'
  try {
    await apiAuth.verifyEmail(token, captchaEnabled.value ? captchaToken.value : undefined)
    status.value = 'success'
    message.value = 'Email verified. Your account is now active — you can log in.'
    ElMessage.success('Email verified')
  } catch {
    // Error (e.g. expired/invalid token) surfaced by the http interceptor.
    status.value = 'error'
    message.value = 'Verification failed. The link may be invalid or expired.'
    if (activeWidgetId !== null && (window as any).turnstile) {
      ;(window as any).turnstile.reset(activeWidgetId)
      captchaToken.value = ''
    }
  }
}

onMounted(async () => {
  try {
    const { data } = await apiAuth.getConfig()
    config.value = data
    captchaEnabled.value = !!data.captcha_enabled
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
          <el-button type="primary" @click="router.push('/login')">Go to login</el-button>
        </template>
      </el-result>

      <el-result
        v-else-if="status === 'error'"
        icon="error"
        title="Verification failed"
        :sub-title="message"
      >
        <template #extra>
          <el-button type="primary" @click="router.push('/login')">Go to login</el-button>
        </template>
      </el-result>

      <div v-else-if="status === 'verifying'" class="pending">
        <el-icon class="is-loading" :size="32" color="#409eff"><Loading /></el-icon>
        <p>Verifying your email…</p>
      </div>

      <div v-else class="gate">
        <p>Please complete the captcha to verify your email address.</p>
        <div ref="captchaEl" class="captcha-box"></div>
        <el-button type="primary" :disabled="!token" @click="doVerify">Verify email</el-button>
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
