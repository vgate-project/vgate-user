<script setup lang="ts">
import { useRouter } from 'vue-router'
import { usePendingOrderStore } from '@/stores/pendingOrder'

const router = useRouter()
const store = usePendingOrderStore()

function goToOrders() {
  router.push({ name: 'orders' })
}
</script>

<template>
  <el-alert
    v-if="store.hasPendingOrder"
    type="warning"
    :closable="false"
    show-icon
    style="margin-bottom: 16px"
  >
    <template #title>You have a pending order</template>
    <div>
      You have an unpaid order.
      <el-button type="primary" link @click="goToOrders">Go to pay / close</el-button>
    </div>
  </el-alert>
</template>
