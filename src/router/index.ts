import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore, AUTH_STORAGE_KEY } from '@/stores/auth'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { public: true },
  },
  {
    path: '/verify-email',
    name: 'verify-email',
    component: () => import('@/views/VerifyEmailView.vue'),
    meta: { public: true },
  },
  {
    path: '/',
    component: () => import('@/layouts/UserLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'dashboard',
        component: () => import('@/views/DashboardView.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'subscription',
        name: 'subscription',
        component: () => import('@/views/SubscriptionView.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'plans',
        name: 'plans',
        component: () => import('@/views/PlansView.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'orders',
        name: 'orders',
        component: () => import('@/views/OrdersView.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'traffic',
        name: 'traffic',
        component: () => import('@/views/TrafficView.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'invites',
        name: 'invites',
        component: () => import('@/views/InvitesView.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'redeem',
        name: 'redeem',
        component: () => import('@/views/RedeemView.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'announcements',
        name: 'announcements',
        component: () => import('@/views/AnnouncementsView.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'tickets',
        name: 'tickets',
        component: () => import('@/views/TicketsView.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'settings',
        name: 'settings',
        component: () => import('@/views/SettingsView.vue'),
        meta: { requiresAuth: true },
      },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to) => {
  const auth = useAuthStore()

  let isAuthenticated = auth.isAuthenticated
  if (!isAuthenticated) {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (raw) {
      try {
        const sess = JSON.parse(raw)
        if (sess.token) isAuthenticated = true
      } catch {
        /* ignore malformed */
      }
    }
  }

  if (to.meta.requiresAuth && !isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  // Only the login page is skipped for already-authenticated users. Other
  // public routes (e.g. /verify-email) must still render — with A1 auto-login
  // a pending user is already authenticated when they click the emailed
  // verification link, and bouncing them to the dashboard would prevent the
  // verification from ever running.
  if (to.name === 'login' && isAuthenticated) {
    return { name: 'dashboard' }
  }
  return true
})

export default router
