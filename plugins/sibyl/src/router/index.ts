import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import LoginView from '@/views/LoginView.vue'
import { generatePluginRoutes } from '@/plugins/navigation/PluginRoutes'
import { useAuthStore } from '@/stores/auth'

const routes: RouteRecordRaw[] = [
  { path: '/login', name: 'login', component: LoginView, meta: { public: true } },
  { path: '/', name: 'home', component: HomeView },
  ...generatePluginRoutes(),
]

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

// Global auth guard: unauthenticated users go to /login; authenticated users
// never see /login. Uses the Pinia auth store (Pinia is installed before the
// router in main.ts, so the store is available at navigation time).
router.beforeEach(to => {
  const auth = useAuthStore()
  if (!auth.isAuthenticated && to.name !== 'login') {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (auth.isAuthenticated && to.name === 'login') {
    return { path: (to.query.redirect as string) || '/' }
  }
  return true
})

export default router
