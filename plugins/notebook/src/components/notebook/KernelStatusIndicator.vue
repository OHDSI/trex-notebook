<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'
import type { KernelStatus } from '@/kernels/types'

const props = withDefaults(defineProps<{ status: KernelStatus; kernelName?: string; class?: string }>(), {})

const statusColors: Record<KernelStatus, string> = {
  disconnected: 'bg-muted-foreground/40',
  connecting: 'bg-warning animate-pulse',
  idle: 'bg-success',
  busy: 'bg-warning animate-pulse',
  error: 'bg-destructive',
}

const statusLabels: Record<KernelStatus, string> = {
  disconnected: 'Not connected',
  connecting: 'Starting…',
  idle: 'Ready',
  busy: 'Running…',
  error: 'Failed to start',
}

const statusHints: Partial<Record<KernelStatus, string>> = {
  disconnected: 'The kernel starts when you run your first cell.',
  error: 'The kernel could not start. Run a cell to try again.',
}

const label = computed(() => statusLabels[props.status])
const hint = computed(() => statusHints[props.status])
</script>

<template>
  <div
    :class="cn(
      'inline-flex items-center gap-2 rounded-full border border-muted bg-muted/40 px-2.5 py-1 text-xs',
      $props.class,
    )"
    :title="hint"
  >
    <div :class="cn('h-2 w-2 rounded-full', statusColors[status])" />
    <span class="text-muted-foreground">
      <span v-if="kernelName" class="font-medium text-foreground">{{ kernelName }}</span>
      <template v-if="kernelName"> · </template>
      <span>{{ label }}</span>
    </span>
  </div>
</template>
