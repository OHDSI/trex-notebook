<template>
  <!-- Boxed sidebar layout: Overview / Network / Results list. Hidden (not
       unmounted) while a result is open full-screen so its state is preserved. -->
  <div v-show="!openResultId" class="studies-fill">
    <StudiesLayout>
      <div v-show="section === 'overview'" class="studies-section studies-section--scroll">
        <LocalTab />
      </div>
      <div
        v-if="visited.has('network')"
        v-show="section === 'network'"
        class="studies-section"
      >
        <NetworkTab />
      </div>
      <div v-show="section === 'results'" class="studies-section studies-section--scroll">
        <ResultsTab />
      </div>
    </StudiesLayout>
  </div>

  <!-- Full-screen result viewer. The Results viewer is a full application, so it
       takes over the whole canvas below the top nav. Keyed by id so opening a
       different result mounts a fresh viewer (fresh WebR session). The embedded
       viewer hides its own library + back; the pill below returns to the list. -->
  <div v-if="openResultId" class="studies-results-full">
    <button class="studies-results-full__back" @click="closeResult">
      <AtlasIcon icon="mdi-arrow-left" size="16" />
      <span>Results</span>
    </button>
    <PluginEmbed
      :key="openResultId"
      plugin-id="results-viewer"
      :parcel-props="{ embedded: true, openResultId }"
    />
  </div>
</template>

<script lang="ts">
export type StudiesSection = 'overview' | 'network' | 'results';
</script>

<script setup lang="ts">
import { ref, reactive, provide, inject, watch, onMounted, onUnmounted } from 'vue';
import { AtlasIcon } from '@ohdsi/atlas-ui';
import StudiesLayout from './components/StudiesLayout.vue';
import PluginEmbed from './components/PluginEmbed.vue';
import LocalTab from './views/LocalTab.vue';
import NetworkTab from './views/NetworkTab.vue';
import ResultsTab from './views/ResultsTab.vue';

const section = ref<StudiesSection>('overview');
provide('studiesSection', section);

// Set by the Results list to open a result full-screen; cleared to return.
const openResultId = ref<string | null>(null);
provide('studiesOpenResult', openResultId);

// Lazily mount Network on first visit, then keep it alive across switches.
const visited = reactive(new Set<StudiesSection>(['overview']));
watch(section, (s) => visited.add(s), { immediate: true });

function closeResult(): void {
  openResultId.value = null;
}

// The embedded viewer hands Back navigation to us over the shared host message
// bus (it doesn't own the list). Return to the boxed Results list.
type Bus = { subscribe?: (ch: string, cb: (p: unknown) => void) => (() => void) | void };
const hostCtx = inject<{ messageBus?: Bus }>('studiesHostCtx');
let unsubscribe: (() => void) | void;
onMounted(() => {
  unsubscribe = hostCtx?.messageBus?.subscribe?.('results-viewer:back', closeResult);
});
onUnmounted(() => unsubscribe?.());
</script>

<style scoped>
.studies-fill {
  height: calc(100vh - 60px);
}
.studies-section {
  flex: 1;
  min-height: 0;
}
.studies-section--scroll {
  overflow-y: auto;
}

/* Full-bleed Results takeover — the whole viewport below the top nav. */
.studies-results-full {
  position: relative;
  width: 100%;
  height: calc(100vh - 60px);
  overflow: hidden;
  background: rgb(var(--v-theme-surface));
}
.studies-results-full__back {
  position: absolute;
  top: 12px;
  right: 16px;
  /* Above the Results viewer's own loading overlay (z-index 200) so it stays
     reachable while WebR is booting. */
  z-index: 300;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px 5px 8px;
  font-size: 12px;
  font-weight: 500;
  color: rgb(var(--v-theme-primary));
  background: #ffffff;
  border: 1px solid rgba(var(--v-theme-primary), 0.2);
  border-radius: 999px;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.12);
  cursor: pointer;
  font-family: inherit;
  transition: background 120ms ease;
}
.studies-results-full__back:hover {
  background: rgba(var(--v-theme-primary), 0.06);
}
</style>
