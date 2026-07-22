<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import { apiAuth } from '@/api/auth'
import type { UserConfig, UserLoginResponse } from '@/types'

const auth = useAuthStore()
const app = useAppStore()
const route = useRoute()
const router = useRouter()

const mode = ref<'login' | 'register'>('login')

// Public registration gate, fetched once so we can hide the register option
// when the admin has disabled open signups.
const config = ref<UserConfig | null>(null)
const loadingConfig = ref(false)
const registerEnabled = computed(() => config.value?.register_enabled ?? false)
const requireInvite = computed(() => config.value?.register_require_invite ?? false)
const captchaEnabled = computed(() => config.value?.captcha_enabled ?? false)
// Allowed email domains for registration (from the manager's whitelist). When
// non-empty the register email field is rendered as a local-part input plus a
// domain dropdown; when empty the user types a free email address.
const emailWhitelist = computed(() => config.value?.register_email_suffix_whitelist ?? [])

async function loadConfig() {
  loadingConfig.value = true
  try {
    const { data } = await apiAuth.getConfig()
    config.value = data
    app.siteName = data.site_name || 'VGate'
    document.title = app.siteName
  } catch {
    // Config is non-critical; default to hiding the register option.
    config.value = null
  } finally {
    loadingConfig.value = false
  }
}
onMounted(loadConfig)

function go(target: 'login' | 'register') {
  mode.value = target
}

// ---- Cloudflare Turnstile ----
// The widget is rendered only when the backend reports captcha_enabled. We keep
// a single active widget (only one form is visible at a time) and re-render it
// whenever the active form or captcha availability changes.
const captchaToken = ref('')
const loginCaptchaEl = ref<HTMLElement | null>(null)
const regCaptchaEl = ref<HTMLElement | null>(null)
let activeWidgetId: number | null = null

function activeCaptchaEl(): HTMLElement | null {
  if (mode.value === 'login') return loginCaptchaEl.value
  return regCaptchaEl.value
}

function resetCaptcha() {
  captchaToken.value = ''
  if (activeWidgetId !== null && (window as any).turnstile) {
    ;(window as any).turnstile.reset(activeWidgetId)
    activeWidgetId = null
  }
}

function renderCaptcha() {
  const el = activeCaptchaEl()
  const sitekey = config.value?.captcha_site_key
  if (!el || !(window as any).turnstile || !sitekey) return
  activeWidgetId = (window as any).turnstile.render(el, {
    sitekey,
    callback: (token: string) => {
      captchaToken.value = token
    },
    'expired-callback': () => {
      captchaToken.value = ''
    },
    'error-callback': () => {
      captchaToken.value = ''
    },
  })
}

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

// When captcha becomes/enables or the form switches, (re)mount the widget.
watch(
  [captchaEnabled, mode],
  async ([enabled]) => {
    captchaToken.value = ''
    activeWidgetId = null
    if (!enabled) return
    await nextTick()
    ensureTurnstile(renderCaptcha)
  },
  { immediate: false },
)

// ---- Login ----
const email = ref('')
const password = ref('')
const loading = ref(false)

async function onLogin() {
  if (!email.value || !password.value) {
    ElMessage.warning('Please enter your email and password')
    return
  }
  if (captchaEnabled.value && !captchaToken.value) {
    ElMessage.warning('Please complete the captcha')
    return
  }
  loading.value = true
  try {
    await auth.login(email.value, password.value, captchaToken.value || undefined)
    const redirect = (route.query.redirect as string) || '/'
    router.replace(redirect)
  } catch {
    // Error surfaced by the http interceptor. Force a fresh challenge.
    resetCaptcha()
  } finally {
    loading.value = false
  }
}

// ---- Register ----
const reg = ref({ username: '', email: '', emailLocal: '', emailDomain: '', password: '', confirm: '', inviteCode: '' })
const registering = ref(false)

// Default the domain dropdown to the first allowed domain once the whitelist
// loads, so the user always has a valid selection.
watch(emailWhitelist, (list) => {
  if (list.length && !reg.value.emailDomain) {
    reg.value.emailDomain = list[0]
  }
})

