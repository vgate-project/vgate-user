<script setup lang="ts">
import { ref, watch } from 'vue'
import QRCode from 'qrcode'

const props = defineProps<{
  modelValue: boolean
  payUrl: string
  payMode?: string
  title?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

const qr = ref('')
const error = ref(false)

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
      <p style="margin-top: 0">Scan this QR code with WeChat to pay.</p>
      <div v-if="qr" style="text-align: center">
        <img :src="qr" alt="payment qr" style="width: 240px; height: 240px" />
      </div>
      <el-alert v-else-if="error" type="error" :closable="false" title="Failed to render QR code" />
    </div>
    <div v-else>
      <p style="margin-top: 0">Open the payment page to complete your purchase.</p>
      <a :href="payUrl" target="_blank" rel="noopener" style="word-break: break-all">{{ payUrl }}</a>
    </div>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">Done</el-button>
    </template>
  </el-dialog>
</template>
