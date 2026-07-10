<script setup lang="ts">
import { ref, computed } from 'vue'
import { markdown } from '@codemirror/lang-markdown'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { githubLight } from '@uiw/codemirror-theme-github'
import CodeMirrorEditor from '@/components/ui/CodeMirrorEditor.vue'
import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<{
    source: string
    isSelected: boolean
    readOnly?: boolean
    showLineNumbers?: boolean
  }>(),
  { readOnly: false, showLineNumbers: false }
)

const emit = defineEmits<{ change: [value: string]; focus: [] }>()

const isEditing = ref(false)

const renderedHtml = computed(() => {
  if (!props.source.trim()) {
    return '<p class="text-muted-foreground italic">Click to add markdown content...</p>'
  }
  try {
    const rawHtml = marked.parse(props.source, { async: false }) as string
    return DOMPurify.sanitize(rawHtml)
  } catch {
    return `<pre>${props.source}</pre>`
  }
})

const extensions = [markdown()]

const showEditMode = computed(() => isEditing.value && props.isSelected)

function handleDoubleClick() {
  if (!props.readOnly) isEditing.value = true
}
function handleBlur() {
  isEditing.value = false
}
</script>

<template>
  <div
    v-if="showEditMode"
    :class="cn(
      'group relative border-l-2 transition-colors',
      isSelected ? 'border-primary' : 'border-transparent',
    )"
  >
    <div class="ml-16">
      <CodeMirrorEditor
        :model-value="source"
        :extensions="extensions"
        :theme="githubLight"
        :editable="true"
        :show-line-numbers="showLineNumbers"
        :fold-gutter="false"
        :autocomplete="false"
        :tab-size="2"
        :auto-focus="true"
        :class="cn(
          'overflow-hidden rounded-md border bg-background text-sm',
          isSelected && 'ring-1 ring-ring',
        )"
        @update:model-value="emit('change', $event)"
        @focus="emit('focus')"
        @blur="handleBlur"
      />
    </div>
  </div>

  <div
    v-else
    :class="cn(
      'group relative border-l-2 transition-colors',
      isSelected ? 'border-primary' : 'border-transparent',
    )"
    @dblclick="handleDoubleClick"
    @click="emit('focus')"
  >
    <div
      :class="cn(
        'ml-16 min-h-[40px] rounded-md px-4 py-2 cursor-text',
        isSelected && 'bg-accent/30 ring-1 ring-ring',
      )"
    >
      <div
        class="prose prose-sm max-w-none dark:prose-invert text-[13px] leading-relaxed prose-headings:my-2 prose-headings:font-semibold prose-h1:text-base prose-h2:text-sm prose-h3:text-[13px] prose-p:my-2 prose-pre:my-2 prose-ul:my-2 prose-ol:my-2 prose-code:text-[12px]"
        v-html="renderedHtml"
      />
    </div>
  </div>
</template>
