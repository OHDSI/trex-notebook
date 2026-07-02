<template>
  <div ref="mountEl" style="min-height: 60vh"></div>
</template>

<script setup lang="ts">
import { ref, inject, onMounted, onBeforeUnmount } from 'vue';
import type { StudiesHostCtx, HostParcel } from '../main';

const props = defineProps<{ pluginId: string }>();

const hostCtx = inject<StudiesHostCtx>('studiesHostCtx');
const mountEl = ref<HTMLElement | null>(null);

async function mountEmbeddedPlugin(): Promise<HostParcel | null> {
  if (!hostCtx || !mountEl.value) return null;
  if (!window.System) throw new Error('SystemJS is not available');

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
  });

  await parcel.mountPromise;
  return parcel;
}

// Track the in-flight mount so a fast tab-switch can't race an unmount past
// a parcel that hasn't finished mounting yet — onBeforeUnmount awaits this
// before calling unmount().
let parcelPromise: Promise<HostParcel | null> | null = null;

onMounted(() => {
  parcelPromise = mountEmbeddedPlugin();
});

onBeforeUnmount(async () => {
  const parcel = await parcelPromise?.catch(() => null);
  parcelPromise = null;
  await parcel?.unmount?.().catch(() => {});
});
</script>