async function onRegister() {
  // When a domain whitelist is active, compose the full email from the
  // local-part input and the selected domain before validating/submitting.
  if (emailWhitelist.value.length) {
    reg.value.email = reg.value.emailLocal.trim() + '@' + reg.value.emailDomain
  }
  if (!reg.value.username || !reg.value.email || !reg.value.password) {
    ElMessage.warning('Please fill in username, email and password')
    return
  }
  if (reg.value.password.length < 8) {
    ElMessage.error('Password must be at least 8 characters')
    return
  }
  if (reg.value.password !== reg.value.confirm) {
    ElMessage.error('Passwords do not match')
    return
  }
  if (requireInvite.value && !reg.value.inviteCode) {
    ElMessage.warning('An invite code is required to register')
    return
  }
  if (captchaEnabled.value && !captchaToken.value) {
    ElMessage.warning('Please complete the captcha')
    return
  }

  registering.value = true
  try {
    const resp = await apiAuth.register({
      username: reg.value.username,
      email: reg.value.email,
      password: reg.value.password,
      invite_code: reg.value.inviteCode || undefined,
      cf_turnstile_response: captchaToken.value || undefined,
    })
    if (resp.status === 201 || resp.status === 202) {
      // Both verified (201) and verification-pending (202) return a session,
      // so auto-log-in either way. A pending user lands on the dashboard,
      // where the verify banner guides them to confirm their email.
      auth.setSession(resp.data)
      const redirect = (route.query.redirect as string) || '/'
      router.replace(redirect)
      return
    }
  } catch {
    // Error surfaced by the http interceptor. Force a fresh challenge.
    resetCaptcha()
  } finally {
    registering.value = false
  }
}

</script>



<template>
  <div class="login-wrap">
    <el-card class="login-card" shadow="always">
      <h2 class="title">{{ app.siteName }}</h2>

      <!-- Login -->
      <template v-if="mode === 'login'">
        <el-form label-position="top" @submit.prevent="onLogin">
          <el-form-item label="Email">
            <el-input v-model="email" autofocus placeholder="Email" />
          </el-form-item>
          <el-form-item label="Password">
            <el-input
              v-model="password"
              type="password"
              show-password
              placeholder="Password"
              @keyup.enter="onLogin"
            />
          </el-form-item>
          <div v-if="captchaEnabled" ref="loginCaptchaEl" class="captcha-box"></div>
          <el-button type="primary" style="width: 100%" :loading="loading" @click="onLogin">
            Login
          </el-button>
        </el-form>
        <div v-if="registerEnabled" class="switch">
          <span>No account?</span>
          <el-link type="primary" :underline="false" @click="go('register')">Register</el-link>
        </div>
      </template>

      <!-- Register -->
      <template v-else>
        <el-form label-position="top" @submit.prevent="onRegister">
          <el-form-item label="Username">
            <el-input v-model="reg.username" autofocus placeholder="Choose a username" />
          </el-form-item>
          <el-form-item v-if="emailWhitelist.length" label="Email">
            <el-input v-model="reg.emailLocal" placeholder="username">
              <template #append>
                <el-select v-model="reg.emailDomain" placeholder="@domain" style="width: 170px">
                  <el-option v-for="d in emailWhitelist" :key="d" :label="'@' + d" :value="d" />
                </el-select>
              </template>
            </el-input>
          </el-form-item>
          <el-form-item v-else label="Email">
            <el-input v-model="reg.email" type="email" placeholder="you@example.com" />
          </el-form-item>
          <el-form-item label="Password">
            <el-input
              v-model="reg.password"
              type="password"
              show-password
              placeholder="At least 8 characters"
            />
          </el-form-item>
          <el-form-item label="Confirm password">
            <el-input
              v-model="reg.confirm"
              type="password"
              show-password
              placeholder="Re-enter password"
              @keyup.enter="onRegister"
            />
          </el-form-item>
          <el-form-item v-if="requireInvite" label="Invite code">
            <el-input v-model="reg.inviteCode" placeholder="Required invite code" />
          </el-form-item>
          <div v-if="captchaEnabled" ref="regCaptchaEl" class="captcha-box"></div>
          <el-button type="primary" style="width: 100%" :loading="registering" @click="onRegister">
            Register
          </el-button>
        </el-form>
        <div class="switch">
          <span>Already have an account?</span>
          <el-link type="primary" :underline="false" @click="go('login')">Login</el-link>
        </div>
      </template>
    </el-card>
  </div>
</template>

<style scoped>
.login-wrap {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
}
.login-card {
  width: 360px;
  padding: 8px 8px 16px;
}
.title {
  text-align: center;
  color: #409eff;
  margin: 8px 0 24px;
}
.switch {
  margin-top: 12px;
  text-align: center;
  font-size: 13px;
  color: #909399;
}
.switch .el-link {
  margin-left: 4px;
}
.captcha-box {
  margin-bottom: 18px;
  min-height: 10px;
}
</style>
