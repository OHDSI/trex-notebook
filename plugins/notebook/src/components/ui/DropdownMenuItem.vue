<script setup lang="ts">
import { DropdownMenuItem as RekaItem } from 'reka-ui'
import { cn } from '@/lib/utils'

withDefaults(defineProps<{ class?: string }>(), {})
</script>

<template>
  <RekaItem
    :class="cn(
      'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[highlighted]:bg-accent',
      $props.class,
    )"
  >
    <slot />
  </RekaItem>
</template>
