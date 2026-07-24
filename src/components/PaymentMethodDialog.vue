<script setup lang="ts">
import { computed } from 'vue'
import type { PaymentMethodInfo } from '@/types/api'

const props = defineProps<{
  modelValue: boolean
  methods: PaymentMethodInfo[]
}>()

const emit = defineEmits<{
  'update:modelValue': [boolean]
  select: [string]
}>()

// Only channels the admin enabled and actually configured are selectable.
const available = computed(() =>
  props.methods.filter((m) => m.enabled && m.configured),
)

const chosen = computed(() => available.value[0]?.platform ?? '')

function confirm() {
  if (!chosen.value) return
  emit('select', chosen.value)
  emit('update:modelValue', false)
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    title="Select payment method"
    width="360px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <p v-if="available.length === 0" class="empty">No payment method is available right now.</p>
    <el-radio-group v-else v-model="chosen" class="method-list">
      <el-radio v-for="m in available" :key="m.platform" :value="m.platform" class="method-item">
        <span class="method-label">{{ m.label }}</span>
        <span v-if="m.mode === 'iap'" class="method-hint">In-app (iOS App Store)</span>
        <span v-else-if="m.mode === 'qr'" class="method-hint">Scan QR code</span>
        <span v-else class="method-hint">Redirect to gateway</span>
      </el-radio>
    </el-radio-group>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">Cancel</el-button>
      <el-button type="primary" :disabled="available.length === 0" @click="confirm">
        Continue
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.method-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.method-item {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  margin: 0;
  height: auto;
  white-space: normal;
}
.method-label {
  font-weight: 600;
}
.method-hint {
  display: block;
  font-size: 12px;
  color: #909399;
}
.empty {
  color: #909399;
  margin: 8px 0;
}
</style>
