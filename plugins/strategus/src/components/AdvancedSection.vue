<template>
  <div class="advanced-section">
    <v-btn
      variant="text"
      color="primary"
      size="small"
      class="text-none"
      @click="open = !open"
    >
      <v-icon
        :icon="open ? 'mdi-chevron-down' : 'mdi-chevron-right'"
        size="18"
      />
      Advanced
    </v-btn>
    <v-expand-transition>
      <div
        v-show="open"
        class="advanced-section__body"
      >
        <slot />
      </div>
    </v-expand-transition>
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue';
const open = ref(false);
</script>
<style scoped>
.advanced-section__body {
  margin-top: 6px;
  padding-bottom: 4px;
}
</style>
