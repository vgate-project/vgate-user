<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { apiPlan } from '@/api/plan'
import { apiTrafficPackage } from '@/api/traffic'
import { apiOrder } from '@/api/order'
import { apiChangePlan } from '@/api/changeplan'
import { apiPayment } from '@/api/payment'
import { useDashboardStore } from '@/stores/dashboard'
import { formatBytes, formatPrice } from '@/utils/format'
import { renderDescription } from '@/utils/description'
import type { Plan, PlanPrice, TrafficPackage, PaymentMethodInfo } from '@/types/api'
import { OrderKindPlan, OrderKindTraffic } from '@/types/api'
import PaymentDialog from '@/components/PaymentDialog.vue'
import PaymentMethodDialog from '@/components/PaymentMethodDialog.vue'

const dashboard = useDashboardStore()

const plans = ref<Plan[]>([])
const packages = ref<TrafficPackage[]>([])
const loading = ref(true)
const buyingId = ref('')
// The caller's profile is read from the shared dashboard payload (no separate
// /user/profile request), and kept fresh by dashboard.refresh() after actions.
const profile = computed(() => dashboard.profile)

// The plan the user currently holds (active plan only).
const currentPlanId = computed(() => profile.value?.current_product_id ?? '')

// Shared payment dialog: shows a QR code for wechat (pay_mode="qr") or a link
// for alipay/stripe (pay_mode="redirect").
const payVisible = ref(false)
const payUrl = ref('')
const payMode = ref<'redirect' | 'qr' | 'iap'>('redirect')
const payPlatform = ref('')
const payAmount = ref<number | undefined>()

function presentPayment(payUrlValue: string, payModeValue?: string, platformValue?: string, amountValue?: number) {
  payUrl.value = payUrlValue
  payMode.value = (payModeValue === 'qr' || payModeValue === 'iap' ? payModeValue : 'redirect') as 'redirect' | 'qr' | 'iap'
  payPlatform.value = platformValue ?? ''
  payAmount.value = amountValue
  if (payMode.value === 'qr' || payMode.value === 'iap') {
    // QR: render a scannable code. IAP (Apple): the native app completes the
    // purchase; the web just shows an instruction and polls for completion.
    payVisible.value = true
  } else {
    window.open(payUrlValue, '_blank')
  }
}

// Available payment channels (admin-enabled + configured), used by the method
// picker.
const paymentMethods = ref<PaymentMethodInfo[]>([])
const methodDialogVisible = ref(false)
const methodAction = ref<(platform: string) => Promise<void>>(async () => {})

// Open the channel picker, running `action` with the chosen platform on
// confirm. If only one channel is available we skip the picker.
function openPicker(action: (platform: string) => Promise<void>) {
  const available = paymentMethods.value.filter((m) => m.enabled && m.configured)
  if (available.length <= 1) {
    void action(available[0]?.platform ?? '')
    return
  }
  methodAction.value = action
  methodDialogVisible.value = true
}

async function onMethodSelected(platform: string) {
  await methodAction.value(platform)
}

// Selected price id per plan (keyed by plan id) so the user picks a billing
// period before buying.
const selectedPrice = ref<Record<string, string>>({})

const periodLabels: Record<string, string> = {
  month: 'Monthly',
  quarter: 'Quarterly',
  half_year: 'Half-year',
  year: 'Yearly',
}

function periodLabel(p: PlanPrice): string {
  return periodLabels[p.period] || p.period
}

function selectedPriceFor(plan: Plan): PlanPrice | undefined {
  const id = selectedPrice.value[plan.id]
  return plan.prices?.find((pr) => pr.id === id) || plan.prices?.[0]
}

async function buyPlan(plan: Plan) {
  const price = selectedPriceFor(plan)
  if (!price) {
    ElMessage.warning('Please select a billing period')
    return
  }
  openPicker((platform) => doBuyPlan(plan, price, platform))
}

async function doBuyPlan(plan: Plan, price: PlanPrice, platform: string) {
  buyingId.value = 'plan:' + plan.id + ':' + price.id
  try {
    const { data } = await apiOrder.create({
      kind: OrderKindPlan,
      plan_id: plan.id,
      plan_price_id: price.id,
      platform,
    })
    if (data.pay_url || data.pay_mode === 'iap') {
      presentPayment(data.pay_url, data.pay_mode, data.order?.platform, data.order?.amount)
      ElMessage.success('Order created. Please complete payment.')
      pollUntilPaid(data.order.id)
    } else {
      ElMessage.warning('No payment link returned.')
    }
  } catch {
    /* error toasted by interceptor */
  } finally {
    buyingId.value = ''
  }
}

async function buyTraffic(pkg: TrafficPackage) {
  openPicker((platform) => doBuyTraffic(pkg, platform))
}

