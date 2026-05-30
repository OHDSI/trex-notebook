export interface NetworkConfig {
  apiUrl: string;
  cognitoDomain: string;
  clientId: string;
  redirectUri: string;
}

interface ConfigWindow {
  __networkPluginConfig?: Partial<NetworkConfig>;
}

/** Runtime config: host may inject window.__networkPluginConfig; dev falls back to Vite env. */
export function loadConfig(): NetworkConfig {
  const w = (typeof window !== 'undefined' ? window : {}) as ConfigWindow;
  const injected = w.__networkPluginConfig ?? {};
  const env = (import.meta as unknown as { env?: Record<string, string> }).env ?? {};
  return {
    apiUrl: injected.apiUrl ?? env.VITE_API_URL ?? '',
    cognitoDomain: injected.cognitoDomain ?? env.VITE_COGNITO_DOMAIN ?? '',
    clientId: injected.clientId ?? env.VITE_COGNITO_CLIENT_ID ?? '',
    redirectUri:
      injected.redirectUri ??
      env.VITE_REDIRECT_URI ??
      (typeof location !== 'undefined' ? `${location.origin}/plugins/network/callback` : ''),
  };
}
