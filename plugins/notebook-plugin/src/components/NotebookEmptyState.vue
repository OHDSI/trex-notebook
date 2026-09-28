<template>
  <div class="notebook-empty">
    <div class="notebook-empty__icon">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="48" height="48">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="12" y1="18" x2="12" y2="12" />
        <line x1="9" y1="15" x2="15" y2="15" />
      </svg>
    </div>
    <p class="notebook-empty__title">
      {{ props.hasNotebooks ? 'Select a notebook to get started' : 'No notebooks yet' }}
    </p>
    <p class="notebook-empty__subtitle">
      {{ props.hasNotebooks
        ? 'Choose one from the dropdown above or create a new one'
        : 'Create your first notebook to start writing code and analysis' }}
    </p>
    <div class="notebook-empty__actions">
      <AtlasButton variant="primary" @click="emit('create')">Create Notebook</AtlasButton>
      <AtlasButton variant="secondary" @click="emit('import')">Import .ipynb</AtlasButton>
    </div>
  </div>
</template>

<script setup lang="ts">
// Port of the React EmptyState — dashed card, two lines of copy that differ by
// whether any notebooks exist, and the two entry actions.
import { AtlasButton } from '@ohdsi/atlas-ui'

const props = defineProps<{ hasNotebooks: boolean }>()
const emit = defineEmits<{ (e: 'create'): void; (e: 'import'): void }>()
</script>

<style scoped>
.notebook-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  width: 100%;
  max-width: 640px;
  padding: 80px 64px;
  text-align: center;
  /* #c8d4e8 is a neutral grey with no Atlas token equivalent, taken verbatim
     from the React EmptyState.scss dashed border. */
  border: 2px dashed #c8d4e8;
  border-radius: 16px;
  background: rgb(var(--v-theme-surface));
}
.notebook-empty__icon {
  display: flex;
  color: rgb(var(--v-theme-primary));
  opacity: 0.35;
}
.notebook-empty__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: rgb(var(--v-theme-primary));
}
.notebook-empty__subtitle {
  margin: 0;
  max-width: 400px;
  font-size: 0.9375rem;
  line-height: 1.6;
  /* #6b7280 is a neutral grey with no Atlas token equivalent, taken verbatim
     from the React EmptyState.scss subtitle color. */
  color: #6b7280;
}
.notebook-empty__actions {
  display: flex;
  gap: 12px;
  margin-top: 12px;
}

/* Pill-shaped, normal-case buttons matching React's EmptyState.scss, which
   are plain <button> elements there rather than a component library's. */
.notebook-empty__actions :deep(.v-btn) {
  height: auto;
  padding: 11px 32px;
  border-radius: 50px;
  font-weight: 600;
  font-size: 0.9375rem;
  text-transform: none;
}
</style>
