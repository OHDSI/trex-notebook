export interface HadesEnv {
  envName: string
  path: string
}

export class HadesClient {
  constructor(private base: string) {}

  private async req<T>(path: string, init?: RequestInit): Promise<T> {
    const resp = await fetch(`${this.base}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    })
    if (!resp.ok) throw new Error(`hades-api ${path} failed: ${resp.status}`)
    return (await resp.json()) as T
  }

  async listEnvs(): Promise<HadesEnv[]> {
    return (await this.req<{ envs: HadesEnv[] }>('/envs')).envs
  }
  async setupEnv(envName: string, lockfilePath: string): Promise<void> {
    await this.req('/envs', { method: 'POST', body: JSON.stringify({ envName, lockfilePath }) })
  }
  async deleteEnv(envName: string): Promise<void> {
    await this.req(`/envs/${encodeURIComponent(envName)}`, { method: 'DELETE' })
  }
}

export const defaultHadesBase = () => `${location.origin}/plugins/hades-api/hades-api`
