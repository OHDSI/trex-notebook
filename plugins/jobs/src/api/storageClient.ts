// Client for trex's Supabase-compatible storage API. Used to mint a presigned
// download URL for a published analysis-result object.
export class StorageClient {
  constructor(private base: string) {} // e.g. `${location.origin}/trex/storage/v1`

  async signedUrl(bucket: string, key: string, expiresIn = 3600): Promise<string> {
    const resp = await fetch(`${this.base}/object/sign/${bucket}/${key}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn }),
    });
    if (!resp.ok) throw new Error(`storage sign ${resp.status}`);
    const { signedURL } = await resp.json();
    return signedURL.startsWith("http")
      ? signedURL
      : `${location.origin}/trex/storage/v1${signedURL}`;
  }
}

export const defaultStorageBase = () => `${location.origin}/trex/storage/v1`;
