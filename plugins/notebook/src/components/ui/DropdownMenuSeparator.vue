<script setup lang="ts">
import { DropdownMenuSeparator as RekaSep } from 'reka-ui'
import { cn } from '@/lib/utils'

withDefaults(defineProps<{ class?: string }>(), {})
</script>

<template>
  <RekaSep :class="cn('-mx-1 my-1 h-px bg-border', $props.class)" />
</template>
