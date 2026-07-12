<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { apiAnnouncements } from '@/api/announcements'
import type { Announcement } from '@/types'
import { formatDateTime } from '@/utils/format'

const announcements = ref<Announcement[]>([])
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    const { data } = await apiAnnouncements.list()
    announcements.value = data.items || []
  } catch {
    ElMessage.error('Failed to load announcements')
    announcements.value = []
  } finally {
    loading.value = false
  }
}
onMounted(load)
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
