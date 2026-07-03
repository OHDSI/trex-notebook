<template>
  <div>
    <div v-if="loading" style="display:flex; justify-content:center; padding:3rem">
      <AtlasProgressCircular indeterminate />
    </div>
    <AtlasAlert v-if="error" type="error" style="margin:1rem">
      Failed to load the {{ pluginId }} plugin: {{ error }}
    </AtlasAlert>
    <div ref="mountEl" v-show="!error" style="min-height: 60vh"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, inject, onMounted, onBeforeUnmount } from 'vue';
import { AtlasProgressCircular, AtlasAlert } from '@ohdsi/atlas-ui';
import type { StudiesHostCtx, HostParcel } from '../main';

const props = defineProps<{
  pluginId: string;
  /** Extra props merged into the mounted parcel (e.g. { embedded, openResultId }). */
  parcelProps?: Record<string, unknown>;
}>();

const hostCtx = inject<StudiesHostCtx>('studiesHostCtx');
const mountEl = ref<HTMLElement | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

async function mountEmbeddedPlugin(): Promise<HostParcel | null> {
  if (!hostCtx || !mountEl.value) throw new Error('studies host context unavailable');
  if (!window.System) throw new Error('SystemJS is not available');
  // uiFilesUrl is this plugin's own base (…/plugins/studies-plugin/); swap the id
  // to resolve the target plugin's bundle. Guard against an unexpected base.
  if (!hostCtx.uiFilesUrl.includes('studies-plugin')) {
    throw new Error(`cannot resolve plugin base from "${hostCtx.uiFilesUrl}"`);
  }
  const targetUrl = hostCtx.uiFilesUrl.replace('studies-plugin', props.pluginId);
  const lifecycles = await window.System.import(targetUrl + 'index.system.js');

  const parcel = hostCtx.mountParcel(lifecycles, {
    domElement: mountEl.value,
    name: props.pluginId,
    authContext: hostCtx.authContext,
    messageBus: hostCtx.messageBus,
    appId: props.pluginId,
    getToken: async () => hostCtx.authContext?.token ?? '',
    locale: document.documentElement.lang || 'en',
    isAtlas: true,
    uiFilesUrl: targetUrl,
    autoMount: false,
    ...(props.parcelProps ?? {}),
  });

  await parcel.mountPromise;
  return parcel;
}

// Track the in-flight mount so a fast tab-switch can't race an unmount past
// a parcel that hasn't finished mounting yet — onBeforeUnmount awaits this
// before calling unmount().
let parcelPromise: Promise<HostParcel | null> | null = null;

onMounted(() => {
  parcelPromise = mountEmbeddedPlugin()
    .then((p) => {
      loading.value = false;
      return p;
    })
    .catch((e) => {
      error.value = e instanceof Error ? e.message : String(e);
      loading.value = false;
      console.error(`[studies] failed to embed ${props.pluginId}:`, e);
      return null;
    });
});

onBeforeUnmount(async () => {
  const parcel = await parcelPromise?.catch(() => null);
  parcelPromise = null;
  await parcel?.unmount?.().catch(() => {});
});
</script>
