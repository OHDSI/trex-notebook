<script setup lang="ts">
import { MoreHorizontal, Play, Trash2, ChevronUp, ChevronDown, Copy } from 'lucide-vue-next'
import Button from '@/components/ui/Button.vue'
import DropdownMenu from '@/components/ui/DropdownMenu.vue'
import DropdownMenuTrigger from '@/components/ui/DropdownMenuTrigger.vue'
import DropdownMenuContent from '@/components/ui/DropdownMenuContent.vue'
import DropdownMenuItem from '@/components/ui/DropdownMenuItem.vue'
import DropdownMenuSeparator from '@/components/ui/DropdownMenuSeparator.vue'
import CodeCell from './CodeCell.vue'
import MarkdownCell from './MarkdownCell.vue'
import CellOutput from './CellOutput.vue'
import { cn } from '@/lib/utils'
import type { CellData, CellLanguage } from '@/types/notebook'
import { isCodeCell } from '@/types/notebook'

withDefaults(
  defineProps<{
    cell: CellData
    isSelected: boolean
    showLineNumbers?: boolean
    readOnly?: boolean
    kernelReady?: boolean
    canMoveUp?: boolean
    canMoveDown?: boolean
  }>(),
  { showLineNumbers: true, readOnly: false, kernelReady: true, canMoveUp: true, canMoveDown: true }
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
</script>

<template>
  <div :class="cn('group relative', isSelected && 'z-10')" @click="emit('select')">
    <!-- Cell type label -->
    <span
      class="absolute -top-2 right-2 z-20 rounded-md bg-background/95 px-2 py-0.5 text-xs font-medium text-primary shadow-sm ring-1 ring-border/50 select-none"
    >
      {{ isCodeCell(cell) ? (cell.language === 'r' ? 'R' : 'Python') : 'Markdown' }}
    </span>

    <!-- Action bar -->
    <div
      :class="cn(
        'absolute -top-2 right-2 z-30 flex items-center gap-1 rounded-md bg-background/95 p-1 shadow-sm ring-1 ring-border/50 opacity-0 transition-opacity',
        !isSelected && 'group-hover:opacity-100',
        isSelected && 'opacity-100',
      )"
    >
      <DropdownMenu v-if="isCodeCell(cell)">
        <DropdownMenuTrigger>
          <Button
            variant="ghost"
            size="sm"
            class="h-7 px-1.5 text-xs font-medium text-primary select-none"
            @click.stop
          >
            {{ cell.language === 'r' ? 'R' : 'Python' }}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem @click="emit('changeLanguage', 'python')">Python</DropdownMenuItem>
          <DropdownMenuItem @click="emit('changeLanguage', 'r')">R</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <span v-else class="px-1.5 text-xs font-medium text-primary select-none">Markdown</span>

      <Button
        v-if="isCodeCell(cell)"
        variant="ghost"
        size="icon"
        class="h-7 w-7"
        :disabled="readOnly || !kernelReady"
        title="Run cell (Shift+Enter)"
        @click.stop="emit('run')"
      >
        <Play class="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        class="h-7 w-7"
        :disabled="!canMoveUp || readOnly"
        title="Move up"
        @click.stop="emit('moveUp')"
      >
        <ChevronUp class="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        class="h-7 w-7"
        :disabled="!canMoveDown || readOnly"
        title="Move down"
        @click.stop="emit('moveDown')"
      >
        <ChevronDown class="h-4 w-4" />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger>
          <Button variant="ghost" size="icon" class="h-7 w-7" @click.stop>
            <MoreHorizontal class="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <template v-if="isCodeCell(cell)">
            <DropdownMenuItem @click="emit('run')">
              <Play class="mr-2 h-4 w-4" />
              Run cell
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </template>
          <DropdownMenuItem @click="emit('duplicate')">
            <Copy class="mr-2 h-4 w-4" />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem class="text-destructive focus:text-destructive" @click="emit('delete')">
            <Trash2 class="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    <div class="py-2">
      <template v-if="isCodeCell(cell)">
        <CodeCell
          :source="cell.source"
          :language="cell.language"
          :execution-count="cell.executionCount"
          :execution-state="cell.executionState"
          :is-selected="isSelected"
          :read-only="readOnly"
          :show-line-numbers="showLineNumbers"
          @change="emit('updateSource', $event)"
          @focus="emit('select')"
        />
        <CellOutput v-if="cell.outputs.length > 0" :outputs="cell.outputs" />
      </template>
      <MarkdownCell
        v-else
        :source="cell.source"
        :is-selected="isSelected"
        :read-only="readOnly"
        :show-line-numbers="showLineNumbers"
        @change="emit('updateSource', $event)"
        @focus="emit('select')"
      />
    </div>
  </div>
</template>
