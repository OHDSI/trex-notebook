// Client for the metadata-api function plugin's server-side carve-outs:
// the encrypted CDM password and result publishing. Base mounts at
// `${location.origin}/plugins/metadata-api/metadata-api`.
import { authHeaders } from "./authToken";

export class MetadataClient {
  constructor(private base: string) {}

  private async post<T>(path: string, body: unknown): Promise<T> {
    const resp = await fetch(`${this.base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body),
    });
    if (!resp.ok) throw new Error(`metadata-api ${path} ${resp.status}`);
    return (await resp.json()) as T;
  }

  setPassword(id: string, password: string) {
    return this.post(`/cdm-connections/${encodeURIComponent(id)}/password`, { password });
  }

  publishResult(jobId: string, definitionId?: string, cdmConnectionId?: string) {
    return this.post(`/results/publish`, { jobId, definitionId, cdmConnectionId });
  }
}

export const defaultMetadataBase = () =>
  `${location.origin}/plugins/metadata-api/metadata-api`;
