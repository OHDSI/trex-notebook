export class ApiClientError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = 'ApiClientError';
  }
}

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
    const parsed = text ? JSON.parse(text) : undefined;
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
  patch<T>(path: string, body?: unknown) {
    return this.request<T>('PATCH', path, body);
  }
  del<T>(path: string) {
    return this.request<T>('DELETE', path);
  }
}
