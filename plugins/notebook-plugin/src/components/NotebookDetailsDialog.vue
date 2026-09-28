<template>
  <AtlasDialog
    :model-value="props.open"
    eyebrow="EDIT"
    title="Edit Notebook Details"
    :max-width="440"
    @close="emit('cancel')"
  >
    <AtlasTextField v-model="name" label="Notebook Title" placeholder="Enter a title" autofocus />
    <AtlasTextField v-model="description" label="Description" placeholder="Optional summary" />
    <div v-if="duplicate" class="notebook-dialog__error">
      A notebook with this name already exists.
    </div>
    <template #actions>
      <AtlasButton variant="ghost" @click="emit('cancel')">Cancel</AtlasButton>
      <AtlasButton variant="primary" :disabled="!trimmed" @click="confirm">Save</AtlasButton>
    </template>
  </AtlasDialog>
</template>

<script setup lang="ts">
// The rename path. Carries `description` as well as `name`: the rebuilt editor
// drops the old meta row, and description is a real column the Studies list
// shows, so this dialog is where it lives now. `existingNames` must exclude the
// notebook being edited, so keeping its own name is always allowed.
import { ref, computed, watch } from 'vue'
import { AtlasDialog, AtlasButton, AtlasTextField } from '@ohdsi/atlas-ui'

const props = defineProps<{
  open: boolean
  name: string
  description: string
  existingNames: string[]
}>()
const emit = defineEmits<{
  (e: 'confirm', payload: { name: string; description: string }): void
  (e: 'cancel'): void
}>()

const name = ref(props.name)
const description = ref(props.description)
const duplicate = ref(false)
const trimmed = computed(() => name.value.trim())

watch(
  () => props.open,
  (open) => {
    if (open) {
      name.value = props.name
      description.value = props.description
      duplicate.value = false
    }
  },
  { immediate: true },
)

watch(name, () => {
  duplicate.value = false
})

function confirm(): void {
  const value = trimmed.value
  if (!value) return
  if (props.existingNames.some((n) => n.toUpperCase() === value.toUpperCase())) {
    duplicate.value = true
    return
  }
  emit('confirm', { name: value, description: description.value.trim() })
}
</script>

<style scoped>
.notebook-dialog__error {
  margin-top: 8px;
  font-size: 12px;
  color: rgb(var(--v-theme-error, 211, 47, 47));
}
</style>
