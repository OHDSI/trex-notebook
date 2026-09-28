<template>
  <AtlasDialog
    :model-value="props.open"
    eyebrow="NEW"
    title="Create notebook"
    :max-width="440"
    @close="emit('cancel')"
  >
    <AtlasTextField v-model="name" label="Notebook Title" placeholder="Enter a title" autofocus />
    <div v-if="duplicate" class="notebook-dialog__error">
      A notebook with this name already exists.
    </div>

    <AtlasSelect
      v-model="selectedTemplateId"
      class="notebook-dialog__template"
      label="Template"
      :items="templateItems"
      item-title="title"
      item-value="value"
      :disabled="loadingTemplates"
    />

    <template #actions>
      <AtlasButton variant="ghost" @click="emit('cancel')">Cancel</AtlasButton>
      <AtlasButton variant="primary" :disabled="!trimmed" @click="confirm">Create</AtlasButton>
    </template>
  </AtlasDialog>
</template>

<script setup lang="ts">
// Port of the React CreateNotebookDialog + TemplateSelect
// (plugins/ui/apps/webr-notebook/src/components/{CreateNotebookDialog,TemplateSelect}.tsx).
import { ref, computed, watch, nextTick } from 'vue'
import { AtlasDialog, AtlasButton, AtlasSelect, AtlasTextField } from '@ohdsi/atlas-ui'
import { getTemplates } from '../api/notebookGit'
import type { NotebookTemplateDto } from '../api/types'

const NO_TEMPLATE_LABEL = '— No template (blank notebook) —'

const props = defineProps<{ open: boolean; existingNames: string[] }>()
const emit = defineEmits<{
  (e: 'confirm', name: string, templateId: string | null): void
  (e: 'cancel'): void
}>()

const name = ref('Untitled')
const duplicate = ref(false)
const trimmed = computed(() => name.value.trim())

const templates = ref<NotebookTemplateDto[]>([])
const selectedTemplateId = ref('')
const loadingTemplates = ref(false)

const templateItems = computed(() => [
  { title: NO_TEMPLATE_LABEL, value: '' },
  ...templates.value.map((t) => ({ title: t.name, value: t.id })),
])

async function loadTemplates(): Promise<void> {
  loadingTemplates.value = true
  try {
    templates.value = await getTemplates()
  } catch (err) {
    // Silent fail — a missing/misconfigured templates repo must never block
    // notebook creation, and must never surface an error that Atlas's
    // login-guard could mistake for an auth failure.
    console.error('Failed to load notebook templates:', err)
    templates.value = []
  } finally {
    loadingTemplates.value = false
  }
}

// Mirrors React's inputRef.current.select() — AtlasTextField forwards `label`
// onto the underlying <input>'s aria-label (see the component's own test
// stub), which is a stable enough hook without needing the real package's
// exposed instance shape.
function focusAndSelectName(): void {
  const input = document.querySelector<HTMLInputElement>('input[aria-label="Notebook Title"]')
  input?.select()
}

// Reset each time the dialog opens so a cancelled attempt does not linger.
watch(
  () => props.open,
  (open) => {
    if (open) {
      name.value = 'Untitled'
      duplicate.value = false
      selectedTemplateId.value = ''
      void loadTemplates()
      void nextTick(focusAndSelectName)
    }
  },
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
  emit('confirm', value, selectedTemplateId.value || null)
}

// The confirm event carries only the chosen id (see emits above); the parent
// reads the matching template's content/description from here instead of
// fetching the template repo a second time.
defineExpose({ templates })
</script>

<style scoped>
.notebook-dialog__error {
  margin-top: 8px;
  font-size: 12px;
  color: rgb(var(--v-theme-error, 211, 47, 47));
}
.notebook-dialog__template {
  margin-top: 16px;
}
</style>
