<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { apiAuth } from '@/api/auth'
import { useAppStore } from '@/stores/app'
import { useDashboardStore } from '@/stores/dashboard'
import TrafficBarChart from '@/components/TrafficBarChart.vue'
import { formatBytes, formatDateTime, formatPrice } from '@/utils/format'
import type { User, HourlyStat, Order, UserNode, TrafficGrantView } from '@/types/api'
import PaymentDialog from '@/components/PaymentDialog.vue'

const router = useRouter()
const app = useAppStore()
const dashboard = useDashboardStore()

// All home-page data comes from the single dashboard payload (the layout
// shell already loaded it and keeps it fresh via polling).
const profile = computed<User | null>(() => dashboard.profile)
const hourly = computed<HourlyStat[]>(() => dashboard.hourlyTraffic)
const orders = computed<Order[]>(() => dashboard.recentOrders)
const nodes = computed<UserNode[]>(() => dashboard.nodes)
const loading = ref(true)

// Email verification banner: an unverified account can log in and manage its
// profile, but cannot purchase or consume traffic until it verifies its email.
const emailUnverified = computed(() => !!profile.value && !profile.value.email_verified)

// Turnstile captcha for the resend action. The backend gates
// POST /user/resend-verification behind the same captcha as register/verify
// (see user_auth.go ResendVerification), so when it is enabled we must render
// a widget and forward the token. This mirrors VerifyEmailView.
const captchaEnabled = computed(() => app.captchaEnabled)
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
  const sitekey = app.captchaSiteKey
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

function resetResendCaptcha() {
  if (activeWidgetId !== null && (window as any).turnstile) {
    ;(window as any).turnstile.reset(activeWidgetId)
  }
  captchaToken.value = ''
}

const resending = ref(false)
async function resendVerification() {
  if (!profile.value?.email) return
  if (captchaEnabled.value && !captchaToken.value) {
    ElMessage.warning('Please complete the captcha')
    return
  }
  resending.value = true
  try {
    await apiAuth.resendVerification(
      profile.value.email,
      captchaEnabled.value ? captchaToken.value : undefined,
    )
    ElMessage.success('Verification email sent — please check your inbox.')
    resetResendCaptcha()
  } catch {
    /* error toasted by interceptor */
    resetResendCaptcha()
  } finally {
    resending.value = false
  }
}

// Render the captcha widget once the verify banner is visible and captcha is on.
watch(
  () => emailUnverified.value && captchaEnabled.value,
  async (show) => {
    if (!show) return
    await nextTick()
    ensureTurnstile(renderCaptcha)
  },
)

const usedTotal = computed(() =>
  profile.value ? profile.value.up_total + profile.value.down_total : 0,
)
// Effective quota: base plan quota (QuotaBytes) + active traffic-package /
// redemption bonuses (TrafficQuotaBytes). -1 (unlimited) stays -1 regardless.
function effectiveQuota(u: User | null): number {
  if (!u) return 0
  if (u.quota_bytes < 0) return -1 // unlimited
  return u.quota_bytes + (u.traffic_quota_bytes ?? 0)
}
const quota = computed(() => effectiveQuota(profile.value))
const bonusQuota = computed(() => profile.value?.traffic_quota_bytes ?? 0)
const quotaUnlimited = computed(() => quota.value === -1)
const remaining = computed(() =>
  quotaUnlimited.value ? -1 : Math.max(quota.value - usedTotal.value, 0),
)

