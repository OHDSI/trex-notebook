<template>
  <div class="notebook-header">
    <div class="notebook-header__title">
      <AtlasSelect
        class="notebook-header__picker"
        :model-value="props.activeId"
        :items="pickerItems"
        item-title="title"
        item-value="value"
        @update:model-value="(v) => emit('select', v as string)"
      />
      <AtlasIconButton
        v-if="props.activeId"
        icon="mdi-pencil"
        ariaLabel="Rename"
        size="sm"
        @click="emit('rename')"
      />
      <AtlasChip v-if="props.dirty" tone="warning" size="sm">Unsaved</AtlasChip>
    </div>

    <div class="notebook-header__actions">
      <AtlasButton variant="secondary" :disabled="!props.activeId" @click="emit('export')">Export</AtlasButton>
      <AtlasButton variant="secondary" @click="emit('import')">Import</AtlasButton>
      <AtlasButton variant="secondary" @click="emit('create')">New</AtlasButton>
      <AtlasButton
        variant="secondary"
        :disabled="!props.activeId || !props.canSave"
        @click="emit('save')"
      >Save</AtlasButton>
      <AtlasButton tone="danger" variant="secondary" :disabled="!props.activeId" @click="emit('delete')">Delete</AtlasButton>
      <SyncFromRemoteButton
        :notebook-id="props.activeId"
        @synced="emit('synced')"
        @feedback="(t, m) => emit('feedback', t, m)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
// Port of the React NotebookHeader: the notebook picker and rename affordance
// on the left, every notebook action on the right. The picker is deliberately
// kept — it is central to the React look and lets a user switch notebooks
// without returning to the Studies overview, which remains the entry point.
//
// No "Shared" control: notebook.document has no is_shared column and the
// schema grants authenticated unscoped CRUD with no RLS, so a toggle would be
// decoration over a permission model that does not exist (see the spec).
import { computed } from 'vue'
import { AtlasSelect, AtlasButton, AtlasIconButton, AtlasChip } from '@ohdsi/atlas-ui'
import SyncFromRemoteButton from './SyncFromRemoteButton.vue'
import type { NotebookSummary } from '../api/types'

const props = defineProps<{
  notebooks: NotebookSummary[]
  activeId: string | null
  canSave: boolean
  dirty?: boolean
}>()

const emit = defineEmits<{
  (e: 'select', id: string): void
  (e: 'create'): void
  (e: 'save'): void
  (e: 'rename'): void
  (e: 'delete'): void
  (e: 'import'): void
  (e: 'export'): void
  (e: 'synced'): void
  (e: 'feedback', type: 'success' | 'error' | 'warning', message: string): void
}>()

const pickerItems = computed(() =>
  props.notebooks.map((n) => ({ title: n.name, value: n.rowId })),
)
</script>

<style scoped>
.notebook-header {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 0 14px;
  margin-bottom: 16px;
  border-bottom: 1px solid rgb(var(--v-theme-outline-variant, 221, 227, 237));
}
.notebook-header__title {
  display: flex;
  align-items: center;
  gap: 4px;
}
.notebook-header__picker {
  min-width: 240px;
}
.notebook-header__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

/* Neutralise Vuetify's default uppercase v-btn styling so these read like
   React's `.notebook-header__btn` — outlined, Title Case, normal weight. */
.notebook-header__actions :deep(.v-btn) {
  text-transform: none;
  font-weight: 500;
  font-size: 0.875rem;
  border-radius: 6px;
}
.notebook-header__actions :deep(.v-btn--disabled) {
  opacity: 0.4;
}

/* Borderless, underlined trigger sized to the notebook name, matching
   React's NotebookSelect — no floating label, no outlined box. */
.notebook-header__picker {
  min-width: 0;
  max-width: 320px;
  flex: 0 0 auto;
}
.notebook-header__picker :deep(.v-field) {
  --v-field-padding-start: 2px;
  --v-field-padding-end: 20px;
  background: transparent;
  box-shadow: none;
}
.notebook-header__picker :deep(.v-field__outline) {
  display: none;
}
.notebook-header__picker :deep(.v-field__overlay) {
  background: transparent;
}
.notebook-header__picker :deep(.v-input__details) {
  display: none;
}
.notebook-header__picker :deep(.v-field__field) {
  border-bottom: 2px solid rgb(var(--v-theme-primary));
  padding-top: 6px;
  padding-bottom: 6px;
}
.notebook-header__picker :deep(.v-field-label) {
  display: none;
}
.notebook-header__picker :deep(.v-select__selection-text) {
  font-size: 0.9375rem;
  font-weight: 500;
  color: rgb(var(--v-theme-primary));
}
</style>
