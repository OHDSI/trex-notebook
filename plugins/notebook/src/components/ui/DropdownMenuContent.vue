<script setup lang="ts">
import { DropdownMenuPortal, DropdownMenuContent as RekaContent } from 'reka-ui'
import { cn } from '@/lib/utils'

withDefaults(defineProps<{ align?: 'start' | 'center' | 'end'; class?: string }>(), {
  align: 'start',
})
</script>

<template>
  <DropdownMenuPortal>
    <RekaContent
      :align="align"
      :side-offset="4"
      :class="cn(
        'z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
        $props.class,
      )"
    >
      <slot />
    </RekaContent>
  </DropdownMenuPortal>
</template>