// Package-first breakdown: traffic charged to grants is tracked separately
// (package_used_bytes) and survives base-plan resets.
const packageUsed = computed(() => profile.value?.package_used_bytes ?? 0)
const baseUsed = computed(() =>
  Math.max(0, usedTotal.value - packageUsed.value),
)
const baseQuota = computed(() =>
  profile.value && profile.value.quota_bytes < 0 ? -1 : profile.value?.quota_bytes ?? 0,
)
const baseRemaining = computed(() =>
  baseQuota.value < 0 ? -1 : Math.max(0, baseQuota.value - baseUsed.value),
)
const packageRemaining = computed(() => bonusQuota.value)
const trafficGrants = computed<TrafficGrantView[]>(
  () => (profile.value?.traffic_grants ?? []) as TrafficGrantView[],
)
function grantRemaining(g: TrafficGrantView): number {
  return Math.max(0, g.quota_bytes - (g.used_bytes ?? 0))
}
function grantPct(g: TrafficGrantView): number {
  if (!g.quota_bytes) return 0
  const used = Math.min(g.used_bytes ?? 0, g.quota_bytes)
  return Math.min(100, Math.round((used / g.quota_bytes) * 100))
}
function grantSourceLabel(s: string): string {
  return s === 'traffic_package' ? 'Package' : 'Redemption'
}
const usedPct = computed(() => {
  if (quotaUnlimited.value) return 0
  if (quota.value === 0) return 100
  return Math.min(Math.round((usedTotal.value / quota.value) * 100), 100)
})
const pendingOrders = computed(() => orders.value.filter((o) => o.status === 'pending'))
const onlineCount = computed(() => nodes.value.filter((n) => n.online).length)
const activeProduct = computed(() => {
  const p = profile.value
  if (!p?.current_product_name) return '—'
  return p.current_product_name
})
const expireText = computed(() => {
  const e = profile.value?.expire_at
  if (!e || e === '0001-01-01T00:00:00Z') return '—'
  return formatDateTime(e)
})
// Show the Renew button when the plan is expired or within 7 days of expiry.
const RENEW_THRESHOLD_DAYS = 7
const showRenew = computed(() => {
  const e = profile.value?.expire_at
  if (!e || e === '0001-01-01T00:00:00Z') return false
  const msLeft = new Date(e).getTime() - Date.now()
  return msLeft <= RENEW_THRESHOLD_DAYS * 24 * 60 * 60 * 1000
})
function onRenew() {
  router.push('/plans')
}
function onBuyTraffic() {
  router.push({ name: 'traffic-packages' })
}

// Absolute base for the share URL / subscription link (mirrors SubscriptionView).
const apiBase = computed(() => {
  const cfg = window.__ENV__?.API_BASE_URL
  if (cfg) return cfg.replace(/\/$/, '')
  return `${window.location.origin}/api/v1`
})
const shareUrl = computed(() =>
  profile.value ? `${apiBase.value}/sub/${profile.value.sub_token}` : '',
)
// 1 Mbps = 125000 bytes/sec; 0/absent means unlimited.
const BPS_PER_MBPS = 125000
const speedLimitText = computed(() => {
  const up = profile.value?.speed_limit_up_bps ?? 0
  const down = profile.value?.speed_limit_down_bps ?? 0
  if (!up && !down) return 'Unlimited'
  return `↑${up ? Math.round(up / BPS_PER_MBPS) : '∞'} / ↓${down ? Math.round(down / BPS_PER_MBPS) : '∞'} Mbps`
})

async function copySubscription() {
  if (!shareUrl.value) return
  try {
    await navigator.clipboard.writeText(shareUrl.value)
    ElMessage.success('Subscription link copied')
  } catch {
    ElMessage.error('Copy failed')
  }
}

const payVisible = ref(false)
const payUrl = ref('')
const payMode = ref<'redirect' | 'qr'>('redirect')
const payPlatform = ref('')
const payAmount = ref<number | undefined>()