async function doBuyTraffic(pkg: TrafficPackage, platform: string) {
  buyingId.value = 'traffic:' + pkg.id
  try {
    const { data } = await apiOrder.create({
      kind: OrderKindTraffic,
      traffic_package_id: pkg.id,
      platform,
    })
    if (data.pay_url || data.pay_mode === 'iap') {
      presentPayment(data.pay_url, data.pay_mode, data.order?.platform, data.order?.amount)
      ElMessage.success('Order created. Please complete payment.')
      pollUntilPaid(data.order.id)
    } else {
      ElMessage.warning('No payment link returned.')
    }
  } catch {
    /* error toasted by interceptor */
  } finally {
    buyingId.value = ''
  }
}

// switchPlan moves the user to a different plan via POST /user/change-plan.
// All changes apply immediately: the old plan's remaining value is credited to
// the wallet and the net difference is charged (or refunded). We preview the
// proration numbers first and confirm with the user so they can see the
// remaining value and the price to top up before committing.
async function switchPlan(plan: Plan) {
  const price = selectedPriceFor(plan)
  if (!price) {
    ElMessage.warning('Please select a billing period')
    return
  }
  openPicker((platform) => doSwitchPlan(plan, price, platform))
}

async function doSwitchPlan(plan: Plan, price: PlanPrice, platform: string) {
  buyingId.value = 'switch:' + plan.id + ':' + price.id
  try {
    // Preview the proration (non-mutating) so we can show the exact remaining
    // value and net charge before confirming.
    const { data: preview } = await apiChangePlan.previewChangePlan({
      plan_id: plan.id,
      plan_price_id: price.id,
    })
    const credit = preview.credit_cents
    const net = preview.net_charge_cents
    let detail: string
    if (net > 0) {
      detail =
        `Your current plan's remaining value (${formatPrice(credit)}) will be credited to your wallet.\n` +
        `You'll pay the difference: ${formatPrice(net)}.`
    } else if (net < 0) {
      detail =
        `Your current plan's remaining value (${formatPrice(credit)}) will be credited to your wallet.\n` +
        `The new plan is cheaper, so ${formatPrice(-net)} will be refunded to your wallet.`
    } else {
      detail = `Your current plan's remaining value (${formatPrice(credit)}) will be credited to your wallet. No extra payment is needed.`
    }
    try {
      await ElMessageBox.confirm(detail, `Switch to ${plan.name}?`, {
        confirmButtonText: 'Confirm switch',
        cancelButtonText: 'Cancel',
        type: 'info',
      })
    } catch {
      return // user cancelled
    }

    const { data } = await apiChangePlan.changePlan({ plan_id: plan.id, plan_price_id: price.id, platform })
    if (data.paid) {
      ElMessage.success(`Switched to ${plan.name}.`)
      await dashboard.refresh()
      return
    }
    if (data.pay_url || data.pay_mode === 'iap') {
      presentPayment(data.pay_url, data.pay_mode, data.order?.platform, data.order?.amount)
      ElMessage.success('Order created. Complete payment to finish switching.')
      if (data.order) pollUntilPaid(data.order.id)
    } else {
      ElMessage.warning('No payment link returned.')
    }
  } catch {
    /* error toasted by interceptor */
  } finally {
    buyingId.value = ''
  }
}

let pollTimer: ReturnType<typeof setInterval> | null = null
function pollUntilPaid(orderId: string) {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = setInterval(async () => {
    try {
      const { data } = await apiOrder.get(orderId)
      if (data.status === 'paid') {
        if (pollTimer) clearInterval(pollTimer)
        ElMessage.success('Payment successful. Plan is now active.')
        dashboard.refresh()
        payVisible.value = false
      } else if (data.status === 'closed') {
        if (pollTimer) clearInterval(pollTimer)
        ElMessage.info('Order closed. You can purchase again.')
        dashboard.refresh()
      }
    } catch {
      /* ignore transient errors during polling */
    }
  }, 3000)
  setTimeout(() => {
    if (pollTimer) clearInterval(pollTimer)
  }, 120000)
}

