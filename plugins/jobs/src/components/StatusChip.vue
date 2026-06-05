<template>
  <span class="status-chip" :class="`status-${status.toLowerCase()}`">{{ label }}</span>
</template>
<script setup lang="ts">
import { computed } from "vue";
import type { HadesStatus } from "../api/types";
const props = defineProps<{ status: HadesStatus }>();
const LABELS: Record<HadesStatus, string> = {
  RUNNING: "Running", COMPLETED: "Completed", FAILED: "Failed", CANCELLED: "Cancelled",
};
const label = computed(() => LABELS[props.status] ?? props.status);
</script>
<style scoped>
.status-chip { padding: 2px 8px; border-radius: 10px; font-size: 12px; color: #fff; }
.status-running { background: rgb(var(--v-theme-info)); }
.status-completed { background: rgb(var(--v-theme-success)); }
.status-failed { background: rgb(var(--v-theme-error)); }
.status-cancelled { background: rgba(var(--v-theme-on-surface), 0.6); }
</style>
