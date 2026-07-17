<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { apiTickets } from '@/api/tickets'
import { useTelegramStore } from '@/stores/telegram'
import type { Ticket, TicketDetail, TicketStatus, TicketPriority, TicketCreateRequest } from '@/types'
import { formatDateTime } from '@/utils/format'

const telegram = useTelegramStore()

const items = ref<Ticket[]>([])
const loading = ref(false)
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const statusFilter = ref<TicketStatus | ''>('')

// Create dialog.
const createVisible = ref(false)
const saving = ref(false)
const form = reactive<TicketCreateRequest>({
  subject: '',
  content: '',
  priority: 'normal',
  notify_method: 'none',
})

// Detail drawer.
const drawerVisible = ref(false)
const activeTicket = ref<Ticket | null>(null)
const messages = ref<TicketDetail['messages']>([])
const detailLoading = ref(false)
const replyText = ref('')
const sending = ref(false)
const closing = ref(false)

// Live polling while the drawer is open. The thread refreshes every few
// seconds so admin replies appear without a manual refresh.
const POLL_INTERVAL_MS = 5000
let pollTimer: ReturnType<typeof setInterval> | null = null

function startPolling() {
  stopPolling()
  pollTimer = setInterval(() => {
    if (activeTicket.value && !detailLoading.value && !sending.value) {
      void refreshTicket()
    }
  }, POLL_INTERVAL_MS)
}

