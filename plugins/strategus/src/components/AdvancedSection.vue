<template>
  <div class="advanced-section">
    <AtlasButton
      variant="ghost"
      size="sm"
      class="text-none"
      @click="open = !open"
    >
      <AtlasIcon
        :icon="open ? 'mdi-chevron-down' : 'mdi-chevron-right'"
        size="18"
      />
      Advanced
    </AtlasButton>
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
import { AtlasButton, AtlasIcon } from '@ohdsi/atlas-ui';
const open = ref(false);
</script>
<style scoped>
.advanced-section__body {
  margin-top: 6px;
  padding-bottom: 4px;
}
</style>
