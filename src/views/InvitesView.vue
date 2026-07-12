<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import { apiInvites } from '@/api/invites'
import type { InviteCode, InviteRequest, InviteStatus } from '@/types'
import { formatDateTime } from '@/utils/format'

const codes = ref<InviteCode[]>([])
const status = ref<InviteStatus | null>(null)
const loading = ref(false)

// Remaining issuance capacity = quota - issued (Σ max_uses already minted).
const remainingCapacity = computed(() =>
  status.value ? Math.max(0, status.value.quota - status.value.issued) : 0,
)
const generationDisabled = computed(
  () => !!status.value && status.value.quota <= 0,
)

async function loadAll() {
  loading.value = true
  try {
    const [list, st] = await Promise.all([apiInvites.list(), apiInvites.status()])
    codes.value = list.data.items
    status.value = st.data
  } finally {
    loading.value = false
  }
}
onMounted(loadAll)

function remaining(c: InviteCode): number {
  return Math.max(0, c.max_uses - c.used_count)
}

async function copy(text: string) {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('Copied')
  } catch {
    ElMessage.error('Copy failed')
  }
}

// ---- Create dialog ----
const editorVisible = ref(false)
const saving = ref(false)
// After a successful create we surface the generated code (it is not stored
// retrievably), so the caller can copy it before closing.
const createdCode = ref('')

const form = reactive<InviteRequest>({ max_uses: 1, expires_at: null, note: '' })

function openCreate() {
  createdCode.value = ''
  form.max_uses = 1
  form.expires_at = null
  form.note = ''
  editorVisible.value = true
}

async function onSubmit() {
  if (!form.max_uses || form.max_uses < 1) {
    ElMessage.error('Max uses must be at least 1')
    return
  }
  saving.value = true
  try {
    const { data } = await apiInvites.create({
      max_uses: form.max_uses,
      expires_at: form.expires_at || null,
      note: form.note || '',
    })
    createdCode.value = data.code
    await loadAll()
    ElMessage.success('Invite code created')
  } catch {
    /* error toasted by interceptor */
  } finally {
    saving.value = false
  }
}

async function onDelete(c: InviteCode) {
  if (c.used_count > 0) {
    ElMessage.warning('Used invite codes cannot be deleted')
    return
  }
  try {
    await ElMessageBox.confirm(`Delete invite code "${c.code}"?`, 'Confirm', { type: 'warning' })
  } catch {
    return
  }
  try {
    await apiInvites.remove(c.id)
    ElMessage.success('Invite code deleted')
    await loadAll()
  } catch {
    /* error toasted by interceptor */
  }
}
</script>

<template>
  <div v-loading="loading">
    <div class="toolbar">
      <h2>Invite Codes</h2>
      <el-button
        type="primary"
        :disabled="generationDisabled || remainingCapacity <= 0"
        @click="openCreate"
      >
        <el-icon><Plus /></el-icon><span>New Invite Code</span>
      </el-button>
    </div>

    <el-alert
      v-if="generationDisabled"
      type="info"
      :closable="false"
      class="quota-alert"
      title="Invite generation is not enabled for your account."
    />
    <!-- Use the admin-assigned quota as a guard rail; the server enforces it. -->
    <el-alert
      v-else-if="status"
      type="success"
      :closable="false"
      class="quota-alert"
      :title="`Quota ${status.quota} · Issued ${status.issued} · Used ${status.used} · Remaining ${remainingCapacity}`"
    />

    <el-card shadow="never">
      <el-table :data="codes" empty-text="No invite codes yet" max-height="calc(100vh - 220px)">
        <el-table-column label="Code" min-width="160">
          <template #default="{ row }">
            <code class="mono">{{ row.code }}</code>
            <el-button size="small" text type="primary" @click="copy(row.code)">Copy</el-button>
          </template>
        </el-table-column>
        <el-table-column label="Note" width="160">
          <template #default="{ row }">{{ row.note || '—' }}</template>
        </el-table-column>
        <el-table-column label="Uses" width="90">
          <template #default="{ row }">{{ row.used_count }} / {{ row.max_uses }}</template>
        </el-table-column>
        <el-table-column label="Remaining" width="110">
          <template #default="{ row }">
            <el-tag size="small" :type="remaining(row as InviteCode) > 0 ? 'success' : 'info'">{{ remaining(row as InviteCode) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Expires" width="170">
          <template #default="{ row }">{{ formatDateTime(row.expires_at) === '—' ? 'Never' : formatDateTime(row.expires_at) }}</template>
        </el-table-column>
        <el-table-column label="Created" width="170">
          <template #default="{ row }">{{ formatDateTime(row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="Actions" min-width="110" fixed="right">
          <template #default="{ row }">
            <el-popconfirm
              :title="`Delete invite code &quot;${row.code}&quot;?`"
              :disabled="row.used_count > 0"
              @confirm="onDelete(row as InviteCode)"
            >
              <template #reference>
                <el-button size="small" type="danger" :disabled="row.used_count > 0">Delete</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="editorVisible" :title="createdCode ? 'Invite Code Created' : 'New Invite Code'" width="520px">
      <template v-if="createdCode">
        <el-alert type="warning" :closable="false" class="created-alert">
          Share this code with the person you're inviting. It cannot be shown again.
        </el-alert>
        <div class="created-code">
          <code class="mono big">{{ createdCode }}</code>
          <el-button type="primary" @click="copy(createdCode)">Copy</el-button>
        </div>
      </template>
      <el-form v-else label-width="140px">
        <el-form-item label="Max uses" required>
          <el-input-number v-model="form.max_uses" :min="1" :max="Math.max(1, remainingCapacity)" controls-position="right" />
          <span class="hint" v-if="remainingCapacity > 0">Up to {{ remainingCapacity }} remaining in your quota</span>
        </el-form-item>
        <el-form-item label="Expires at">
          <el-date-picker
            v-model="form.expires_at"
            type="datetime"
            clearable
            value-format="YYYY-MM-DDTHH:mm:ssZ"
            placeholder="Never"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="Note">
          <el-input v-model="form.note" placeholder="optional" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editorVisible = false">Close</el-button>
        <el-button v-if="!createdCode" type="primary" :loading="saving" @click="onSubmit">Create</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
h2 {
  margin: 0;
}
.quota-alert {
  margin-bottom: 12px;
}
.mono {
  font-family: monospace;
}
.created-alert {
  margin-bottom: 12px;
}
.created-code {
  display: flex;
  align-items: center;
  gap: 12px;
}
.created-code .big {
  flex: 1;
  font-size: 18px;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 6px;
  word-break: break-all;
}
.hint {
  display: inline-block;
  margin-left: 8px;
  font-size: 12px;
  color: #909399;
}
</style>
