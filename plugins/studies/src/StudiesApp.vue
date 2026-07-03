<template>
  <!-- Overview + Network live inside the boxed sidebar layout. Hidden (not
       unmounted) while Results is full-screen so their state is preserved. -->
  <div v-show="section !== 'results'" class="studies-fill">
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
    </StudiesLayout>
  </div>

  <!-- The Results viewer is a full application (module tabs, WebR viewer), so it
       takes over the whole canvas below the top nav rather than the boxed detail
       panel. Mounts lazily on first open and stays alive so switching away/back
       doesn't re-boot WebR. A compact control returns to the boxed Overview. -->
  <div
    v-if="visited.has('results')"
    v-show="section === 'results'"
    class="studies-results-full"
  >
    <button class="studies-results-full__back" @click="section = 'overview'">
      <AtlasIcon icon="mdi-arrow-left" size="16" />
      <span>Studies</span>
    </button>
    <ResultsTab />
  </div>
</template>

<script lang="ts">
export type StudiesSection = 'overview' | 'network' | 'results';
</script>

<script setup lang="ts">
import { ref, reactive, provide, watch } from 'vue';
import { AtlasIcon } from '@ohdsi/atlas-ui';
import StudiesLayout from './components/StudiesLayout.vue';
import LocalTab from './views/LocalTab.vue';
import NetworkTab from './views/NetworkTab.vue';
import ResultsTab from './views/ResultsTab.vue';

const section = ref<StudiesSection>('overview');
provide('studiesSection', section);

// Track which lazy sections have been opened at least once.
const visited = reactive(new Set<StudiesSection>(['overview']));
watch(section, (s) => visited.add(s), { immediate: true });
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
