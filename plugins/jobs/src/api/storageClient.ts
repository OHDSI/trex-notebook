// Client for minting a presigned download URL for a published analysis-result
// object. The browser can't call storage directly (it holds the user bearer, not
// the storage service JWT), so this routes through the metadata-api function plugin's
// server-side `POST /results/sign`, which re-authes with the storage service JWT.
// Base mounts at `${location.origin}/plugins/metadata-api/metadata-api`.
import { authHeaders } from "./authToken";

export class StorageClient {
  constructor(private base: string) {} // e.g. `${location.origin}/plugins/metadata-api/metadata-api`

  async signedUrl(bucket: string, key: string, expiresIn = 3600): Promise<string> {
    const resp = await fetch(`${this.base}/results/sign`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ bucket, key, expiresIn }),
    });
    if (!resp.ok) throw new Error(`storage sign ${resp.status}`);
    const { signedURL } = await resp.json();
    return signedURL.startsWith("http")
      ? signedURL
      : `${location.origin}${signedURL}`;
  }
}

export const defaultStorageBase = () =>
  `${location.origin}/plugins/metadata-api/metadata-api`;
