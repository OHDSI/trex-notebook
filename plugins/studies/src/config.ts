import { ref } from 'vue';

// Host-controlled switches. The Network section and its Configuration section
// (the network-plugin site config) are hidden unless the host opts in, e.g. d2e
// from its admin feature flags:
//
//   window.__studiesPluginConfig = { networkEnabled: true };
//
// The global is read on every mount. A host that resolves its flags after the
// plugin is already mounted dispatches CONFIG_EVENT to apply them live:
//
//   window.__studiesPluginConfig = { networkEnabled: true };
//   window.dispatchEvent(new Event('studies-plugin:config'));
export interface StudiesPluginConfig {
  networkEnabled?: boolean;
}

declare global {
  interface Window {
    __studiesPluginConfig?: StudiesPluginConfig;
  }
}

export const CONFIG_EVENT = 'studies-plugin:config';

export const networkEnabled = ref(false);

export function readHostConfig(): void {
  const config = typeof window !== 'undefined' ? window.__studiesPluginConfig : undefined;
  networkEnabled.value = config?.networkEnabled === true;
}

if (typeof window !== 'undefined') {
  window.addEventListener(CONFIG_EVENT, readHostConfig);
}
readHostConfig();
