<script setup lang="ts">
import {onMounted, reactive, ref} from 'vue'
import {ElMessage} from 'element-plus'
import {apiAuth} from '@/api/auth'
import {apiUser} from '@/api/user'
import type {User} from '@/types/api'
import {formatBytes, formatDateTime} from '@/utils/format'

const profile = ref<User | null>(null)
const loadingProfile = ref(false)

const form = reactive({
  old_password: '',
  new_password: '',
  confirm: '',
})
const saving = ref(false)

async function loadProfile() {
  loadingProfile.value = true
  try {
    const {data} = await apiUser.profile()
    profile.value = data
  } finally {
    loadingProfile.value = false
  }
}

function reset() {
  form.old_password = ''
  form.new_password = ''
  form.confirm = ''
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

onMounted(loadProfile)
</script>

<template>
  <div>
    <h2 style="margin: 0 0 16px">Account Settings</h2>
    <div style="display: flex; gap: 16px; flex-wrap: wrap">
      <el-card shadow="never" style="flex: 1 1 560px" v-loading="loadingProfile">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="Email">{{ profile?.email ?? '—' }}</el-descriptions-item>
          <el-descriptions-item label="Username">{{ profile?.username ?? '—' }}</el-descriptions-item>
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

      <el-card shadow="never" style="flex: 1 1 560px">
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
