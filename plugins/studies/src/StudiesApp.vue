<template>
  <AtlasTabs v-model="tab" class="mb-4">
    <AtlasTab value="local">Local</AtlasTab>
    <AtlasTab value="network">Network</AtlasTab>
    <AtlasTab value="results">Results</AtlasTab>
  </AtlasTabs>
  <v-window v-model="tab">
    <v-window-item value="local"><LocalTab /></v-window-item>
    <v-window-item value="network"><NetworkTab /></v-window-item>
    <v-window-item value="results"><ResultsTab /></v-window-item>
  </v-window>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { AtlasTabs, AtlasTab } from '@ohdsi/atlas-ui';
import LocalTab from './views/LocalTab.vue';
import NetworkTab from './views/NetworkTab.vue';
import ResultsTab from './views/ResultsTab.vue';

const tab = ref<'local' | 'network' | 'results'>('local');
</script>
