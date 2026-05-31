export interface NetworkConfig {
  /**
   * Same-origin base of the `network-api` trex function plugin. It holds the
   * site's machine (client-credentials) secret server-side and reverse-proxies
   * to the central API, so the browser never holds a token or talks to central
   * directly. All plugin API calls go here; access is gated by the trex session.
   */
  proxyUrl: string;
}

interface ConfigWindow {
  __networkPluginConfig?: Partial<NetworkConfig>;
}

/**
 * Runtime config: the trex host injects window.__networkPluginConfig (written
 * from NETWORK_* env vars by write-network-config.sh); dev falls back to a Vite
 * env var, then to the conventional same-origin mount of the network-api plugin.
 */
export function loadConfig(): NetworkConfig {
  const w = (typeof window !== 'undefined' ? window : {}) as ConfigWindow;
  const injected = w.__networkPluginConfig ?? {};
  const env = (import.meta as unknown as { env?: Record<string, string> }).env ?? {};
  return {
    proxyUrl:
      injected.proxyUrl ??
      env.VITE_PROXY_URL ??
      (typeof location !== 'undefined'
        ? `${location.origin}/plugins/network-api/network-api`
        : ''),
  };
}
