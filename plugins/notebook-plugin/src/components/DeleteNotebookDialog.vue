<template>
  <AtlasDialog
    :model-value="props.open"
    eyebrow="DELETE"
    title="Delete notebook"
    :max-width="440"
    @close="emit('cancel')"
  >
    Delete <strong>{{ props.notebookName }}</strong>? This cannot be undone.
    <template #actions>
      <AtlasButton variant="ghost" @click="emit('cancel')">Cancel</AtlasButton>
      <AtlasButton tone="danger" @click="emit('confirm')">Delete</AtlasButton>
    </template>
  </AtlasDialog>
</template>

<script setup lang="ts">
// Lifted from the inline delete dialog in NotebookListView.vue, unchanged in
// behaviour — the row is soft-deleted (deleted_at), then mirrored so the git
// repo drops the file.
import { AtlasDialog, AtlasButton } from '@ohdsi/atlas-ui'

const props = defineProps<{ open: boolean; notebookName: string }>()
const emit = defineEmits<{ (e: 'confirm'): void; (e: 'cancel'): void }>()
</script>
