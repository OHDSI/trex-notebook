import type { HadesJobDetail, RunRequest } from './hadesTypes';

export class HadesClient {
  constructor(private base: string, private fetchImpl: typeof fetch = fetch.bind(globalThis)) {}

  private async req<T>(path: string, init?: RequestInit): Promise<T> {
    const resp = await this.fetchImpl(`${this.base}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });
    if (!resp.ok) throw new Error(`hades-api ${path} failed: ${resp.status}`);
    return (await resp.json()) as T;
  }

  async execute(run: RunRequest): Promise<string> {
    return (
      await this.req<{ jobId: string }>('/jobs', { method: 'POST', body: JSON.stringify(run) })
    ).jobId;
  }
  async getJob(id: string): Promise<HadesJobDetail> {
    return this.req<HadesJobDetail>(`/jobs/${encodeURIComponent(id)}`);
  }
}

export const defaultHadesBase = (): string => `${location.origin}/plugins/hades-api/hades-api`;
