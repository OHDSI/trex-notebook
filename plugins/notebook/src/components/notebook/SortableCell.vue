<script setup lang="ts">
import { computed } from 'vue'
import { GripVertical } from 'lucide-vue-next'
import Cell from './Cell.vue'
import { cn } from '@/lib/utils'
import type { CellData, CellLanguage } from '@/types/notebook'

const props = withDefaults(
  defineProps<{
    cell: CellData
    isSelected: boolean
    showLineNumbers?: boolean
    readOnly?: boolean
    kernelReady?: boolean
    canMoveUp?: boolean
    canMoveDown?: boolean
    useVirtualization?: boolean
  }>(),
  {
    showLineNumbers: true,
    readOnly: false,
    kernelReady: true,
    canMoveUp: true,
    canMoveDown: true,
    useVirtualization: false,
  }
)

const emit = defineEmits<{
  select: []
  updateSource: [source: string]
  run: []
  delete: []
  moveUp: []
  moveDown: []
  duplicate: []
  changeLanguage: [language: CellLanguage]
}>()

const rootStyle = computed(() =>
  props.useVirtualization
    ? { contentVisibility: 'auto' as const, containIntrinsicSize: 'auto 150px' }
    : {}
)
</script>

<template>
  <div class="relative group" :style="rootStyle">
    <div
      :class="cn(
        'cell-drag-handle absolute left-0 top-1/2 -translate-y-1/2 z-30 p-1 cursor-grab active:cursor-grabbing',
        'opacity-0 group-hover:opacity-100 transition-opacity',
        'hover:bg-accent rounded',
        isSelected && 'opacity-100',
      )"
      title="Drag to reorder"
    >
      <GripVertical class="h-4 w-4 text-muted-foreground" />
    </div>
    <Cell
      :cell="cell"
      :is-selected="isSelected"
      :show-line-numbers="showLineNumbers"
      :read-only="readOnly"
      :kernel-ready="kernelReady"
      :can-move-up="canMoveUp"
      :can-move-down="canMoveDown"
      @select="emit('select')"
      @update-source="emit('updateSource', $event)"
      @run="emit('run')"
      @delete="emit('delete')"
      @move-up="emit('moveUp')"
      @move-down="emit('moveDown')"
      @duplicate="emit('duplicate')"
      @change-language="emit('changeLanguage', $event)"
    />
  </div>
</template>
