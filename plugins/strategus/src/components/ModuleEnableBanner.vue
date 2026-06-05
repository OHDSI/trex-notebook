<template>
  <AtlasAlert
    severity="info"
    variant="tonal"
    class="mb-4"
  >
    <div class="d-flex align-center justify-space-between">
      <span>This module is currently disabled and won't be included in the exported JSON.</span>
      <AtlasButton
        size="sm"
        variant="primary"
        prepend-icon="mdi-toggle-switch-outline"
        class="ml-4"
        @click="$emit('enable')"
      >
        Enable Module
      </AtlasButton>
    </div>
  </AtlasAlert>
</template>
<script setup lang="ts">
import { AtlasAlert, AtlasButton } from '@ohdsi/atlas-ui';
defineEmits<{ enable: [] }>();
</script>
