<script setup lang="ts">
import { DropdownMenuTrigger as RekaTrigger } from 'reka-ui'

withDefaults(defineProps<{ asChild?: boolean }>(), { asChild: true })
</script>

<template>
  <RekaTrigger :as-child="asChild">
    <slot />
  </RekaTrigger>
</template>
