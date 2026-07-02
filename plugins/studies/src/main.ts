import { h, createApp } from 'vue';
import { setAuthToken } from './api/authToken';
import { createPinia } from 'pinia';
import { createVuetify } from 'vuetify';
import { aliases, mdi } from 'vuetify/iconsets/mdi';
import singleSpaVue from 'single-spa-vue';
import StudiesApp from './StudiesApp.vue';

const CSS_LINK_ID = 'studies-plugin-styles';

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
  // uiFilesUrl is the plugin's public directory (e.g. "/plugins/studies-plugin/")
  // The CSS file lives directly inside that directory
  const base = uiFilesUrl
    ? uiFilesUrl.replace(/\/$/, '')
    : `${window.location.origin}/plugins/studies-plugin`;
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
  console.warn('[studies] MDI font not present from host; icons may be missing.');
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

// Minimal shape of the single-spa parcel returned by `mountParcel`/`mountRootParcel`.
// Kept local (rather than typed against the `single-spa` package) because this
// plugin only depends on `single-spa-vue`, not `single-spa` itself.
export interface HostParcel {
  mountPromise: Promise<unknown>;
  unmount?: () => Promise<unknown>;
}

export type MountParcelFn = (
  parcelConfig: unknown,
  customProps: { domElement: HTMLElement } & Record<string, unknown>
) => HostParcel;

// Context handed down to tab components so they can embed sibling plugins
// (results-viewer, network-plugin) as single-spa parcels — see PluginEmbed.vue.
export interface StudiesHostCtx {
  mountParcel: MountParcelFn;
  authContext: PluginProps['authContext'];
  messageBus: PluginProps['messageBus'];
  uiFilesUrl: string;
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
      return h(StudiesApp);
    },
  },
  handleInstance(app, props) {
    const pinia = createPinia();
    app.use(pinia);
    app.use(vuetify);

    const pluginProps = props as PluginProps;
    const hostCtx: StudiesHostCtx = {
      mountParcel: pluginProps.mountParcel as MountParcelFn,
      authContext: pluginProps.authContext,
      messageBus: pluginProps.messageBus,
      uiFilesUrl: pluginProps.uiFilesUrl ?? '',
    };
    app.provide('studiesHostCtx', hostCtx);
  },
});

export const bootstrap = async (props: PluginProps) => {
  setAuthToken(props.authContext?.token ?? null);
  const baseUrl = props.uiFilesUrl ?? '';
  await injectPluginCss(baseUrl);
  injectMdiCss();
  return vueLifecycles.bootstrap(props);
};

export const mount = vueLifecycles.mount;

export const unmount = async (props: PluginProps) => {
  return vueLifecycles.unmount(props);
};
