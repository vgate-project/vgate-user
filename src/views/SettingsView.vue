<script setup lang="ts">
import {onMounted, onUnmounted, reactive, ref} from 'vue'
import {ElMessage} from 'element-plus'
import {apiAuth} from '@/api/auth'
import {apiUser} from '@/api/user'
import {useAuthStore} from '@/stores/auth'
import type {User} from '@/types/api'
import {formatBytes, formatDateTime} from '@/utils/format'

const auth = useAuthStore()

const profile = ref<User | null>(null)
const loadingProfile = ref(false)

const form = reactive({
  old_password: '',
  new_password: '',
  confirm: '',
})
const saving = ref(false)

// Self-service username editing.
const usernameForm = reactive({
  username: '',
})
const savingUsername = ref(false)
const editingUsername = ref(false)

// Telegram link state.
const tg = reactive({
  available: false, // admin has started Telegram and user-binding is enabled
  bound: false,
  notify: true,
  deepLink: '', // https t.me link (copy fallback)
  tgLink: '', // native tg:// link that opens the Telegram app directly
  pending: false, // a bind code was issued, awaiting /start confirmation
  binding: false,
  unbinding: false,
})

let pollTimer: ReturnType<typeof setInterval> | undefined

async function loadProfile() {
  loadingProfile.value = true
  try {
    const {data} = await apiUser.profile()
    profile.value = data
    usernameForm.username = data.username ?? ''
  } finally {
    loadingProfile.value = false
  }
}

async function loadTelegram() {
  try {
    const {data} = await apiUser.telegramStatus()
    tg.available = data.available
    tg.bound = data.bound
    tg.notify = data.telegram_notify
  } catch {
    // Telegram is optional; ignore lookup failures.
  }
}

async function bindTelegram() {
  tg.binding = true
  try {
    const {data} = await apiUser.telegramBind()
    tg.deepLink = data.deep_link
    tg.tgLink = data.tg_link
    tg.pending = true
    // Show the link inline instead of window.open(): the https t.me link only
    // lands on the bot's homepage in a browser and never runs /start. The user
    // opens tgLink (or copies deepLink) in the Telegram app and presses Start.
    ElMessage.success('Open the link in Telegram and press Start to finish linking.')
    startPolling()
  } catch {
    // Error already surfaced by the http interceptor.
  } finally {
    tg.binding = false
  }
}

// Poll the bind status until the bot confirms /start, then flip to "Linked".
function startPolling() {
  stopPolling()
  let attempts = 0
  pollTimer = setInterval(async () => {
    attempts++
    try {
      const {data} = await apiUser.telegramStatus()
      if (data.bound) {
        tg.bound = true
        tg.notify = data.telegram_notify
        tg.pending = false
        tg.deepLink = ''
        tg.tgLink = ''
        stopPolling()
        ElMessage.success('Telegram linked')
        return
      }
    } catch {
      // Ignore transient errors; keep polling.
    }
    if (attempts >= 40) {
      // ~2 minutes elapsed — stop auto-detect but keep the link visible so the
      // user can retry or open it later.
      stopPolling()
    }
  }, 3000)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = undefined
  }
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(tg.deepLink)
    ElMessage.success('Link copied')
  } catch {
    ElMessage.error('Copy failed')
  }
}

async function unbindTelegram() {
  tg.unbinding = true
  try {
    await apiUser.telegramUnbind()
    tg.bound = false
    tg.notify = true
    tg.pending = false
    tg.deepLink = ''
    tg.tgLink = ''
    stopPolling()
    ElMessage.success('Telegram unlinked')
  } catch {
    // Error already surfaced by the http interceptor.
  } finally {
    tg.unbinding = false
  }
}

async function setNotify(val: boolean) {
  try {
    await apiUser.telegramNotify(val)
    tg.notify = val
  } catch {
    // Error already surfaced by the http interceptor.
  }
}

function reset() {
  form.old_password = ''
  form.new_password = ''
  form.confirm = ''
}

async function saveUsername() {
  const name = usernameForm.username.trim()
  const current = (profile.value?.username ?? '').trim()
  if (!name) {
    ElMessage.error('Username cannot be empty')
    return
  }
  // Unchanged → no request, no DB write.
  if (name === current) {
    editingUsername.value = false
    return
  }
  savingUsername.value = true
  try {
    await apiUser.updateProfile(name)
    if (profile.value) profile.value.username = name
    auth.setUsername(name)
    ElMessage.success('Username updated')
    editingUsername.value = false
  } catch {
    // Error already surfaced by the http interceptor.
  } finally {
    savingUsername.value = false
  }
}

function startEditUsername() {
  usernameForm.username = profile.value?.username ?? ''
  editingUsername.value = true
}

function cancelEditUsername() {
  editingUsername.value = false
}

