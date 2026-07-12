<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { apiTraffic } from '@/api/traffic'
import TrafficBarChart from '@/components/TrafficBarChart.vue'
import { formatBytes } from '@/utils/format'
import type { HourlyStat, UserTrafficRow } from '@/types/api'

const hourly = ref<HourlyStat[]>([])
const rows = ref<UserTrafficRow[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    const [h, t] = await Promise.all([apiTraffic.hourly(), apiTraffic.listMine({ page: 1, page_size: 100 })])
    hourly.value = h.data
    rows.value = t.data.items
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div v-loading="loading">
    <h2 style="margin: 0 0 16px">Traffic</h2>

    <el-card shadow="never" class="block">
      <TrafficBarChart :data="hourly"/>
    </el-card>

    <el-card shadow="never" class="block">
      <template #header>Per-server usage</template>
      <el-empty v-if="rows.length === 0" description="No traffic records" :image-size="60"/>
      <el-table v-else :data="rows" border stripe style="width: 100%">
        <el-table-column prop="node_name" label="Server" min-width="160"/>
        <el-table-column label="Upload" min-width="140">
          <template #default="{ row }">{{ formatBytes(row.up_total) }}</template>
        </el-table-column>
        <el-table-column label="Download" min-width="140">
          <template #default="{ row }">{{ formatBytes(row.down_total) }}</template>
        </el-table-column>
        <el-table-column label="Total" min-width="140">
          <template #default="{ row }">{{ formatBytes(row.up_total + row.down_total) }}</template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<style scoped>
.block {
  margin-bottom: 16px;
}
</style>
