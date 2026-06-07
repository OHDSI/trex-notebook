import { defineStore } from 'pinia'
import { ref } from 'vue'
import { HadesClient, defaultHadesBase, type HadesEnv } from '@/api/hadesClient'

export const useEnvsStore = defineStore('envs', () => {
  const client = new HadesClient(defaultHadesBase())
  const envs = ref<HadesEnv[]>([])
  const provisioning = ref(false)
  const deleting = ref<string | null>(null)
  const error = ref<string | null>(null)

  async function fetchEnvs(): Promise<void> {
    try { envs.value = await client.listEnvs(); error.value = null }
    catch (e) { error.value = e instanceof Error ? e.message : String(e) }
  }

  async function provision(envName: string, lockfilePath: string): Promise<void> {
    provisioning.value = true; error.value = null
    try { await client.setupEnv(envName, lockfilePath); await fetchEnvs() }
    catch (e) { error.value = e instanceof Error ? e.message : String(e) }
    finally { provisioning.value = false }
  }

  async function deleteEnv(envName: string): Promise<void> {
    deleting.value = envName; error.value = null
    try { await client.deleteEnv(envName); await fetchEnvs() }
    catch (e) { error.value = e instanceof Error ? e.message : String(e) }
    finally { deleting.value = null }
  }

  return { envs, provisioning, deleting, error, fetchEnvs, provision, deleteEnv }
})
