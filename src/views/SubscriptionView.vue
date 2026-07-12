<script setup lang="ts">
import {onMounted, ref} from 'vue'
import QRCode from 'qrcode'
import {ElMessage, ElMessageBox} from 'element-plus'
import {apiUser} from '@/api/user'
import type {User} from '@/types/api'

const profile = ref<User | null>(null)
const links = ref('')
const base64 = ref('')
const shareUrl = ref('')
const qrDataUrl = ref('')
const loading = ref(true)
const rotating = ref(false)
const resetting = ref(false)

async function copy(text: string) {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('Copied')
  } catch {
    ElMessage.error('Copy failed')
  }
}

async function loadAll() {
  const [p, l, b, u] = await Promise.all([
    apiUser.profile(),
    apiUser.subscribe(),
    apiUser.subscribe('base64'),
    apiUser.subscribeUrl(),
  ])
  profile.value = p.data
  links.value = l.data
  base64.value = b.data
  shareUrl.value = u.data.url
  qrDataUrl.value = await QRCode.toDataURL(shareUrl.value, {margin: 1, width: 240})
}

onMounted(async () => {
  try {
    await loadAll()
  } finally {
    loading.value = false
  }
})

// Rotate the VLESS credential: the old UUID is revoked immediately, so the
// client must re-pull its subscription to pick up the new one.
async function onRotate() {
  try {
    await ElMessageBox.confirm(
      'After rotation the old VLESS credential is revoked immediately. Re-import your subscription in the client to apply.',
      'Confirm credential rotation',
      {type: 'warning'},
    )
  } catch {
    return
  }
  rotating.value = true
  try {
    await apiUser.regenerateCredential()
    await loadAll()
    ElMessage.success('Credential rotated. Re-import your subscription.')
  } finally {
    rotating.value = false
  }
}

// Rotate the caller's own subscription token: the old /sub/:sub_token link is
// revoked immediately, so the client must re-pull its subscription. Reload to
// refresh the Share URL and QR with the new token.
async function onResetSubToken() {
  try {
    await ElMessageBox.confirm(
      'After reset, the old subscription link is revoked immediately. Re-import your subscription in the client to apply.',
      'Confirm subscription link reset',
      { type: 'warning' },
    )
  } catch {
    return
  }
  resetting.value = true
  try {
    await apiUser.resetSubToken()
    await loadAll()
    ElMessage.success('Subscription link reset. Re-import your subscription.')
  } finally {
    resetting.value = false
  }
}
</script>

<template>
  <div v-loading="loading">
    <h2 style="margin: 0 0 16px">Subscription</h2>

    <el-alert
      v-if="profile?.credential"
      type="info"
      :closable="false"
      class="cred-alert"
      show-icon
    >
      <template #title>
        <span>Current VLESS credential</span>
        <code class="cred">{{ profile.credential }}</code>
      </template>
      <div class="cred-actions">
        <span class="hint">If the credential leaks, rotate it with one click; re-import the subscription in the client to apply.</span>
        <el-button size="small" type="warning" :loading="rotating" @click="onRotate">
          Rotate VLESS credential
        </el-button>
      </div>
    </el-alert>

    <el-row :gutter="16" style="margin-bottom: 16px">
      <el-col :span="14">
        <el-card shadow="never" class="block combined">
          <div class="sub-section">
            <div class="sub-head">
              <span>Import links</span>
              <el-button size="small" @click="copy(links)">Copy</el-button>
            </div>
            <el-input :model-value="links" readonly placeholder="vless://..."/>
          </div>

          <el-divider/>

          <div class="sub-section">
            <div class="sub-head">
              <span>Base64 subscription</span>
              <el-button size="small" @click="copy(base64)">Copy</el-button>
            </div>
            <el-input :model-value="base64" readonly placeholder="base64..."/>
          </div>

          <el-divider/>

          <div class="sub-section">
            <div class="sub-head">
              <span>Share URL</span>
              <div class="sub-actions">
                <el-button size="small" @click="copy(shareUrl)">Copy</el-button>
                <el-button size="small" type="warning" :loading="resetting" @click="onResetSubToken">
                  Reset link
                </el-button>
              </div>
            </div>
            <el-input :model-value="shareUrl" readonly placeholder="/sub/..."/>
            <p class="hint">Shareable subscription link (no login required).</p>
          </div>
        </el-card>
      </el-col>

      <el-col :span="10">
        <el-card shadow="never" class="block">
          <template #header>
            <div class="card-head">
              <span>QR code</span>
              <el-button size="small" @click="copy(shareUrl)">Copy URL</el-button>
            </div>
          </template>
          <div class="qr-wrap">
            <img v-if="qrDataUrl" :src="qrDataUrl" alt="subscription QR" class="qr-img"/>
            <span v-else class="qr-ph">—</span>
          </div>
          <p class="hint">Scan with a clash client.</p>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped>
.block {
  height: 100%;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.sub-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.sub-actions {
  display: flex;
  gap: 8px;
}

.sub-section {
  margin-bottom: 8px;
}

.sub-section :deep(.el-input) {
  width: 100%;
}

/* combo card stretches with el-col to match the QR card height; inner body fills vertically */
.combined {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.combined :deep(.el-card__body) {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.sub-section :deep(.el-divider),
:deep(.el-divider) {
  margin: 16px 0;
}

.qr-wrap {
  display: flex;
  justify-content: center;
  padding: 8px 0;
}

.qr-img {
  width: 240px;
  height: 240px;
}

.qr-ph {
  color: #c0c4cc;
}

.hint {
  font-size: 12px;
  color: #909399;
  margin: 8px 0 0;
}

.cred-alert {
  margin-bottom: 16px;
}

.cred {
  font-family: monospace;
  background: rgba(0, 0, 0, 0.04);
  padding: 1px 6px;
  border-radius: 4px;
  margin-left: 6px;
}

.cred-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 6px;
}
</style>
