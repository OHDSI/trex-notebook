// Thin client for the same-origin `network-api` trex function plugin. It holds
// the site's machine secret server-side and proxies to the central API; access is
// gated by the trex session (cookie), so requests send credentials. Mirrors the
// network plugin's own ApiClient, kept here because plugins are separate builds.
export class NetworkClient {
  constructor(private base: string) {}

  private async req<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {}
    if (body !== undefined) headers['content-type'] = 'application/json'
    const res = await fetch(`${this.base}${path}`, {
      method,
      headers,
      credentials: 'include',
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (res.status === 204) return undefined as T
    const text = await res.text()
    let parsed: { error?: { code: string; message: string } } | undefined
    try {
      parsed = text ? JSON.parse(text) : undefined
    } catch {
      throw new Error(`${path} returned a non-JSON response (status ${res.status}); network-api may be unreachable.`)
    }
    if (!res.ok) {
      const env = parsed?.error ?? { code: 'UNKNOWN', message: res.statusText }
      throw new Error(env.message || env.code)
    }
    return parsed as T
  }

  get<T>(path: string): Promise<T> {
    return this.req<T>('GET', path)
  }
  post<T>(path: string, body?: unknown): Promise<T> {
    return this.req<T>('POST', path, body)
  }
}

/** Same-origin network-api mount; respects a host-injected proxyUrl if present. */
export const defaultNetworkBase = (): string =>
  window.__networkPluginConfig?.proxyUrl || `${location.origin}/plugins/network-api/network-api`
