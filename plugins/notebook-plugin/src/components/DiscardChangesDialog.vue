<template>
  <AtlasDialog
    :model-value="props.open"
    eyebrow="UNSAVED"
    title="Discard unsaved changes?"
    :max-width="440"
    @close="emit('cancel')"
  >
    {{ message }}
    <template #actions>
      <AtlasButton variant="ghost" @click="emit('cancel')">Cancel</AtlasButton>
      <AtlasButton tone="danger" @click="emit('confirm')">Discard changes</AtlasButton>
    </template>
  </AtlasDialog>
</template>

<script setup lang="ts">
// Guards the three paths that can silently discard unsaved edits: switching
// notebooks in the header picker, leaving via the Studies back link, and
// reloading after a remote sync. Same shape as DeleteNotebookDialog — a
// confirmation dialog with no fields. The body copy differs by path (a sync
// has already overwritten the row server-side, so cancelling there does not
// undo it — it only declines to reload), so the caller passes it in as a prop
// rather than this component growing a second, near-identical sibling.
import { AtlasDialog, AtlasButton } from '@ohdsi/atlas-ui'

const props = withDefaults(
  defineProps<{ open: boolean; message?: string }>(),
  { message: 'This notebook has unsaved changes that will be lost.' },
)
const emit = defineEmits<{ (e: 'confirm'): void; (e: 'cancel'): void }>()
</script>
