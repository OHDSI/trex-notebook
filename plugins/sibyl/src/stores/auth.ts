import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AuthContext } from '@/models/PluginModels'
import * as trexAuth from '@/services/auth/trexAuth'
import type { TrexSession, TrexUser } from '@/services/auth/trexAuth'

export const useAuthStore = defineStore('auth', () => {
  const session = ref<TrexSession | null>(trexAuth.loadSession())
  const user = ref<TrexUser | null>(null)

  const isAuthenticated = computed(() => !!session.value && !trexAuth.isExpired(session.value))

  const authContext = computed<AuthContext>(() => trexAuth.toAuthContext(session.value, user.value))

  async function login(email: string, password: string): Promise<void> {
    const s = await trexAuth.login(email, password)
    session.value = s
    trexAuth.saveSession(s)
    user.value = await trexAuth.fetchUser(s.access_token)
  }

  function logout(): void {
    if (session.value) void trexAuth.logout(session.value.access_token)
    session.value = null
    user.value = null
    trexAuth.clearSession()
  }

  // On boot: if a valid session is stored, load the user so authContext is
  // complete before the plugin framework initializes.
  async function hydrate(): Promise<void> {
    const s = session.value
    if (!s) return
    if (trexAuth.isExpired(s)) {
      logout()
      return
    }
    try {
      user.value = await trexAuth.fetchUser(s.access_token)
    } catch {
      logout()
    }
  }

  return { session, user, isAuthenticated, authContext, login, logout, hydrate }
})
