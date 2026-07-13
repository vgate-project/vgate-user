<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { apiRedemption } from '@/api/redemption'
import type { RedeemRequest, RedemptionRecord, RedeemType } from '@/types'
import { formatDateTime, formatBytes } from '@/utils/format'

const code = ref('')
const redeeming = ref(false)
const records = ref<RedemptionRecord[]>([])
const loading = ref(false)
const lastMessage = ref('')

const typeLabel: Record<RedeemType, string> = {
  traffic: 'Traffic',
  duration: 'Duration',
  plan: 'Plan',
  reset: 'Reset',
}

async function loadRecords() {
  loading.value = true
  try {
    const { data } = await apiRedemption.records()
    records.value = data.items
  } finally {
    loading.value = false
  }
}
onMounted(loadRecords)

async function onRedeem() {
  const raw = code.value.trim()
  if (!raw) {
    ElMessage.error('Enter a redemption code')
    return
  }
  redeeming.value = true
  lastMessage.value = ''
  try {
    const { data } = await apiRedemption.redeem({ code: raw } as RedeemRequest)
    ElMessage.success(data.message || 'Code redeemed')
    lastMessage.value = data.message
    code.value = ''
    await loadRecords()
  } catch {
    /* error toasted by interceptor */
  } finally {
    redeeming.value = false
  }
}
</script>

<template>
  <div>
    <div class="toolbar">
      <h2>Redeem Code</h2>
    </div>

    <el-card shadow="never" class="redeem-card">
      <el-alert
        v-if="lastMessage"
        type="success"
        :closable="true"
        class="result"
        :title="`Applied: ${lastMessage}`"
      />
      <el-form label-width="140px" @submit.prevent="onRedeem">
        <el-form-item label="Redemption code" required>
          <el-input
            v-model="code"
            placeholder="paste your code here"
            clearable
            style="max-width: 420px"
            @keyup.enter="onRedeem"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="redeeming" @click="onRedeem">Redeem</el-button>
        </el-form-item>
      </el-form>
      <p class="hint">
        Each code can be redeemed once per account. Codes grant traffic, extra
        subscription days, a free plan, or a traffic-usage reset — as configured
        by the admin.
      </p>
    </el-card>

    <el-card shadow="never" class="history-card">
      <template #header><span>My Redemptions</span></template>
      <el-table :data="records" v-loading="loading" empty-text="No redemptions yet" max-height="calc(100vh - 360px)">
        <el-table-column label="Type" width="120">
          <template #default="{ row }">
            <el-tag size="small">{{ typeLabel[row.type as RedeemType] }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Benefit" min-width="200">
          <template #default="{ row }">
            <span v-if="(row as RedemptionRecord).type === 'traffic'">granted traffic</span>
            <span v-else-if="(row as RedemptionRecord).type === 'duration'">extended subscription</span>
            <span v-else-if="(row as RedemptionRecord).type === 'plan'">applied plan</span>
            <span v-else>reset traffic usage</span>
          </template>
        </el-table-column>
        <el-table-column label="Redeemed" width="190">
          <template #default="{ row }">{{ formatDateTime(row.redeemed_at) }}</template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}
h2 {
  margin: 0;
}
.result {
  margin-bottom: 16px;
}
.hint {
  margin-top: 8px;
  font-size: 12px;
  color: #909399;
}
.history-card {
  margin-top: 16px;
}
</style>
