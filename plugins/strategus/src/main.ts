import { h, createApp } from 'vue';
import { createPinia } from 'pinia';
import { createVuetify } from 'vuetify';
import { aliases, mdi } from 'vuetify/iconsets/mdi';
import singleSpaVue from 'single-spa-vue';
import StrategusApp from './StrategusApp.vue';

const CSS_LINK_ID = 'strategus-plugin-styles';
const MDI_LINK_ID = 'strategus-plugin-mdi';

function injectPluginCss(uiFilesUrl: string): void {
  if (document.getElementById(CSS_LINK_ID)) return;
  // uiFilesUrl is the plugin's public directory (e.g. "/plugins/strategus-plugin/")
  // The CSS file lives directly inside that directory
  const base = uiFilesUrl
    ? uiFilesUrl.replace(/\/$/, '')
    : `${window.location.origin}/plugins/strategus-plugin`;
  const link = document.createElement('link');
  link.id = CSS_LINK_ID;
  link.rel = 'stylesheet';
  link.href = base + '/style.css';
  document.head.appendChild(link);
}

function removePluginCss(): void {
  document.getElementById(CSS_LINK_ID)?.remove();
}

function injectMdiCss(): void {
  if (document.getElementById(MDI_LINK_ID)) return;
  // If host already provides MDI font, skip
  if (typeof document.fonts !== 'undefined' && document.fonts.check && document.fonts.check('16px "Material Design Icons"')) {
    return;
  }
  const link = document.createElement('link');
  link.id = MDI_LINK_ID;
  link.rel = 'stylesheet';
  link.href = 'https://cdn.jsdelivr.net/npm/@mdi/font@7/css/materialdesignicons.min.css';
  document.head.appendChild(link);
}

export interface PluginProps {
  name: string;
  mountParcel: unknown;
  singleSpa: unknown;
  uiFilesUrl?: string;
  authContext: {
    user: { id: string; username: string; email?: string; permissions: string[] } | null;
    token: string | null;
    isAuthenticated: boolean;
    hasPermission: (permission: string) => boolean;
  };
  messageBus: {
    send: <T = unknown>(type: string, payload: T) => void;
    request: <TReq = unknown, TRes = unknown>(type: string, payload: TReq) => Promise<TRes>;
    subscribe: <T = unknown>(type: string, callback: (payload: T) => void) => () => void;
  };
}

// Read host's shared Vuetify config if available; otherwise use minimal fallback.
// The host exposes its actual `buildVuetifyOptions()` output on window so the
// plugin's components inherit the same density, rounding, and variant defaults
// without hand-mirroring (which would silently drift if the host's theme changed).
function getSharedDefaults(): Record<string, Record<string, unknown>> {
  const config = (typeof window !== 'undefined')
    ? (window as unknown as { __atlasUiConfig?: { defaults?: Record<string, Record<string, unknown>> } }).__atlasUiConfig
    : undefined;
  if (config?.defaults) return config.defaults;
  // Minimal fallback for plugin loaded outside Atlas3 host
  return {
    VBtn: { variant: 'flat', color: 'primary', rounded: 'lg' },
    VCard: { variant: 'flat', rounded: 'lg' },
    VTextField: { variant: 'outlined', density: 'compact', rounded: 'md' },
    VSelect: { variant: 'outlined', density: 'compact', rounded: 'md' },
    VChip: { variant: 'tonal', rounded: 'md', density: 'compact' },
    VAlert: { variant: 'tonal', rounded: 'md' },
  };
}

const vuetify = createVuetify({
  theme: false as never,  // host's CSS already provides theme via :root tokens
  icons: {
    defaultSet: 'mdi',
    aliases,
    sets: { mdi },
  },
  defaults: getSharedDefaults(),
});

const vueLifecycles = singleSpaVue({
  createApp,
  appOptions: {
    render() {
      return h(StrategusApp, {
        authContext: (this as unknown as PluginProps).authContext,
        messageBus: (this as unknown as PluginProps).messageBus,
      });
    },
  },
  handleInstance(app) {
    const pinia = createPinia();
    app.use(pinia);
    app.use(vuetify);
  },
});

export const bootstrap = async (props: PluginProps) => {
  const baseUrl = props.uiFilesUrl ?? '';
  injectPluginCss(baseUrl);
  injectMdiCss();
  return vueLifecycles.bootstrap(props);
};

export const mount = vueLifecycles.mount;

export const unmount = async (props: PluginProps) => {
  const result = await vueLifecycles.unmount(props);
  removePluginCss();
  return result;
};
