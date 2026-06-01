<script setup lang="ts">
import { cn } from '@/lib/utils'
import type { KernelStatus } from '@/kernels/types'

withDefaults(defineProps<{ status: KernelStatus; kernelName?: string; class?: string }>(), {})

const statusColors: Record<KernelStatus, string> = {
  disconnected: 'bg-muted',
  connecting: 'bg-warning animate-pulse',
  idle: 'bg-success',
  busy: 'bg-warning animate-pulse',
  error: 'bg-destructive',
}

const statusLabels: Record<KernelStatus, string> = {
  disconnected: 'Disconnected',
  connecting: 'Connecting...',
  idle: 'Ready',
  busy: 'Running...',
  error: 'Error',
}
</script>

<template>
  <div :class="cn('flex items-center gap-2 text-sm', $props.class)">
    <div :class="cn('h-2 w-2 rounded-full', statusColors[status])" />
    <span class="text-muted-foreground">
      <span v-if="kernelName" class="font-medium">{{ kernelName }}</span>
      <template v-if="kernelName"> - </template>
      <span>{{ statusLabels[status] }}</span>
    </span>
  </div>
</template>
