<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useDashboardStore } from '@/stores/dashboard'
import type { Announcement } from '@/types'
import { formatDateTime } from '@/utils/format'

const dashboard = useDashboardStore()
// Announcements come from the shared dashboard payload (one fetch for the
// whole app), not a separate per-page request.
const announcements = computed<Announcement[]>(() => dashboard.announcements)
const loading = ref(false)

onMounted(async () => {
  loading.value = true
  try {
    await dashboard.refresh()
  } catch {
    ElMessage.error('Failed to load announcements')
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div>
    <h2 style="margin: 0 0 16px">Announcements</h2>
    <el-card shadow="never" v-loading="loading">
      <el-empty v-if="!loading && announcements.length === 0" description="No announcements" />
      <el-card
        v-for="a in announcements"
        :key="a.id"
        shadow="hover"
        style="margin-bottom: 12px"
      >
        <template #header>
          <div style="display: flex; align-items: center; gap: 8px">
            <span style="font-weight: 600">{{ a.title }}</span>
            <el-tag v-if="a.pinned" type="warning" size="small">Pinned</el-tag>
          </div>
        </template>
        <div style="white-space: pre-wrap">{{ a.content }}</div>
        <div style="margin-top: 10px; color: #909399; font-size: 12px">
          {{ formatDateTime(a.created_at) }}
        </div>
      </el-card>
    </el-card>
  </div>
</template>