async function onSubmit() {
  if (form.new_password.length < 8) {
    ElMessage.error('New password must be at least 8 characters')
    return
  }
  if (form.new_password !== form.confirm) {
    ElMessage.error('New passwords do not match')
    return
  }
  // Passwordless accounts set a first password without the current one.
  if (profile.value?.has_password && !form.old_password) {
    ElMessage.error('Current password is required')
    return
  }
  saving.value = true
  try {
    await apiAuth.changePassword({
      old_password: form.old_password,
      new_password: form.new_password,
    })
    ElMessage.success('Password updated')
    reset()
  } catch {
    // Error already surfaced by the http interceptor.
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadProfile()
  loadTelegram()
})

onUnmounted(stopPolling)
</script>

<template>
  <div>
    <h2 style="margin: 0 0 16px">Account Settings</h2>
    <div class="cards-grid">
      <el-card shadow="never" v-loading="loadingProfile">
        <el-descriptions :column="1" border label-width="120px">
          <el-descriptions-item label="Email">{{ profile?.email ?? '—' }}</el-descriptions-item>
          <el-descriptions-item label="Username">
            <span v-if="!editingUsername">
              {{ profile?.username ?? '—' }}
              <el-button link type="primary" size="small" @click="startEditUsername">Edit</el-button>
            </span>
            <span v-else style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap">
              <el-input v-model="usernameForm.username" size="small" style="max-width: 240px" />
              <el-button type="primary" size="small" :loading="savingUsername" @click="saveUsername">
                Save
              </el-button>
              <el-button size="small" @click="cancelEditUsername">Cancel</el-button>
            </span>
          </el-descriptions-item>
          <el-descriptions-item label="Level">{{ profile?.level ?? '—' }}</el-descriptions-item>
          <el-descriptions-item label="Expires At">{{ formatDateTime(profile?.expire_at) }}</el-descriptions-item>
          <el-descriptions-item label="Quota">
            {{ profile ? (profile.quota_bytes === 0 ? 'Unlimited' : formatBytes(profile.quota_bytes)) : '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="Status">
            <el-tag :type="profile?.enabled ? 'success' : 'danger'" size="small">
              {{ profile?.enabled ? 'Enabled' : 'Disabled' }}
            </el-tag>
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <el-card shadow="never" v-if="tg.available">
        <template #header>
          <span>Telegram</span>
        </template>
        <el-descriptions :column="1" border label-width="120px">
          <el-descriptions-item label="Status">
            <el-tag :type="tg.bound ? 'success' : 'info'" size="small">
              {{ tg.bound ? 'Linked' : 'Not linked' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="Announcements">
            <el-switch
              :model-value="tg.notify"
              :disabled="!tg.bound"
              @update:model-value="(v: string | number | boolean) => setNotify(v as boolean)"
            />
          </el-descriptions-item>
        </el-descriptions>

        <!-- Pending: show the deep link inline so the user can open it in the
             Telegram app (no browser window). -->
        <div v-if="tg.pending && !tg.bound" style="margin-top: 16px">
          <el-alert
            type="warning"
            :closable="false"
            title="Open the link below in Telegram (on the device with your account) and press Start to finish linking."
          />
          <div style="margin-top: 12px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap">
            <el-link v-if="tg.tgLink" type="primary" :href="tg.tgLink" target="_blank">
              Open in Telegram
            </el-link>
            <el-input :model-value="tg.deepLink" readonly style="max-width: 420px" />
            <el-button @click="copyLink">Copy</el-button>
          </div>
        </div>

        <!-- Not yet bound: offer to start the bind flow. -->
        <div v-else-if="!tg.bound" style="margin-top: 16px; display: flex; gap: 8px">
          <el-button type="primary" :loading="tg.binding" @click="bindTelegram">
            Bind Telegram
          </el-button>
        </div>

        <!-- Bound: allow unlinking. -->
        <div v-else style="margin-top: 16px; display: flex; gap: 8px">
          <el-button type="danger" :loading="tg.unbinding" @click="unbindTelegram">
            Unbind
          </el-button>
        </div>
      </el-card>

      <el-card shadow="never">
        <template #header>
          <span>Change Password</span>
        </template>
        <el-form label-position="left" label-width="150px">
          <el-alert
              v-if="profile && !profile.has_password"
              type="info"
              :closable="false"
              style="margin-bottom: 16px"
              title="You have no password set yet. Choose a new password to enable account login."
          />
          <el-form-item v-else label="Current password" required>
            <el-input
                v-model="form.old_password"
                type="password"
                show-password
                autocomplete="current-password"
                placeholder="Enter your current password"
            />
          </el-form-item>
          <el-form-item label="New password" required>
            <el-input
                v-model="form.new_password"
                type="password"
                show-password
                autocomplete="new-password"
                placeholder="At least 8 characters"
            />
          </el-form-item>
          <el-form-item label="Confirm" required>
            <el-input
                v-model="form.confirm"
                type="password"
                show-password
                autocomplete="new-password"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="saving" @click="onSubmit">Update Password</el-button>
            <el-button @click="reset">Reset</el-button>
          </el-form-item>
        </el-form>
      </el-card>
    </div>
  </div>
</template>

<style scoped>
.cards-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}
/* Collapse to fewer columns on narrower viewports so cards stay readable. */
@media (max-width: 1100px) {
  .cards-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 720px) {
  .cards-grid {
    grid-template-columns: 1fr;
  }
}
</style>
