<script setup lang="ts">
defineProps<{ message: string }>()
</script>

<template>
  <div class="loading-overlay">
    <div class="spinner" />
    <p class="message">
      {{ message }}
    </p>
    <p class="hint">
      First load downloads ~30MB of R packages. Subsequent loads are cached.
    </p>
  </div>
</template>

<style scoped>
.loading-overlay {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  padding: 48px;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid #e0e0e0;
  border-top-color: rgb(var(--v-theme-primary, 0, 0, 128));
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 24px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.message {
  font-size: 16px;
  font-weight: 500;
  color: #333;
}

.hint {
  font-size: 12px;
  color: #999;
  margin-top: 8px;
}
</style>
