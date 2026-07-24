<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { apiOrder } from '@/api/order'
import { usePendingOrderStore } from '@/stores/pendingOrder'
import { formatPrice, formatDateTime } from '@/utils/format'
import type { Order } from '@/types/api'
import PaymentDialog from '@/components/PaymentDialog.vue'

const orders = ref<Order[]>([])
const loading = ref(true)
const total = ref(0)
const page = ref(1)
const pageSize = ref(15)
const pending = usePendingOrderStore()

async function fetchOrders() {
  loading.value = true
  try {
    const { data } = await apiOrder.list({ page: page.value, page_size: pageSize.value })
    orders.value = data.items
    total.value = data.total
  } finally {
    loading.value = false
  }
}

function onPageChange(p: number) {
  page.value = p
  fetchOrders()
}

const statusMeta: Record<string, { type: 'success' | 'warning' | 'info'; label: string }> = {
  pending: { type: 'warning', label: 'Pending' },
  paid: { type: 'success', label: 'Paid' },
  closed: { type: 'info', label: 'Closed' },
}
function statusOf(s: string) {
  return statusMeta[s] ?? { type: 'info' as const, label: s }
}

let pollTimer: ReturnType<typeof setInterval> | null = null
function stopPoll() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}
function pollUntilPaid(orderId: string) {
  stopPoll()
  pollTimer = setInterval(async () => {
    try {
      const { data } = await apiOrder.get(orderId)
      if (data.status === 'paid') {
        stopPoll()
        ElMessage.success('Payment confirmed. Your plan is active.')
        fetchOrders()
        pending.refresh()
        payVisible.value = false
      } else if (data.status === 'closed') {
        stopPoll()
        ElMessage.info('Order closed. You may try again.')
        fetchOrders()
        pending.refresh()
      }
    } catch {
      /* ignore transient errors during polling */
    }
  }, 3000)
  // stop polling after 2 minutes
  setTimeout(stopPoll, 120000)
}

const payingId = ref('')
const payVisible = ref(false)
const payUrl = ref('')
const payMode = ref<'redirect' | 'qr'>('redirect')
const payPlatform = ref('')
const payAmount = ref<number | undefined>()

async function pay(order: Order) {
  payingId.value = order.id
  try {
    const { data } = await apiOrder.pay(order.id)
    if (data.pay_url) {
      payUrl.value = data.pay_url
      payMode.value = data.pay_mode === 'qr' ? 'qr' : 'redirect'
      payPlatform.value = order.platform ?? ''
      payAmount.value = order.amount
      if (payMode.value === 'qr') {
        payVisible.value = true
      } else {
        window.open(data.pay_url, '_blank')
      }
      ElMessage.success('Order created — complete payment.')
      pending.refresh()
      pollUntilPaid(order.id)
    } else {
      ElMessage.warning('No payment URL returned.')
    }
  } catch {
    // error toasted by interceptor
  } finally {
    payingId.value = ''
  }
}

const closingId = ref('')
async function closeOrder(order: Order) {
  try {
    await ElMessageBox.confirm(
      'Close this unpaid order? You can create a new one afterwards.',
      'Close order',
      { type: 'warning', confirmButtonText: 'Close', cancelButtonText: 'Cancel' },
    )
  } catch {
    return // user cancelled
  }
  closingId.value = order.id
  try {
    await apiOrder.close(order.id)
    ElMessage.success('Order closed.')
    await fetchOrders()
    await pending.refresh()
  } catch {
    // error toasted by interceptor
  } finally {
    closingId.value = ''
  }
}

onMounted(fetchOrders)
</script>

<template>
  <div v-loading="loading">
    <h2 style="margin: 0 0 16px">My Orders</h2>

    <el-empty v-if="!loading && orders.length === 0" description="No orders yet" />

    <template v-else>
      <el-table :data="orders" border stripe style="width: 100%">
        <el-table-column prop="id" label="Order ID" min-width="180" />
        <el-table-column label="Amount" width="120">
          <template #default="{ row }">
            {{ formatPrice(row.amount) }}
          </template>
        </el-table-column>
        <el-table-column label="Status" width="120">
          <template #default="{ row }">
            <el-tag :type="statusOf(row.status).type" effect="dark">
              {{ statusOf(row.status).label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Platform" width="120" prop="platform">
          <template #default="{ row }">
            <el-tag size="small" effect="plain">{{ row.platform || 'alipay' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Created" min-width="170">
          <template #default="{ row }">{{ formatDateTime(row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="Paid At" min-width="170">
          <template #default="{ row }">{{ formatDateTime(row.paid_at) }}</template>
        </el-table-column>
        <el-table-column prop="out_trade_no" label="Out Trade No." min-width="180">
          <template #default="{ row }">{{ row.out_trade_no || '—' }}</template>
        </el-table-column>
        <el-table-column label="Actions" width="160" fixed="right">
          <template #default="{ row }">
            <template v-if="row.status === 'pending'">
              <el-button
                type="primary"
                size="small"
                :loading="payingId === row.id"
                @click="pay(row as Order)"
              >
                Pay
              </el-button>
              <el-button
                type="info"
                size="small"
                :loading="closingId === row.id"
                @click="closeOrder(row as Order)"
              >
                Close
              </el-button>
            </template>
            <span v-else>—</span>
          </template>
        </el-table-column>
      </el-table>

      <div style="display: flex; justify-content: flex-end; margin-top: 16px">
        <el-pagination
          layout="total, prev, pager, next"
          :total="total"
          :page-size="pageSize"
          :current-page="page"
          @current-change="onPageChange"
        />
      </div>
    </template>

    <PaymentDialog v-model="payVisible" :pay-url="payUrl" :pay-mode="payMode" :platform="payPlatform" :amount="payAmount" />
  </div>
</template>
