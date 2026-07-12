<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useAuthStore } from '@/stores/auth'
import { usePendingOrderStore } from '@/stores/pendingOrder'
import { apiAnnouncements } from '@/api/announcements'
import PendingOrderAlert from '@/components/PendingOrderAlert.vue'
import PendingOrderDot from '@/components/PendingOrderDot.vue'
import type { Announcement } from '@/types'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const pending = usePendingOrderStore()
const collapsed = ref(false)

// Active announcements pushed by admins; pinned items first (server order).
const announcements = ref<Announcement[]>([])
const dismissed = ref<Set<string>>(new Set())

async function loadAnnouncements() {
  try {
    const { data } = await apiAnnouncements.list()
    announcements.value = data.items || []
  } catch {
    // Non-critical: a transient failure must not block the app shell.
    announcements.value = []
  }
}

function dismissAnnouncement(id: string) {
  const next = new Set(dismissed.value)
  next.add(id)
  dismissed.value = next
}

const visibleAnnouncements = () =>
  announcements.value.filter((a) => !dismissed.value.has(a.id))

const menus = [
  { name: 'dashboard', label: 'Dashboard', icon: 'Odometer' },
  { name: 'subscription', label: 'Subscription', icon: 'Connection' },
  { name: 'plans', label: 'Plans', icon: 'GoodsFilled' },
  { name: 'orders', label: 'Orders', icon: 'Tickets' },
  { name: 'traffic', label: 'Traffic', icon: 'DataLine' },
  { name: 'invites', label: 'Invites', icon: 'Promotion' },
  { name: 'announcements', label: 'Announcements', icon: 'Notification' },
  { name: 'settings', label: 'Settings', icon: 'Setting' },
]

function onLogout() {
  auth.logout()
  router.push('/login')
}

onMounted(() => {
  pending.refresh()
  loadAnnouncements()
})

// Re-evaluate pending orders on every navigation so the alert/dot reflect
// orders created/paid/closed on other pages without a full reload.
router.afterEach(() => {
  pending.refresh()
})
</script>

<template>
  <el-container class="layout">
    <el-aside :width="collapsed ? '64px' : '220px'" class="aside">
      <div class="brand" @click="router.push('/')">{{ collapsed ? 'V' : 'VGate' }}</div>
      <el-menu
        mode="vertical"
        :collapse="collapsed"
        :collapse-transition="false"
        router
        :default-active="(route.name as string) || 'dashboard'"
        class="nav"
      >
        <el-menu-item v-for="m in menus" :key="m.name" :index="m.name" :route="{ name: m.name }">
          <el-icon v-if="m.icon"><component :is="m.icon" /></el-icon>
          <template #title>
            {{ m.label }}
            <PendingOrderDot v-if="m.name === 'orders'" />
          </template>
        </el-menu-item>
      </el-menu>
      <div class="aside-footer" :class="{ collapsed }">
        <el-tag v-if="!collapsed" size="small" class="user-tag">{{ auth.username || auth.userId }}</el-tag>
        <div class="footer-actions">
          <el-button v-if="!collapsed" text @click="onLogout">Logout</el-button>
          <el-button text :title="collapsed ? 'Expand' : 'Collapse'" @click="collapsed = !collapsed">
            <el-icon><component :is="collapsed ? 'Expand' : 'Fold'" /></el-icon>
          </el-button>
        </div>
      </div>
    </el-aside>
    <el-container>
      <el-main class="main">
        <template v-for="a in visibleAnnouncements()" :key="a.id">
          <el-alert
            :title="a.title"
            :description="a.content || undefined"
            :type="a.pinned ? 'warning' : 'info'"
            :closable="true"
            show-icon
            class="announcement"
            @close="dismissAnnouncement(a.id)"
          />
        </template>
        <PendingOrderAlert />
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.layout {
  height: 100vh;
  overflow: hidden;
}
.aside {
  display: flex;
  flex-direction: column;
  border-right: 1px solid #e4e7ed;
  background: #fff;
  overflow-x: hidden;
}
.brand {
  font-weight: 700;
  font-size: 1.25rem;
  color: #409eff;
  cursor: pointer;
  padding: 18px 20px;
  letter-spacing: 0.5px;
  white-space: nowrap;
  overflow: hidden;
}
.nav {
  flex: 1;
  border-right: none;
}
.aside-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid #e4e7ed;
}
.aside-footer.collapsed {
  justify-content: center;
  padding: 10px;
}
.user-tag {
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
.footer-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}
.main {
  padding: 24px;
  overflow-y: auto;
}
.announcement {
  margin-bottom: 12px;
}
</style>
