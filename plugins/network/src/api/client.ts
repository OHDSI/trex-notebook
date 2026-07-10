export class ApiClientError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = 'ApiClientError';
  }
}

import { ensureAuthToken } from './authToken';

type Fetch = typeof fetch;

export class ApiClient {
  constructor(
    private baseUrl: string,
    private getToken: () => string | null,
    // Bind to the global so native fetch keeps its required `this` (calling it as
    // `this.fetchImpl(...)` otherwise throws "Illegal invocation"). Injected mocks
    // (tests) are used as-is.
    private fetchImpl: Fetch = fetch.bind(globalThis),
  ) {}

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    await ensureAuthToken();
    const headers: Record<string, string> = {};
    const token = this.getToken();
    if (token) headers.authorization = `Bearer ${token}`;
    if (body !== undefined) headers['content-type'] = 'application/json';

    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (res.status === 204) return undefined as T;
    const text = await res.text();
    let parsed: { error?: { code: string; message: string } } | undefined;
    try {
      parsed = text ? JSON.parse(text) : undefined;
    } catch {
      // A non-JSON body (e.g. an HTML SPA-fallback or proxy error page) means the
      // endpoint wasn't reachable as an API. Surface a clear error instead of a raw
      // "Unexpected token '<'" JSON.parse crash.
      throw new ApiClientError(
        res.status,
        'NON_JSON_RESPONSE',
        `${path} returned a non-JSON response (status ${res.status}); the network-api function may be unreachable.`,
      );
    }
    if (!res.ok) {
      const env = parsed?.error ?? { code: 'UNKNOWN', message: res.statusText };
      throw new ApiClientError(res.status, env.code, env.message);
    }
    return parsed as T;
  }

  get<T>(path: string) {
    return this.request<T>('GET', path);
  }
  post<T>(path: string, body?: unknown) {
    return this.request<T>('POST', path, body);
  }
}
