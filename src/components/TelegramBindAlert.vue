<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useTelegramStore } from '@/stores/telegram'

const router = useRouter()
const store = useTelegramStore()

function goToSettings() {
  router.push({ name: 'settings' })
}
</script>

<template>
  <el-alert
    v-if="store.needsBind"
    type="warning"
    :closable="false"
    show-icon
    style="margin-bottom: 16px"
  >
    <template #title>Link your Telegram account</template>
    <div>
      Telegram notifications are available. Link your account to receive
      announcements and use bot commands.
      <el-button type="primary" link @click="goToSettings">Go to Settings</el-button>
    </div>
  </el-alert>
</template>
