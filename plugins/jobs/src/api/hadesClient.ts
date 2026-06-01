import type { HadesJob, HadesJobDetail, HadesEnv, RunRequest } from "./types";

export class HadesClient {
  constructor(private base: string) {}

  private async req<T>(path: string, init?: RequestInit): Promise<T> {
    const resp = await fetch(`${this.base}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
    if (!resp.ok) throw new Error(`hades-api ${path} failed: ${resp.status}`);
    return (await resp.json()) as T;
  }

  async listJobs(): Promise<HadesJob[]> {
    return (await this.req<{ jobs: HadesJob[] }>("/jobs")).jobs;
  }
  async getJob(id: string): Promise<HadesJobDetail> {
    return await this.req<HadesJobDetail>(`/jobs/${encodeURIComponent(id)}`);
  }
  async cancel(id: string): Promise<void> {
    await this.req(`/jobs/${encodeURIComponent(id)}`, { method: "DELETE" });
  }
  async execute(run: RunRequest): Promise<string> {
    return (await this.req<{ jobId: string }>("/jobs", {
      method: "POST", body: JSON.stringify(run),
    })).jobId;
  }
  async listEnvs(): Promise<HadesEnv[]> {
    return (await this.req<{ envs: HadesEnv[] }>("/envs")).envs;
  }
  async setupEnv(envName: string, lockfilePath: string): Promise<void> {
    await this.req("/envs", { method: "POST", body: JSON.stringify({ envName, lockfilePath }) });
  }
}

export const defaultBase = () => `${location.origin}/plugins/hades-api/hades-api`;
