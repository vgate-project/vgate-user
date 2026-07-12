<script setup lang="ts">
import { computed } from 'vue'
import { formatBytes } from '@/utils/format'
import type { HourlyStat } from '@/types/api'

const props = defineProps<{ data: HourlyStat[] }>()

// Bar height scales by the hour's total traffic relative to the busiest hour
// (matches the admin dashboard chart).
const maxTotal = computed(() =>
  Math.max(...props.data.map((p) => p.up + p.down), 1),
)
function barHeightPct(p: HourlyStat): number {
  return ((p.up + p.down) / maxTotal.value) * 100
}
function segPct(part: number, p: HourlyStat): number {
  const t = p.up + p.down
  return t > 0 ? (part / t) * 100 : 0
}
function formatHour(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return `${String(d.getHours()).padStart(2, '0')}:00`
}
</script>

<template>
  <div v-if="data.length === 0" class="empty">No traffic in the last 24h</div>
  <div v-else>
    <div class="chart-header">
      <span class="chart-title">Hourly Traffic (24h)</span>
      <div class="chart-legend">
        <span class="legend-item"><i class="legend-dot up"></i>Upload</span>
        <span class="legend-item"><i class="legend-dot down"></i>Download</span>
      </div>
    </div>
    <div class="chart-bars">
      <div
        v-for="p in data"
        :key="p.hour"
        class="bar-col"
        :title="`${formatHour(p.hour)} · ↑${formatBytes(p.up)} ↓${formatBytes(p.down)}`"
      >
        <div class="bar" :style="{ height: barHeightPct(p) + '%' }">
          <div class="bar-seg up" :style="{ height: segPct(p.up, p) + '%' }"></div>
          <div class="bar-seg down" :style="{ height: segPct(p.down, p) + '%' }"></div>
        </div>
      </div>
    </div>
    <div class="chart-axis">
      <span v-for="(p, i) in data" :key="'a' + p.hour" class="axis-label">
        {{ i % 6 === 0 ? formatHour(p.hour) : '' }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.chart-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}
.chart-legend {
  display: flex;
  gap: 12px;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #909399;
}
.legend-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 2px;
}
.legend-dot.up {
  background: #409eff;
}
.legend-dot.down {
  background: #67c23a;
}
.chart-bars {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 140px;
}
.bar-col {
  flex: 1;
  height: 100%;
  display: flex;
  align-items: flex-end;
  cursor: pointer;
}
.bar {
  width: 100%;
  display: flex;
  flex-direction: column;
  border-radius: 2px 2px 0 0;
  min-height: 2px;
  overflow: hidden;
}
.bar-seg {
  width: 100%;
}
.bar-seg.up {
  background: #409eff;
}
.bar-seg.down {
  background: #67c23a;
}
.chart-axis {
  display: flex;
  margin-top: 4px;
}
.axis-label {
  flex: 1;
  text-align: center;
  font-size: 10px;
  color: #909399;
}
.empty {
  color: #909399;
  font-size: 13px;
  padding: 24px 0;
  text-align: center;
}
</style>
