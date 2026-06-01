<script lang="ts">
import { defineComponent, h, ref as vref, computed as vcomputed } from 'vue'
import { cn as cx } from '@/lib/utils'

const MAX = 500 * 1024
const PREVIEW = 10 * 1024

export const TruncatableText = defineComponent({
  name: 'TruncatableText',
  props: { text: { type: String, required: true }, class: { type: String, default: '' } },
  setup(props) {
    const expanded = vref(false)
    const truncated = vcomputed(() => props.text.length > MAX)
    const display = vcomputed(() =>
      !truncated.value || expanded.value ? props.text : props.text.slice(0, PREVIEW) + '\n...'
    )
    return () =>
      h('div', [
        h('pre', { class: cx('whitespace-pre-wrap font-mono text-sm', props.class) }, display.value),
        truncated.value
          ? h(
              'button',
              {
                class: 'mt-1 text-sm text-muted-foreground underline',
                onClick: () => (expanded.value = !expanded.value),
              },
              expanded.value
                ? 'Show less'
                : `Show more (${(props.text.length / 1024).toFixed(1)} KB)`
            )
          : null,
      ])
  },
})
</script>

<script setup lang="ts">
import { cn } from '@/lib/utils'
import type { CellOutput as CellOutputType, MimeBundle } from '@/types/notebook'

const props = withDefaults(defineProps<{ outputs: CellOutputType[]; class?: string }>(), {})

const MIME_PRIORITY = [
  'text/html',
  'image/svg+xml',
  'image/png',
  'image/jpeg',
  'text/markdown',
  'text/plain',
]

function getBestMimeType(data: MimeBundle): string {
  for (const mimeType of MIME_PRIORITY) {
    if (data[mimeType] !== undefined) return mimeType
  }
  return 'text/plain'
}

function imageSrc(mimeType: string, content: unknown): string {
  const s = String(content)
  return s.startsWith('data:') ? s : `data:${mimeType};base64,${s}`
}
</script>

<template>
  <div v-if="outputs.length > 0" :class="cn('ml-16 pl-4 py-2', props.class)">
    <div v-for="(output, index) in outputs" :key="index" class="mb-2 last:mb-0">
      <!-- stream -->
      <TruncatableText
        v-if="output.type === 'stream'"
        :text="output.text"
        :class="output.name === 'stderr' ? 'text-destructive' : ''"
      />

      <!-- error -->
      <div v-else-if="output.type === 'error'" class="font-mono text-sm text-destructive">
        <div class="font-bold">{{ output.ename }}: {{ output.evalue }}</div>
        <pre
          v-if="output.traceback.length > 0"
          class="mt-2 whitespace-pre-wrap text-xs opacity-80"
          >{{ output.traceback.join('\n') }}</pre
        >
      </div>

      <!-- execute_result / display_data (MIME) -->
      <template v-else-if="output.type === 'execute_result' || output.type === 'display_data'">
        <template v-for="mime in [getBestMimeType(output.data)]" :key="mime">
          <template v-if="output.data[mime] !== undefined && output.data[mime] !== null">
            <div
              v-if="mime === 'text/html'"
              class="prose prose-sm max-w-none dark:prose-invert"
              v-html="String(output.data[mime])"
            />
            <img
              v-else-if="mime === 'image/png' || mime === 'image/jpeg'"
              :src="imageSrc(mime, output.data[mime])"
              alt="Output"
              class="max-w-full"
            />
            <div
              v-else-if="mime === 'image/svg+xml'"
              class="max-w-full"
              v-html="String(output.data[mime])"
            />
            <TruncatableText v-else :text="String(output.data[mime])" />
          </template>
        </template>
      </template>
    </div>
  </div>
</template>
