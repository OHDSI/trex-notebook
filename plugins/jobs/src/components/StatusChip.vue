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
.status-running { background: #1976d2; }
.status-completed { background: #2e7d32; }
.status-failed { background: #c62828; }
.status-cancelled { background: #757575; }
</style>
