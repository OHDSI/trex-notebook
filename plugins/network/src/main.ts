import { h, createApp } from 'vue';
import { createPinia } from 'pinia';
import { createVuetify } from 'vuetify';
import { aliases, mdi } from 'vuetify/iconsets/mdi';
import singleSpaVue from 'single-spa-vue';
import NetworkApp from './NetworkApp.vue';

const CSS_LINK_ID = 'network-plugin-styles';
const MDI_LINK_ID = 'network-plugin-mdi';

function injectPluginCss(uiFilesUrl: string): void {
  if (document.getElementById(CSS_LINK_ID)) return;
  const base = uiFilesUrl
    ? uiFilesUrl.replace(/\/$/, '')
    : `${window.location.origin}/plugins/network-plugin`;
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
  if (
    typeof document.fonts !== 'undefined' &&
    document.fonts.check &&
    document.fonts.check('16px "Material Design Icons"')
  ) {
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
  uiFilesUrl?: string;
  authContext?: unknown;
  messageBus?: unknown;
}

function getSharedDefaults(): Record<string, Record<string, unknown>> {
  const config =
    typeof window !== 'undefined'
      ? (window as unknown as { __atlasUiConfig?: { defaults?: Record<string, Record<string, unknown>> } })
          .__atlasUiConfig
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
      return h(NetworkApp);
    },
  },
  handleInstance(app) {
    app.use(createPinia());
    app.use(vuetify);
  },
});

export const bootstrap = async (props: PluginProps) => {
  injectPluginCss(props.uiFilesUrl ?? '');
  injectMdiCss();
  return vueLifecycles.bootstrap(props);
};

export const mount = vueLifecycles.mount;

export const unmount = async (props: PluginProps) => {
  const result = await vueLifecycles.unmount(props);
  removePluginCss();
  return result;
};
