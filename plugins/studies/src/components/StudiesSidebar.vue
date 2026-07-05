<template>
  <nav class="studies-sidebar">
    <div class="studies-sidebar__header">
      <div class="studies-sidebar__title">Studies</div>
    </div>
    <div class="studies-sidebar__body">
      <button
        v-for="it in items"
        :key="it.key"
        class="studies-sidebar__item"
        :class="{ 'is-active': section === it.key }"
        @click="section = it.key"
      >
        <AtlasIcon :icon="it.icon" size="16" />
        <span>{{ it.label }}</span>
      </button>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { inject, type Ref } from 'vue';
import { AtlasIcon } from '@ohdsi/atlas-ui';
import type { StudiesSection } from '../StudiesApp.vue';

// Shared active-section ref provided by StudiesApp.
const section = inject<Ref<StudiesSection>>('studiesSection')!;

const items: Array<{ key: StudiesSection; label: string; icon: string }> = [
  { key: 'overview', label: 'Overview', icon: 'mdi-view-dashboard-outline' },
  { key: 'network', label: 'Network', icon: 'mdi-earth' },
  { key: 'results', label: 'Results', icon: 'mdi-chart-box-outline' },
];
</script>

<style scoped>
.studies-sidebar {
  width: 220px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border-right: 1px solid rgba(0, 0, 0, 0.08);
  overflow: hidden;
}
.studies-sidebar__header {
  padding: 16px 16px 12px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  flex-shrink: 0;
}
.studies-sidebar__title {
  font-size: 15px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.87);
}
.studies-sidebar__body {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.studies-sidebar__item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  text-align: left;
  padding: 8px 12px;
  font-size: 13px;
  color: rgba(0, 0, 0, 0.7);
  background: none;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-family: inherit;
  transition: background 120ms ease, color 120ms ease;
}
.studies-sidebar__item:hover {
  background: rgba(var(--v-theme-primary), 0.04);
  color: rgb(var(--v-theme-primary));
}
.studies-sidebar__item.is-active {
  background: rgba(var(--v-theme-primary), 0.08);
  color: rgb(var(--v-theme-primary));
  font-weight: 600;
}
</style>
