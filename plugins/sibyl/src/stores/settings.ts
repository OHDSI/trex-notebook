import { defineStore } from 'pinia'
import { ref } from 'vue'
import { GraphqlClient, defaultGraphqlEndpoint } from '@/api/graphqlClient'

export const WEBAPI_SETTING_KEY = 'webapi_url'

const Q_GET = `query($k:String!){ appSettingByKey(key:$k){ value } }`
const M_UPDATE = `mutation($k:String!,$v:String!){ updateAppSettingByKey(input:{ key:$k, appSettingPatch:{ value:$v } }){ clientMutationId } }`
const M_CREATE = `mutation($k:String!,$v:String!){ createAppSetting(input:{ appSetting:{ key:$k, value:$v } }){ clientMutationId } }`

/** Publish the WebAPI URL so plugins (notebook/strategus) can read it. */
function publishWebApiUrl(url: string): void {
  ;(window as unknown as { __sibylWebApiUrl?: string }).__sibylWebApiUrl = url
  window.dispatchEvent(new CustomEvent('sibyl:webapi-url-changed', { detail: url }))
}

export const useSettingsStore = defineStore('settings', () => {
  const client = new GraphqlClient(defaultGraphqlEndpoint())
  const webApiUrl = ref('')
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)

  async function load(): Promise<void> {
    loading.value = true; error.value = null
    try {
      const data = await client.request<{ appSettingByKey: { value: string } | null }>(Q_GET, { k: WEBAPI_SETTING_KEY })
      webApiUrl.value = data.appSettingByKey?.value ?? ''
      if (webApiUrl.value) publishWebApiUrl(webApiUrl.value)
    } catch (e) { error.value = e instanceof Error ? e.message : String(e) }
    finally { loading.value = false }
  }

  async function save(url: string): Promise<void> {
    saving.value = true; error.value = null
    try {
      const existing = await client.request<{ appSettingByKey: { value: string } | null }>(Q_GET, { k: WEBAPI_SETTING_KEY })
      if (existing.appSettingByKey) {
        await client.request(M_UPDATE, { k: WEBAPI_SETTING_KEY, v: url })
      } else {
        await client.request(M_CREATE, { k: WEBAPI_SETTING_KEY, v: url })
      }
      webApiUrl.value = url
      publishWebApiUrl(url)
    } catch (e) { error.value = e instanceof Error ? e.message : String(e); throw e }
    finally { saving.value = false }
  }

  async function testConnection(url: string): Promise<boolean> {
    const base = url.replace(/\/$/, '')
    try {
      const resp = await fetch(`${base}/info`)
      return resp.ok
    } catch { return false }
  }

  return { webApiUrl, loading, saving, error, load, save, testConnection }
})
