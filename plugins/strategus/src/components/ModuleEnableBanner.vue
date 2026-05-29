<template>
  <v-alert
    type="info"
    variant="tonal"
    density="compact"
    class="mb-4"
    border="start"
  >
    <div class="d-flex align-center justify-space-between">
      <span>This module is currently disabled and won't be included in the exported JSON.</span>
      <v-btn
        size="small"
        color="primary"
        variant="flat"
        class="text-none ml-4"
        @click="$emit('enable')"
      >
        <v-icon
          icon="mdi-toggle-switch-outline"
          start
        /> Enable Module
      </v-btn>
    </div>
  </v-alert>
</template>
<script setup lang="ts">
defineEmits<{ enable: [] }>();
</script>
