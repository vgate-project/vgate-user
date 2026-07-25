<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { apiTrafficPackage } from '@/api/traffic'
import { apiOrder } from '@/api/order'
import { useDashboardStore } from '@/stores/dashboard'
import { formatBytes, formatPrice } from '@/utils/format'
import { renderDescription } from '@/utils/description'
import type { TrafficPackage } from '@/types/api'
import { OrderKindTraffic } from '@/types/api'
import PaymentDialog from '@/components/PaymentDialog.vue'
import PaymentMethodDialog from '@/components/PaymentMethodDialog.vue'
import { usePurchase } from '@/composables/usePurchase'

const dashboard = useDashboardStore()
const {
  payVisible,
  payUrl,
  payMode,
  payPlatform,
  payAmount,
  presentPayment,
  paymentMethods,
  methodDialogVisible,
  methodAction,
  openPicker,
  onMethodSelected,
  loadPaymentMethods,
  pollUntilPaid,
} = usePurchase()

const packages = ref<TrafficPackage[]>([])
const loading = ref(true)
const buyingId = ref('')
const profile = computed(() => dashboard.profile)

// Traffic packages are add-ons that require an active plan. A user with no
// current plan (or an expired one) cannot buy a traffic package.
const hasActivePlan = computed(() =>
  !!profile.value?.current_product_id &&
  !!profile.value?.expire_at &&
  new Date(profile.value.expire_at).getTime() > Date.now(),
)

function trafficConfirmHTML(pkg: TrafficPackage): string {
  return (
    `<div style="text-align:left;line-height:1.9">` +
    `<div><b>Traffic package:</b> ${pkg.name}</div>` +
    `<div><b>Traffic:</b> ${formatBytes(pkg.quota_bytes)}</div>` +
    `<div><b>Price:</b> ${formatPrice(pkg.price)}</div>` +
    `</div>`
  )
}

// ConfirmPurchase shows the selected package and only proceeds (returning true)
// when the user clicks Confirm. Any dismissal (Cancel / ESC / overlay) returns
// false so the order is never created.
async function confirmPurchase(html: string): Promise<boolean> {
  try {
    await ElMessageBox.confirm(html, 'Confirm your purchase', {
      confirmButtonText: 'Confirm',
      cancelButtonText: 'Cancel',
      type: 'warning',
      dangerouslyUseHTMLString: true,
    })
    return true
  } catch {
    return false
  }
}

async function buyTraffic(pkg: TrafficPackage) {
  if (!hasActivePlan.value) {
    ElMessage.warning('Please purchase a plan first before buying a traffic package.')
    return
  }
  if (!(await confirmPurchase(trafficConfirmHTML(pkg)))) return
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
    if (data.paid) {
      ElMessage.success(`Paid with wallet balance: ${formatPrice(data.wallet_used_cents ?? 0)}. Remaining balance: ${formatPrice(data.wallet_remaining_cents ?? 0)}.`)
      await dashboard.refresh()
    } else if (data.pay_url || data.pay_mode === 'iap') {
      presentPayment(data.pay_url, data.pay_mode, data.order?.platform, data.order?.amount)
      ElMessage.success('Order created. Please complete payment.')
      pollUntilPaid(data.order.id, 'Payment successful. Traffic package activated.')
    } else {
      ElMessage.warning('No payment link returned.')
    }
  } catch {
    /* error toasted by interceptor */
  } finally {
    buyingId.value = ''
  }
}

onMounted(async () => {
  try {
    const [pkgRes] = await Promise.all([apiTrafficPackage.list(), loadPaymentMethods()])
    packages.value = pkgRes.data
    await dashboard.refresh()
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div v-loading="loading">
    <h2 style="margin: 0 0 16px">Traffic Packages</h2>

    <el-empty v-if="!loading && packages.length === 0" description="No traffic packages available" />
    <el-row :gutter="16">
      <el-col v-for="pkg in packages" :key="pkg.id" :span="8">
        <el-card shadow="hover" class="plan-card">
          <div class="plan-name">{{ pkg.name }}</div>
          <div class="plan-price">{{ formatPrice(pkg.price) }}</div>
          <el-divider />
          <ul class="plan-meta">
            <li>Traffic: {{ pkg.quota_bytes > 0 ? formatBytes(pkg.quota_bytes) : 'Unlimited' }}</li>
          </ul>
          <div v-if="pkg.description" class="plan-desc" v-html="renderDescription(pkg.description)" />
          <p v-else class="plan-desc">—</p>
          <el-button
            type="success"
            style="width: 100%"
            :loading="buyingId === 'traffic:' + pkg.id"
            :disabled="!hasActivePlan"
            @click="buyTraffic(pkg)"
          >
            Buy Traffic
          </el-button>
          <p v-if="!hasActivePlan" class="plan-need-plan">
            Purchase a plan first to buy a traffic package.
          </p>
        </el-card>
      </el-col>
    </el-row>

    <PaymentDialog v-model="payVisible" :pay-url="payUrl" :pay-mode="payMode" :platform="payPlatform" :amount="payAmount" />
    <PaymentMethodDialog v-model="methodDialogVisible" :methods="paymentMethods" @select="onMethodSelected" />
  </div>
</template>

<style scoped>
.el-row > .el-col {
  display: flex;
}
.plan-card {
  flex: 1;
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
}
.plan-card :deep(.el-card__body) {
  display: flex;
  flex-direction: column;
  flex: 1;
}
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
  margin-top: auto;
  margin-bottom: 12px;
}
.plan-need-plan {
  font-size: 12px;
  color: #e6a23c;
  text-align: center;
  margin: 8px 0 0;
}
</style>
