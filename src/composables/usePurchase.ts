import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { apiOrder } from '@/api/order'
import { apiPayment } from '@/api/payment'
import { useDashboardStore } from '@/stores/dashboard'
import type { PaymentMethodInfo } from '@/types/api'

// Shared purchase plumbing reused by the Plans view (plan / switch) and the
// Traffic Packages view: the payment-method picker, the pay dialog, and the
// post-payment polling loop. Each view wires its own order-creation call
// through openPicker / presentPayment and supplies its own success copy.
export function usePurchase() {
  const dashboard = useDashboardStore()

  // Pay dialog (QR code or redirect link).
  const payVisible = ref(false)
  const payUrl = ref('')
  const payMode = ref<'redirect' | 'qr' | 'iap'>('redirect')
  const payPlatform = ref('')
  const payAmount = ref<number | undefined>()

  function presentPayment(
    payUrlValue: string,
    payModeValue?: string,
    platformValue?: string,
    amountValue?: number,
  ) {
    payUrl.value = payUrlValue
    payMode.value =
      payModeValue === 'qr' || payModeValue === 'iap' ? (payModeValue as 'qr' | 'iap') : 'redirect'
    payPlatform.value = platformValue ?? ''
    payAmount.value = amountValue
    if (payMode.value === 'qr' || payModeValue === 'iap') {
      payVisible.value = true
    } else {
      window.open(payUrlValue, '_blank')
    }
  }

  // Payment channel picker: when more than one channel is available we show the
  // picker dialog; otherwise we run the action with the single available channel.
  const paymentMethods = ref<PaymentMethodInfo[]>([])
  const methodDialogVisible = ref(false)
  const methodAction = ref<(platform: string) => Promise<void>>(async () => {})

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

  async function loadPaymentMethods() {
    const { data } = await apiPayment.getMethods()
    paymentMethods.value = data ?? []
  }

  let pollTimer: ReturnType<typeof setInterval> | null = null
  function pollUntilPaid(orderId: string, successMessage = 'Payment successful.') {
    if (pollTimer) clearInterval(pollTimer)
    pollTimer = setInterval(async () => {
      try {
        const { data } = await apiOrder.get(orderId)
        if (data.status === 'paid') {
          if (pollTimer) clearInterval(pollTimer)
          ElMessage.success(successMessage)
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

  return {
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
  }
}
