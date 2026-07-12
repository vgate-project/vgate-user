<script setup lang="ts">
import { usePendingOrderStore } from '@/stores/pendingOrder'

const store = usePendingOrderStore()
</script>

<template>
  <span v-if="store.hasPendingOrder" class="pending-dot" />
</template>

<style scoped>
.pending-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #f56c6c;
  margin-left: 6px;
}
</style>