onMounted(async () => {
  try {
    const [plansRes, pkgRes, methodsRes] = await Promise.all([
      apiPlan.list(),
      apiTrafficPackage.list(),
      apiPayment.getMethods(),
    ])
    plans.value = plansRes.data
    packages.value = pkgRes.data
    paymentMethods.value = methodsRes.data ?? []
    plans.value.forEach((p) => {
      if (p.prices && p.prices.length) selectedPrice.value[p.id] = p.prices[0].id
    })
    await dashboard.refresh()
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div v-loading="loading">
    <h2 style="margin: 0 0 16px">Plans & Traffic</h2>

    <el-tabs>
      <el-tab-pane label="Subscription Plans">
        <el-empty v-if="!loading && plans.length === 0" description="No plans available" />
        <el-row :gutter="16">
          <el-col v-for="plan in plans" :key="plan.id" :span="6">
            <el-card shadow="hover" class="plan-card">
              <div class="plan-name">
                {{ plan.name }}
                <el-tag
                  v-if="!plan.enabled && plan.allow_renew_off_shelf"
                  size="small"
                  type="warning"
                  effect="plain"
                  style="margin-left: 8px"
                >
                  Off-shelf · renew only
                </el-tag>
                <el-tag
                  v-if="plan.id === currentPlanId"
                  size="small"
                  type="success"
                  effect="plain"
                  style="margin-left: 8px"
                >
                  Current
                </el-tag>
              </div>
              <el-divider />
              <ul class="plan-meta">
                <li>Traffic: {{ plan.quota_bytes > 0 ? formatBytes(plan.quota_bytes) : 'Unlimited' }}</li>
                <li>Level: L{{ plan.level }}</li>
              </ul>

              <div v-if="plan.prices && plan.prices.length" class="price-options">
                <div
                  v-for="pr in plan.prices"
                  :key="pr.id"
                  class="price-row"
                  :class="{ active: selectedPrice[plan.id] === pr.id }"
                  @click="selectedPrice[plan.id] = pr.id"
                >
                  <span class="price-period">{{ periodLabel(pr) }}</span>
                  <span class="price-amount">{{ formatPrice(pr.price) }}</span>
                  <span class="price-days">{{ pr.duration_days }} days</span>
                </div>
              </div>

              <div v-if="plan.description" class="plan-desc" v-html="renderDescription(plan.description)" />
              <p v-else class="plan-desc">—</p>
              <el-button
                type="primary"
                style="width: 100%"
                :loading="buyingId === (plan.id === currentPlanId ? 'plan:' : 'switch:') + plan.id + ':' + (selectedPriceFor(plan)?.id ?? '')"
                @click="plan.id === currentPlanId ? buyPlan(plan) : switchPlan(plan)"
              >
                {{ plan.id === currentPlanId ? (plan.enabled ? 'Buy' : 'Renew') : 'Switch' }}
              </el-button>
            </el-card>
          </el-col>
        </el-row>
      </el-tab-pane>

      <el-tab-pane label="Traffic Packages">
        <el-empty v-if="!loading && packages.length === 0" description="No traffic packages available" />
        <el-row :gutter="16">
          <el-col v-for="pkg in packages" :key="pkg.id" :span="8">
            <el-card shadow="hover" class="plan-card">
              <div class="plan-name">{{ pkg.name }}</div>
              <div class="plan-price">{{ formatPrice(pkg.price) }}</div>
              <el-divider />
              <ul class="plan-meta">
                <li>Traffic: {{ pkg.quota_bytes > 0 ? formatBytes(pkg.quota_bytes) : 'Unlimited' }}</li>
                <li>Validity: {{ pkg.validity_days > 0 ? pkg.validity_days + ' days' : 'No expiry' }}</li>
              </ul>
              <div v-if="pkg.description" class="plan-desc" v-html="renderDescription(pkg.description)" />
              <p v-else class="plan-desc">—</p>
              <el-button
                type="success"
                style="width: 100%"
                :loading="buyingId === 'traffic:' + pkg.id"
                @click="buyTraffic(pkg)"
              >
                Buy Traffic
              </el-button>
            </el-card>
          </el-col>
        </el-row>
      </el-tab-pane>
    </el-tabs>

    <PaymentDialog v-model="payVisible" :pay-url="payUrl" :pay-mode="payMode" :platform="payPlatform" :amount="payAmount" />
    <PaymentMethodDialog v-model="methodDialogVisible" :methods="paymentMethods" @select="onMethodSelected" />
  </div>
</template>

<style scoped>
/* Make each grid column a flex container so the cards inside stretch to the
   same height as the tallest card in the row. */
.el-row > .el-col {
  display: flex;
}
.plan-card {
  flex: 1;
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
}
/* Stack the card body content vertically and pin the Buy button to the
   bottom so equal-height cards look aligned. */
.plan-card :deep(.el-card__body) {
  display: flex;
  flex-direction: column;
  flex: 1;
}
/* The description carries the auto top-margin (see .plan-desc below), which
   pushes it to the bottom of the card just above the Buy button. The button
   itself no longer needs an auto margin. */
.plan-name {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}
.plan-price {
  font-size: 28px;
  font-weight: 700;
  color: #409eff;
  margin-top: 4px;
}
.plan-meta {
  list-style: none;
  padding: 0;
  margin: 0;
  font-size: 13px;
  color: #606266;
}
.plan-meta li {
  padding: 3px 0;
}
.plan-desc {
  font-size: 12px;
  color: #909399;
  min-height: 32px;
  /* Push the description to the bottom of the card so it lines up with the
     Buy button across cards that have differing content above it. */
  margin-top: auto;
  margin-bottom: 12px;
}
.price-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 8px 0;
}
.price-row {
  display: grid;
  grid-template-columns: 84px 1fr 72px;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.15s;
}
.price-row:hover {
  border-color: #c0c4cc;
}
.price-row.active {
  border-color: #409eff;
  background: #ecf5ff;
  color: #409eff;
}
.price-period {
  font-weight: 600;
}
.price-amount {
  font-weight: 600;
  text-align: right;
}
.price-days {
  color: #909399;
  font-size: 12px;
  text-align: right;
}
</style>
