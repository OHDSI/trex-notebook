import './style.css';
import { h, createApp } from 'vue';
import { setAuthToken } from './api/authToken';
import { createPinia } from 'pinia';
import { createVuetify } from 'vuetify';
import { aliases, mdi } from 'vuetify/iconsets/mdi';
import singleSpaVue from 'single-spa-vue';
import NotebookApp from './NotebookApp.vue';

const CSS_LINK_ID = 'notebook-plugin-styles';

function injectPluginCss(uiFilesUrl: string): Promise<void> {
  const existing = document.getElementById(CSS_LINK_ID) as HTMLLinkElement | null;
  if (existing) {
    return existing.dataset.loaded === 'true'
      ? Promise.resolve()
      : new Promise<void>((resolve) => {
          existing.addEventListener('load', () => resolve(), { once: true });
          existing.addEventListener('error', () => resolve(), { once: true });
        });
  }
  const base = uiFilesUrl
    ? uiFilesUrl.replace(/\/$/, '')
    : `${window.location.origin}/plugins/notebook-plugin`;
  return new Promise<void>((resolve) => {
    const link = document.createElement('link');
    link.id = CSS_LINK_ID;
    link.rel = 'stylesheet';
    link.href = base + '/style.css';
    // Resolve on load so mount() never paints before CSS applies; resolve (not
    // reject) on error so a missing file can't hang the parcel forever.
    link.addEventListener('load', () => { link.dataset.loaded = 'true'; resolve(); }, { once: true });
    link.addEventListener('error', () => { link.dataset.loaded = 'true'; resolve(); }, { once: true }); // mark settled so a remount doesn't await a dead listener
    document.head.appendChild(link);
  });
}

function injectMdiCss(): void {
  if (typeof document.fonts !== 'undefined' && document.fonts.check?.('16px "Material Design Icons"')) {
    return; // host already provides MDI
  }
  console.warn('[notebook] MDI font not present from host; icons may be missing.');
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

function getSharedDefaults(): Record<string, Record<string, unknown>> {
  const config = (typeof window !== 'undefined')
    ? (window as unknown as { __atlasUiConfig?: { defaults?: Record<string, Record<string, unknown>> } }).__atlasUiConfig
    : undefined;
  if (config?.defaults) return config.defaults;
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
  theme: false as never,
  icons: { defaultSet: 'mdi', aliases, sets: { mdi } },
  defaults: getSharedDefaults(),
});

const vueLifecycles = singleSpaVue({
  createApp,
  appOptions: {
    render() {
      return h(NotebookApp);
    },
  },
  handleInstance(app) {
    const pinia = createPinia();
    app.use(pinia);
    app.use(vuetify);
  },
});

export const bootstrap = async (props: PluginProps) => {
  setAuthToken(props.authContext?.token ?? null);
  const baseUrl = props.uiFilesUrl ?? '';
  await injectPluginCss(baseUrl);
  injectMdiCss();
  (window as unknown as { __notebookAuthUserId?: string | null }).__notebookAuthUserId =
    props.authContext?.user?.id ?? null;
  return vueLifecycles.bootstrap(props);
};

export const mount = vueLifecycles.mount;

export const unmount = async (props: PluginProps) => {
  return vueLifecycles.unmount(props);
};
