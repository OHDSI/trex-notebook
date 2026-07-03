<template>
  <div class="studies-layout">
    <div class="studies-page-shell">
      <StudiesSidebar />
      <main class="studies-detail">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import StudiesSidebar from './StudiesSidebar.vue';
</script>

<style scoped>
.studies-layout {
  height: calc(100vh - 60px);
  padding: 24px;
  background: rgb(var(--v-theme-background));
  overflow: hidden;
}
.studies-page-shell {
  display: flex;
  background: rgb(var(--v-theme-surface));
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, .08), 0 8px 24px rgba(15, 23, 42, .04);
  height: 100%;
  overflow: hidden;
}
/* The detail fills the remaining width; individual sections own their padding
   (the Overview list pads itself; the embedded plugins fill edge-to-edge). */
.studies-detail {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>