function stopPolling() {
  if (pollTimer !== null) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

async function refreshTicket() {
  if (!activeTicket.value) return
  try {
    const { data } = await apiTickets.get(activeTicket.value.id)
    activeTicket.value = data.ticket
    messages.value = data.messages
  } catch {
    // Keep the current view on a transient error; polling will retry.
  }
}

const priorityMeta: Record<TicketPriority, { type?: 'info' | 'warning' | 'danger'; label: string }> = {
  low: { type: 'info', label: 'low' },
  normal: { label: 'normal' },
  high: { type: 'warning', label: 'high' },
  urgent: { type: 'danger', label: 'urgent' },
}

const statusMeta: Record<TicketStatus, { type?: 'success' | 'info' | 'warning' | 'danger'; label: string }> = {
  open: { type: 'danger', label: 'open' },
  in_progress: { type: 'warning', label: 'in progress' },
  resolved: { type: 'success', label: 'resolved' },
  closed: { type: 'info', label: 'closed' },
}

function statusType(s: TicketStatus) {
  return statusMeta[s]?.type
}
function statusLabel(s: TicketStatus) {
  return statusMeta[s]?.label || s
}
function priorityType(p: TicketPriority) {
  return priorityMeta[p]?.type
}
function priorityLabel(p: TicketPriority) {
  return priorityMeta[p]?.label || p
}

async function load() {
  loading.value = true
  try {
    const { data } = await apiTickets.list({
      status: statusFilter.value || undefined,
      page: page.value,
      page_size: pageSize.value,
    })
    items.value = data.items
    total.value = data.total
  } catch {
    ElMessage.error('Failed to load tickets')
  } finally {
    loading.value = false
  }
}
onMounted(load)
onUnmounted(stopPolling)

function onSizeChange() {
  page.value = 1
  load()
}

function openCreate() {
  form.subject = ''
  form.content = ''
  form.priority = 'normal'
  // Default the owner's notification channel: Telegram when linked, else none.
  form.notify_method = telegram.bound ? 'telegram' : 'none'
  createVisible.value = true
}

async function onSubmit() {
  if (!form.subject.trim()) {
    ElMessage.error('Subject is required')
    return
  }
  if (!form.content.trim()) {
    ElMessage.error('Description is required')
    return
  }
  saving.value = true
  try {
    await apiTickets.create({
      subject: form.subject.trim(),
      content: form.content.trim(),
      priority: form.priority,
      notify_method: form.notify_method,
    })
    ElMessage.success('Ticket created')
    createVisible.value = false
    load()
  } catch {
    // error toast handled by http interceptor
  } finally {
    saving.value = false
  }
}

async function openTicket(t: Ticket) {
  activeTicket.value = t
  drawerVisible.value = true
  detailLoading.value = true
  replyText.value = ''
  startPolling()
  try {
    const { data } = await apiTickets.get(t.id)
    activeTicket.value = data.ticket
    messages.value = data.messages
  } catch {
    ElMessage.error('Failed to load ticket')
  } finally {
    detailLoading.value = false
  }
}

function onDrawerClose() {
  stopPolling()
}

async function sendReply() {
  if (!activeTicket.value) return
  if (!replyText.value.trim()) {
    ElMessage.error('Reply cannot be empty')
    return
  }
  sending.value = true
  try {
    const tk = await apiTickets.reply(activeTicket.value.id, replyText.value.trim())
    activeTicket.value = tk.data
    replyText.value = ''
    ElMessage.success('Reply sent')
    await openTicket(tk.data)
    load()
  } catch {
    // error toast handled by http interceptor
  } finally {
    sending.value = false
  }
}

async function closeTicket() {
  if (!activeTicket.value) return
  closing.value = true
  try {
    const tk = await apiTickets.close(activeTicket.value.id)
    activeTicket.value = tk.data
    ElMessage.success('Ticket closed')
    drawerVisible.value = false
    load()
  } catch {
    // error toast handled by http interceptor
  } finally {
    closing.value = false
  }
}
</script>

<template>
  <div>
    <div class="toolbar">
      <h2>Tickets</h2>
      <div class="filters">
        <el-select
          v-model="statusFilter"
          placeholder="All statuses"
          clearable
          style="width: 150px"
          @change="load"
        >
          <el-option label="open" value="open" />
          <el-option label="in progress" value="in_progress" />
          <el-option label="resolved" value="resolved" />
          <el-option label="closed" value="closed" />
        </el-select>
        <el-button type="primary" @click="openCreate">
          <el-icon><Plus /></el-icon><span>New Ticket</span>
        </el-button>
      </div>
    </div>

    <el-card shadow="never">
      <el-table :data="items" v-loading="loading" empty-text="No tickets yet" max-height="calc(100vh - 180px)">
        <el-table-column prop="subject" label="Subject" min-width="220" />
        <el-table-column label="Priority" width="110">
          <template #default="{ row }">
            <el-tag size="small" :type="priorityType(row.priority)">{{ priorityLabel(row.priority) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Status" width="120">
          <template #default="{ row }">
            <el-tag size="small" :type="statusType(row.status)">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Created" width="170">
          <template #default="{ row }">{{ formatDateTime(row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="Actions" width="100" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openTicket(row as Ticket)">View</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next"
        class="pager"
        @size-change="onSizeChange"
        @current-change="load"
      />
    </el-card>

    <el-dialog v-model="createVisible" title="New Ticket" width="640px">
      <el-form label-width="120px">
        <el-form-item label="Subject" required>
          <el-input v-model="form.subject" placeholder="Short summary" maxlength="120" />
        </el-form-item>
        <el-form-item label="Priority">
          <el-select v-model="form.priority" style="width: 160px">
            <el-option label="low" value="low" />
            <el-option label="normal" value="normal" />
            <el-option label="high" value="high" />
            <el-option label="urgent" value="urgent" />
          </el-select>
        </el-form-item>
        <el-form-item label="Notify me via">
          <el-radio-group v-model="form.notify_method">
            <el-radio v-if="telegram.bound" value="telegram">Telegram</el-radio>
            <el-radio value="email">Email</el-radio>
            <el-radio value="none">None</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="Description" required>
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="6"
            placeholder="Describe your issue"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">Cancel</el-button>
        <el-button type="primary" :loading="saving" @click="onSubmit">Create</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="drawerVisible" :title="activeTicket ? activeTicket.subject : 'Ticket'" size="520px" @close="onDrawerClose">
      <div v-loading="detailLoading">
        <div v-if="activeTicket" class="ticket-meta">
          <el-tag size="small" :type="priorityType(activeTicket.priority)">
            {{ priorityLabel(activeTicket.priority) }}
          </el-tag>
          <el-tag size="small" :type="statusType(activeTicket.status)">
            {{ statusLabel(activeTicket.status) }}
          </el-tag>
        </div>

        <div class="thread">
          <div
            v-for="m in messages"
            :key="m.id"
            class="bubble"
            :class="m.sender === 'admin' ? 'bubble-admin' : 'bubble-user'"
          >
            <div class="bubble-head">
              <span>{{ m.sender === 'admin' ? 'Admin' : 'You' }}</span>
              <span class="bubble-time">{{ formatDateTime(m.created_at) }}</span>
            </div>
            <div class="bubble-body">{{ m.content }}</div>
          </div>
          <el-empty v-if="messages.length === 0" description="No messages yet" />
        </div>
      </div>

      <template #footer>
        <div v-if="activeTicket" class="drawer-footer">
          <el-input
            v-model="replyText"
            type="textarea"
            :rows="3"
            placeholder="Write a reply"
            :disabled="sending || closing"
          />
          <div class="drawer-actions">
            <el-button
              type="primary"
              :loading="sending"
              :disabled="!replyText.trim() || closing"
              @click="sendReply"
            >
              Send reply
            </el-button>
            <el-button
              type="danger"
              plain
              :loading="closing"
              :disabled="activeTicket.status === 'closed' || sending"
              @click="closeTicket"
            >
              Close ticket
            </el-button>
          </div>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  gap: 12px;
  flex-wrap: wrap;
}
.filters {
  display: flex;
  gap: 8px;
}
.pager {
  margin-top: 12px;
  justify-content: flex-end;
}
h2 {
  margin: 0;
}
.ticket-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.thread {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
  max-height: 50vh;
  overflow-y: auto;
}
.bubble {
  max-width: 80%;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 14px;
}
.bubble-user {
  align-self: flex-start;
  background: #f4f4f5;
}
.bubble-admin {
  align-self: flex-end;
  background: #ecf5ff;
}
.bubble-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
  color: #909399;
  margin-bottom: 4px;
}
.bubble-body {
  white-space: pre-wrap;
  word-break: break-word;
}
.drawer-footer {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.drawer-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
</style>
