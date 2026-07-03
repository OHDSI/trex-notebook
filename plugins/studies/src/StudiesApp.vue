<template>
  <StudiesLayout>
    <!-- Overview is cheap and is the landing, so it stays mounted. Network and
         Results embed heavy plugin parcels (the Results viewer boots WebR), so
         they mount lazily on first visit and are then kept alive with v-show to
         preserve their state across section switches. -->
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
    <div
      v-if="visited.has('results')"
      v-show="section === 'results'"
      class="studies-section"
    >
      <ResultsTab />
    </div>
  </StudiesLayout>
</template>

<script lang="ts">
export type StudiesSection = 'overview' | 'network' | 'results';
</script>

<script setup lang="ts">
import { ref, reactive, provide, watch } from 'vue';
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
.studies-section {
  flex: 1;
  min-height: 0;
}
.studies-section--scroll {
  overflow-y: auto;
}
</style>
