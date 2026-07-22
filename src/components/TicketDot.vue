<script setup lang="ts">
import { useTicketStore } from '@/stores/ticket'

const store = useTicketStore()
</script>

<template>
  <span v-if="store.unreadCount > 0" class="pending-dot" />
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
