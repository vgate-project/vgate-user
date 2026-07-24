<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import QRCode from 'qrcode'
import { formatPrice } from '@/utils/format'

const props = defineProps<{
  modelValue: boolean
  payUrl: string
  payMode?: string
  platform?: string
  title?: string
  amount?: number
}>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

const qr = ref('')
const error = ref(false)

// The amount the user must pay for this order, formatted for display.
const amountText = computed(() => (props.amount != null ? formatPrice(props.amount) : ''))

// Describe the QR payment in a provider-aware way; the dialog previously
// hardcoded "WeChat" regardless of the actual gateway.
const qrHint = computed(() => {
  switch (props.platform) {
    case 'alipay':
      return 'Scan this QR code with Alipay to pay.'
    case 'wechat':
      return 'Scan this QR code with WeChat to pay.'
    default:
      return 'Scan this QR code to pay.'
  }
})

watch(
  () => [props.modelValue, props.payUrl, props.payMode],
  async () => {
    error.value = false
    qr.value = ''
    if (props.modelValue && props.payMode === 'qr' && props.payUrl) {
      try {
        qr.value = await QRCode.toDataURL(props.payUrl)
      } catch {
        error.value = true
      }
    }
  },
  { immediate: true },
)
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="title || 'Complete payment'"
    width="360px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-if="payMode === 'qr'">
      <p v-if="amountText" class="amount-due">Amount due: {{ amountText }}</p>
      <p style="margin-top: 0">{{ qrHint }}</p>
      <div v-if="qr" style="text-align: center">
        <img :src="qr" alt="payment qr" style="width: 240px; height: 240px" />
      </div>
      <el-alert v-else-if="error" type="error" :closable="false" title="Failed to render QR code" />
    </div>
    <div v-else>
      <p v-if="amountText" class="amount-due">Amount due: {{ amountText }}</p>
      <p style="margin-top: 0">Open the payment page to complete your purchase.</p>
      <a :href="payUrl" target="_blank" rel="noopener" style="word-break: break-all">{{ payUrl }}</a>
    </div>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">Done</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.amount-due {
  margin: 0 0 8px;
  font-weight: 600;
  font-size: 15px;
  color: var(--el-color-danger, #f56c6c);
}
</style>
