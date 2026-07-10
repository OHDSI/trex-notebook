<template>
  <div class="section-hero">
    <div class="section-hero__eyebrow-row">
      <span class="section-hero__eyebrow">{{ eyebrow }}</span>
      <span class="section-hero__accent" />
    </div>
    <div class="section-hero__head">
      <div>
        <h1 class="section-hero__title">{{ title }}</h1>
        <p v-if="subtitle" class="section-hero__subtitle">{{ subtitle }}</p>
      </div>
      <div class="section-hero__actions"><slot name="actions" /></div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ eyebrow: string; title: string; subtitle?: string }>();
</script>

<style scoped>
/* Flat rendition of the AtlasPageShell hero header (same metrics as
   atlas-ui's page-header) — no surface of its own, so it can sit inside the
   notebook shell card without nesting boxes. Mirrors the Studies SectionHero. */
.section-hero {
  margin-bottom: 20px;
}
.section-hero__eyebrow-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.section-hero__eyebrow {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgb(var(--v-theme-primary));
}
.section-hero__accent {
  display: inline-block;
  width: 28px;
  height: 2px;
  background: rgb(var(--v-theme-orange, 235, 102, 34));
  border-radius: 2px;
}
.section-hero__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.section-hero__title {
  font-size: 26px;
  font-weight: 300;
  line-height: 1.2;
  letter-spacing: 0.01em;
  color: rgb(var(--v-theme-primary));
  margin: 0;
}
.section-hero__subtitle {
  font-size: 13px;
  color: rgb(var(--v-theme-on-surface-variant));
  margin: 4px 0 0;
  max-width: 640px;
  line-height: 1.5;
}
.section-hero__actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-shrink: 0;
}
</style>
