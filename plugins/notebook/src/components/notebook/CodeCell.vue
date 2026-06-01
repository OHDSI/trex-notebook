<script setup lang="ts">
import { computed } from 'vue'
import { python } from '@codemirror/lang-python'
import { StreamLanguage } from '@codemirror/language'
import { r } from '@codemirror/legacy-modes/mode/r'
import { githubLight } from '@uiw/codemirror-theme-github'
import CodeMirrorEditor from '@/components/ui/CodeMirrorEditor.vue'
import { cn } from '@/lib/utils'
import type { CellLanguage, ExecutionState } from '@/types/notebook'

const props = withDefaults(
  defineProps<{
    source: string
    language: CellLanguage
    executionCount: number | null
    executionState: ExecutionState
    isSelected: boolean
    readOnly?: boolean
    showLineNumbers?: boolean
  }>(),
  { readOnly: false, showLineNumbers: true }
)

const emit = defineEmits<{ change: [value: string]; focus: [] }>()

const rLanguage = StreamLanguage.define(r)

const extensions = computed(() => [props.language === 'python' ? python() : rLanguage])

const executionLabel = computed(() => {
  if (props.executionCount !== null) return `[${props.executionCount}]`
  if (props.executionState === 'running') return '[*]'
  return '[ ]'
})
</script>

<template>
  <div
    :class="cn(
      'group relative flex border-l-2 transition-colors',
      isSelected ? 'border-primary' : 'border-transparent',
      executionState === 'running' && 'bg-accent/30',
    )"
  >
    <div
      class="flex w-16 shrink-0 items-start justify-end pr-2 pt-2 font-mono text-xs text-muted-foreground"
    >
      {{ executionLabel }}
    </div>

    <div class="min-w-0 flex-1 overflow-hidden">
      <CodeMirrorEditor
        :model-value="source"
        :extensions="extensions"
        :theme="githubLight"
        :editable="!readOnly"
        :show-line-numbers="showLineNumbers"
        :fold-gutter="true"
        :autocomplete="true"
        :tab-size="4"
        :class="cn(
          'overflow-hidden rounded-md border bg-background text-sm',
          isSelected && 'ring-1 ring-ring',
        )"
        @update:model-value="emit('change', $event)"
        @focus="emit('focus')"
      />
    </div>

    <div v-if="executionState === 'running'" class="absolute right-2 top-2">
      <div class="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  </div>
</template>