onMounted(async () => {
  // Dashboard data is loaded by the shell (and de-duped if already in flight).
  try {
    await dashboard.refresh()
  } catch {
    /* errors surfaced per-field via empty state */
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div v-loading="loading" class="dashboard-root">
    <h2 style="margin: 0 0 16px">Dashboard</h2>

    <el-alert
      v-if="emailUnverified"
      type="warning"
      show-icon
      :closable="false"
      class="verify-banner"
      title="Your email is not verified"
    >
      <template #default>
        <span>Purchases and traffic are disabled until you verify. </span>
        <div v-if="captchaEnabled" ref="captchaEl" class="captcha-box"></div>
        <el-button
          type="primary"
          link
          size="small"
          :loading="resending"
          :disabled="captchaEnabled && !captchaToken"
          @click="resendVerification"
        >
          Resend verification email
        </el-button>
      </template>
    </el-alert>

    <el-row :gutter="16" class="stat-row">
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="never" class="stat">
          <div class="stat-label">Current plan</div>
          <div class="stat-value">
            {{ profile?.current_product_name || '—' }}
          </div>
          <div class="stat-sub">
            Expires: {{ expireText }}
            <el-button v-if="showRenew" link type="primary" size="small" @click="onRenew">Renew</el-button>
          </div>
          <div class="stat-action">
            <el-button type="primary" size="small" :disabled="!profile?.sub_token" @click="copySubscription">
              Copy subscription
            </el-button>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="never" class="stat">
          <div class="stat-label">Remaining</div>
          <div class="stat-value">{{ quotaUnlimited ? '∞' : formatBytes(remaining) }}</div>
          <div class="stat-sub">
            <template v-if="quotaUnlimited">Unlimited plan</template>
            <template v-else-if="quota === 0">No quota</template>
            <template v-else>
              {{ usedPct }}% used
              <template v-if="trafficGrants.length">
                · Base {{ baseRemaining === -1 ? '∞' : formatBytes(baseRemaining) }}
                · Package {{ formatBytes(packageRemaining) }}
              </template>
            </template>
          </div>
          <div class="stat-action">
            <el-button type="primary" size="small" @click="onBuyTraffic">Buy traffic</el-button>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="never" class="stat clickable"  @click="router.push('/traffic')">
          <div class="stat-label">Traffic used</div>
          <div class="stat-value">{{ formatBytes(usedTotal) }}</div>
          <div class="stat-sub">View traffic →</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="never" class="stat clickable" @click="router.push('/orders')">
          <div class="stat-label">Pending orders</div>
          <div class="stat-value">{{ pendingOrders.length }}</div>
          <div class="stat-sub">View orders →</div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" class="stat-row">
      <el-col :xs="24" :md="12">
        <el-card shadow="never" class="info-card">
          <template #header>Account</template>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="User ID">{{ profile?.id || '—' }}</el-descriptions-item>
            <el-descriptions-item label="Username">{{ profile?.username || '—' }}</el-descriptions-item>
            <el-descriptions-item label="Email">
              {{ profile?.email || '—' }}
              <el-tag
                v-if="profile?.email"
                :type="profile?.email_verified ? 'success' : 'warning'"
                size="small"
                style="margin-left: 8px"
              >{{ profile?.email_verified ? 'Verified' : 'Unverified' }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="Status">
              <el-tag :type="profile?.enabled ? 'success' : 'danger'" size="small">
                {{ profile?.enabled ? 'Enabled' : 'Disabled' }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="Plan">
              {{ profile?.current_product_name || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="Level">{{ profile?.level ?? '—' }}</el-descriptions-item>
            <el-descriptions-item label="Speed limit">{{ speedLimitText }}</el-descriptions-item>
            <el-descriptions-item label="Wallet Balance">{{ formatPrice(profile?.balance_cents ?? 0) }}</el-descriptions-item>
            <el-descriptions-item label="Expires">{{ expireText }}</el-descriptions-item>
            <el-descriptions-item label="Created">{{ formatDateTime(profile?.created_at) }}</el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>
      <el-col :xs="24" :md="12">
        <el-card shadow="never" class="info-card">
          <template #header>
            <div class="head-actions">
              <span>Node status</span>
              <el-tag size="small" :type="nodes.length ? (onlineCount ? 'success' : 'info') : 'info'">
                {{ onlineCount }}/{{ nodes.length }} online
              </el-tag>
            </div>
          </template>
          <el-table :data="nodes" size="small" style="width: 100%" max-height="200" empty-text="No nodes available">
            <el-table-column label="Status" width="92">
              <template #default="{ row }">
                <span class="node-dot" :class="row.online ? 'on' : 'off'" />
                <el-tag size="small" :type="row.online ? 'success' : 'info'">
                  {{ row.online ? 'Online' : 'Offline' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="name" label="Name" />
            <el-table-column label="Address">
              <template #default="{ row }">
                {{ row.enabled ? `${row.address}:${row.port}` : 'Disabled' }}
              </template>
            </el-table-column>
            <el-table-column label="Multiplier" width="110">
              <template #default="{ row }">×{{ (row.traffic_multiplier ?? 1).toFixed(2) }}</template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" class="stat-row" style="flex: 1">
      <el-col :xs="24" :md="12">
        <el-card shadow="never" class="block info-card">
          <template #header>Traffic packages</template>
          <el-table v-if="trafficGrants.length" :data="trafficGrants" size="small" style="width: 100%">
            <el-table-column label="Name" min-width="140">
              <template #default="{ row }">{{ row.name || grantSourceLabel(row.source) }}</template>
            </el-table-column>
            <el-table-column label="Source" width="100">
              <template #default="{ row }">{{ grantSourceLabel(row.source) }}</template>
            </el-table-column>
            <el-table-column label="Remaining / Usage" min-width="220">
              <template #default="{ row }">
                <div class="grant-usage">
                  <span class="grant-remain">{{ formatBytes(grantRemaining(row as TrafficGrantView)) }} / {{ formatBytes(row.quota_bytes) }}</span>
                  <el-progress :percentage="grantPct(row as TrafficGrantView)" :show-text="false" class="grant-bar" />
                </div>
              </template>
            </el-table-column>
            <el-table-column label="Order time" min-width="160">
              <template #default="{ row }">{{ row.granted_at ? formatDateTime(row.granted_at) : '—' }}</template>
            </el-table-column>
          </el-table>
          <el-empty v-else description="No traffic packages" :image-size="60" />
        </el-card>
      </el-col>
      <el-col :xs="24" :md="12">
        <el-card shadow="never" class="block info-card">
          <TrafficBarChart :data="hourly" />
        </el-card>
      </el-col>
    </el-row>

    <PaymentDialog v-model="payVisible" :pay-url="payUrl" :pay-mode="payMode" :platform="payPlatform" :amount="payAmount" />
  </div>
</template>

<style scoped>
.dashboard-root {
  display: flex;
  flex-direction: column;
  /* Fill the main content area (100vh minus the 24px top/bottom padding). The
     final chart/packages row uses flex:1 to grow into the leftover space. */
  min-height: 80vh;
}
.stat-row :deep(.el-col) {
  display: flex;
}
.stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  margin-bottom: 16px;
}
.stat :deep(.el-card__body) {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.stat-label {
  font-size: 13px;
  color: #909399;
}
.stat-value {
  font-size: 1.4rem;
  font-weight: 700;
  color: #303133;
  margin: 6px 0 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.kind-tag {
  margin-left: 8px;
  vertical-align: middle;
  font-weight: 400;
}
.stat-sub {
  font-size: 12px;
  color: #909399;
}
.stat-action {
  margin-top: auto;
  text-align: right;
}

.clickable {
  cursor: pointer;
}
.clickable:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}
.block {
  margin-bottom: 16px;
}
.verify-banner :deep(.captcha-box) {
  margin: 8px 0;
}
.info-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  margin-bottom: 16px;
}
.info-card :deep(.el-card__body) {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.node-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
  vertical-align: middle;
  background: #c0c4cc;
}
.node-dot.on {
  background: #67c23a;
}
.head-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.grant-usage {
  display: flex;
  align-items: center;
  gap: 10px;
}
.grant-remain {
  font-size: 13px;
  color: #303133;
  white-space: nowrap;
}
.grant-bar {
  flex: 1;
  min-width: 80px;
}
</style>
