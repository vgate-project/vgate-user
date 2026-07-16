<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { apiUser } from '@/api/user'
import { apiTraffic } from '@/api/traffic'
import { apiOrder } from '@/api/order'
import { apiNode } from '@/api/node'
import { usePendingOrderStore } from '@/stores/pendingOrder'
import TrafficBarChart from '@/components/TrafficBarChart.vue'
import { formatBytes, formatDateTime } from '@/utils/format'
import { OrderKindReset } from '@/types/api'
import type { User, HourlyStat, Order, UserNode } from '@/types/api'
import PaymentDialog from '@/components/PaymentDialog.vue'

const router = useRouter()
const pending = usePendingOrderStore()

const profile = ref<User | null>(null)
const hourly = ref<HourlyStat[]>([])
const orders = ref<Order[]>([])
const nodes = ref<UserNode[]>([])
const loading = ref(true)

const usedTotal = computed(() =>
  profile.value ? profile.value.up_total + profile.value.down_total : 0,
)
const quota = computed(() => profile.value?.quota_bytes ?? 0)
const remaining = computed(() => (quota.value === 0 ? -1 : Math.max(quota.value - usedTotal.value, 0)))
const usedPct = computed(() => {
  if (quota.value === 0) return 0
  return Math.min(Math.round((usedTotal.value / quota.value) * 100), 100)
})
const pendingOrders = computed(() => orders.value.filter((o) => o.status === 'pending'))
const onlineCount = computed(() => nodes.value.filter((n) => n.online).length)
const activeProduct = computed(() => {
  const p = profile.value
  if (!p?.current_product_name) return '—'
  return `${p.current_product_name}${p.current_product_kind ? ` (${p.current_product_kind})` : ''}`
})
const expireText = computed(() => {
  const e = profile.value?.expire_at
  if (!e || e === '0001-01-01T00:00:00Z') return '—'
  return formatDateTime(e)
})

// Absolute base for the share URL / subscription link (mirrors SubscriptionView).
const apiBase = computed(() => {
  const cfg = window.__ENV__?.API_BASE_URL
  if (cfg) return cfg.replace(/\/$/, '')
  return `${window.location.origin}/api/v1`
})
const shareUrl = computed(() =>
  profile.value ? `${apiBase.value}/sub/${profile.value.sub_token}` : '',
)
const resetEnabled = computed(() => profile.value?.current_plan_reset_enabled ?? false)
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

const resetting = ref(false)
let resetTimer: ReturnType<typeof setInterval> | null = null
function stopResetPoll() {
  if (resetTimer) {
    clearInterval(resetTimer)
    resetTimer = null
  }
}
function pollUntilResetPaid(orderId: string) {
  stopResetPoll()
  resetTimer = setInterval(async () => {
    try {
      const { data } = await apiOrder.get(orderId)
      if (data.status === 'paid') {
        stopResetPoll()
        ElMessage.success('Payment confirmed. Your traffic has been reset.')
        await loadAll()
        pending.refresh()
      } else if (data.status === 'closed') {
        stopResetPoll()
        ElMessage.info('Order closed. You may try again.')
      }
    } catch {
      /* ignore transient errors during polling */
    }
  }, 3000)
  setTimeout(stopResetPoll, 120000)
}

const payVisible = ref(false)
const payUrl = ref('')
const payMode = ref<'redirect' | 'qr'>('redirect')

async function onResetTraffic() {
  const pid = profile.value?.current_product_id
  if (!pid || !resetEnabled.value) return
  resetting.value = true
  try {
    const { data } = await apiOrder.create({ kind: OrderKindReset, plan_id: pid })
    if (data.pay_url) {
      payUrl.value = data.pay_url
      payMode.value = data.pay_mode === 'qr' ? 'qr' : 'redirect'
      if (payMode.value === 'qr') {
        payVisible.value = true
      } else {
        window.open(data.pay_url, '_blank')
      }
      ElMessage.success('Order created — complete payment to reset traffic.')
      await pending.refresh()
      pollUntilResetPaid(data.order.id)
    } else {
      ElMessage.warning('No payment URL returned.')
    }
  } catch {
    /* error toasted by interceptor */
  } finally {
    resetting.value = false
  }
}

async function loadAll() {
  const [p, h, o, n] = await Promise.all([
    apiUser.profile(),
    apiTraffic.hourly(),
    apiOrder.list({ page: 1, page_size: 20 }),
    apiNode.listMine(),
  ])
  profile.value = p.data
  hourly.value = h.data
  orders.value = o.data.items
  nodes.value = n.data
}

onMounted(async () => {
  try {
    await loadAll()
  } catch {
    /* errors surfaced per-field via empty state */
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div v-loading="loading">
    <h2 style="margin: 0 0 16px">Dashboard</h2>

    <el-row :gutter="16" class="stat-row">
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="never" class="stat">
          <div class="stat-label">Current plan</div>
          <div class="stat-value">
            {{ profile?.current_product_name || '—' }}
            <el-tag v-if="profile?.current_product_kind" size="small" type="info" class="kind-tag">
              {{ profile.current_product_kind }}
            </el-tag>
          </div>
          <div class="stat-sub">Expires: {{ expireText }}</div>
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
          <div class="stat-value">{{ quota === 0 ? '∞' : formatBytes(remaining) }}</div>
          <div class="stat-sub">{{ quota === 0 ? 'Unlimited plan' : usedPct + '% used' }}</div>
          <div v-if="resetEnabled" class="stat-action">
            <el-popconfirm
                title="Reset traffic now? This creates a paid order."
                width="260"
                confirm-button-text="Reset"
                cancel-button-text="Cancel"
                confirm-button-type="warning"
                @confirm="onResetTraffic"
            >
              <template #reference>
                <el-button size="small" type="warning" :loading="resetting">
                  Reset traffic
                </el-button>
              </template>
            </el-popconfirm>
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
            <el-descriptions-item label="Email">{{ profile?.email || '—' }}</el-descriptions-item>
            <el-descriptions-item label="Status">
              <el-tag :type="profile?.enabled ? 'success' : 'danger'" size="small">
                {{ profile?.enabled ? 'Enabled' : 'Disabled' }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="Plan">
              {{ profile?.current_product_name || '-' }}
              <el-tag v-if="profile?.current_product_kind" type="primary" size="small">
                {{ profile?.current_product_kind }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="Level">{{ profile?.level ?? '—' }}</el-descriptions-item>
            <el-descriptions-item label="Speed limit">{{ speedLimitText }}</el-descriptions-item>
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
          <el-table :data="nodes" size="small" style="width: 100%" max-height="220" empty-text="No nodes available">
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

    <el-card shadow="never" class="block">
      <template #header>Traffic</template>
      <TrafficBarChart :data="hourly" />
    </el-card>

    <PaymentDialog v-model="payVisible" :pay-url="payUrl" :pay-mode="payMode" />
  </div>
</template>

<style scoped>
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
</style>
