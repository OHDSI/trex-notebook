<template>
  <!-- Combined editor page: study design and modules in one scrollable panel.
       The left sidebar's items/anchors scroll to sections within this page. -->
  <div class="design-panel">
    <StudyPanel />
    <div id="sec-modules" class="design-panel__modules">
      <ModulesPanel />
    </div>
  </div>
</template>

<script setup lang="ts">
import StudyPanel from './StudyPanel.vue';
import ModulesPanel from './ModulesPanel.vue';
</script>

<style scoped>
.design-panel__modules {
  margin-top: 24px;
  padding-top: 8px;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  scroll-margin-top: 16px;
}
</style>
