<script setup lang="ts">
import { computed } from 'vue'
import { Plus, Code, FileText, Play, Square, Undo2, Redo2, ChevronDown } from 'lucide-vue-next'
import Button from '@/components/ui/Button.vue'
import DropdownMenu from '@/components/ui/DropdownMenu.vue'
import DropdownMenuTrigger from '@/components/ui/DropdownMenuTrigger.vue'
import DropdownMenuContent from '@/components/ui/DropdownMenuContent.vue'
import DropdownMenuItem from '@/components/ui/DropdownMenuItem.vue'
import Separator from '@/components/ui/Separator.vue'
import { cn } from '@/lib/utils'
import type { KernelStatus } from '@/kernels/types'
import type { CellLanguage } from '@/types/notebook'
import type { KernelInfo } from '@/hooks/useKernel'

export type { KernelInfo }

const props = withDefaults(
  defineProps<{
    kernelStatus: KernelStatus
    isExecuting: boolean
    canUndo: boolean
    canRedo: boolean
    activeKernelId?: string
    availableKernels?: KernelInfo[]
    showKernelSelector?: boolean
    kernelStatuses?: Map<string, KernelStatus>
    class?: string
  }>(),
  { availableKernels: () => [], showKernelSelector: true }
)

const emit = defineEmits<{
  addCodeCell: [language?: CellLanguage]
  addMarkdownCell: []
  runAllCells: []
  interruptExecution: []
  undo: []
  redo: []
  kernelChange: [kernelId: string]
}>()

const activeKernel = computed(() => props.availableKernels.find((k) => k.id === props.activeKernelId))
const hasPerKernelStatuses = computed(() => props.kernelStatuses && props.kernelStatuses.size > 0)

function statusLabel(status: KernelStatus): string {
  const labels: Record<KernelStatus, string> = {
    disconnected: 'Not connected',
    connecting: 'Starting…',
    idle: 'Ready',
    busy: 'Running…',
    error: 'Failed to start',
  }
  return labels[status] ?? status
}

function statusHint(status: KernelStatus): string | undefined {
  if (status === 'error') return 'The kernel could not start. Run a cell to try again.'
  if (status === 'disconnected') return 'The kernel starts when you run your first cell.'
  return undefined
}

function dotClass(st: KernelStatus): string {
  return cn(
    'h-2 w-2 shrink-0 rounded-full',
    st === 'idle' && 'bg-success',
    st === 'busy' && 'bg-warning animate-pulse',
    st === 'connecting' && 'bg-warning animate-pulse',
    st === 'error' && 'bg-destructive',
    st === 'disconnected' && 'bg-muted'
  )
}
</script>

<template>
  <div :class="cn('flex items-center gap-0.5 rounded-lg border bg-background p-0.5', props.class)">
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button variant="ghost" size="sm" class="h-7 gap-1 px-2 text-xs">
          <Plus class="h-3.5 w-3.5" />
          Add Cell
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem @click="emit('addCodeCell', 'python')">
          <Code class="mr-2 h-4 w-4" />
          Python Cell
        </DropdownMenuItem>
        <DropdownMenuItem @click="emit('addCodeCell', 'r')">
          <Code class="mr-2 h-4 w-4" />
          R Cell
        </DropdownMenuItem>
        <DropdownMenuItem @click="emit('addMarkdownCell')">
          <FileText class="mr-2 h-4 w-4" />
          Markdown Cell
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>

    <Separator orientation="vertical" class="mx-1 h-5" />

    <Button
      v-if="isExecuting"
      variant="ghost"
      size="sm"
      class="h-7 gap-1 px-2 text-xs text-destructive hover:text-destructive"
      @click="emit('interruptExecution')"
    >
      <Square class="h-3.5 w-3.5" />
      Stop
    </Button>
    <Button
      v-else
      variant="ghost"
      size="sm"
      class="h-7 gap-1 px-2 text-xs"
      :disabled="kernelStatus !== 'idle'"
      @click="emit('runAllCells')"
    >
      <Play class="h-3.5 w-3.5" />
      Run All
    </Button>

    <Separator orientation="vertical" class="mx-1 h-5" />

    <Button
      variant="ghost"
      size="icon"
      class="h-7 w-7"
      :disabled="!canUndo"
      title="Undo (Ctrl+Z)"
      @click="emit('undo')"
    >
      <Undo2 class="h-4 w-4" />
    </Button>
    <Button
      variant="ghost"
      size="icon"
      class="h-7 w-7"
      :disabled="!canRedo"
      title="Redo (Ctrl+Shift+Z)"
      @click="emit('redo')"
    >
      <Redo2 class="h-4 w-4" />
    </Button>

    <div class="ml-auto flex items-center gap-2 px-1 text-xs">
      <template v-if="showKernelSelector && availableKernels.length > 0">
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button
              variant="ghost"
              size="sm"
              class="h-7 gap-1 px-2 text-xs text-muted-foreground"
              :disabled="kernelStatus === 'busy' || isExecuting"
            >
              {{ activeKernel?.name || 'Select Kernel' }}
              <ChevronDown class="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              v-for="kernel in availableKernels"
              :key="kernel.id"
              :class="cn(kernel.id === activeKernelId && 'bg-accent')"
              @click="emit('kernelChange', kernel.id)"
            >
              <div class="flex flex-col">
                <span>{{ kernel.name }}</span>
                <span class="text-xs text-muted-foreground">{{ kernel.languages.join(', ') }}</span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Separator orientation="vertical" class="h-5" />
      </template>

      <template v-if="hasPerKernelStatuses">
        <template v-for="(k, i) in availableKernels" :key="k.id">
          <Separator v-if="i > 0" orientation="vertical" class="h-4" />
          <div class="flex items-center gap-1.5">
            <div :class="dotClass(kernelStatuses?.get(k.id) ?? 'disconnected')" />
            <span class="whitespace-nowrap text-muted-foreground">
              {{ k.languages.includes('r') ? 'R' : 'Python' }}
            </span>
          </div>
        </template>
      </template>
      <template v-else-if="availableKernels.length > 0">
        <div
          class="flex items-center gap-1.5 rounded-full border border-muted bg-muted/40 px-2 py-px"
          :title="statusHint(kernelStatus)"
        >
          <div :class="dotClass(kernelStatus)" />
          <span class="whitespace-nowrap text-muted-foreground">{{ statusLabel(kernelStatus) }}</span>
        </div>
      </template>
    </div>
  </div>
</template>
