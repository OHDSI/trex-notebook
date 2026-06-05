<template>
  <a
    class="overview-tile"
    role="button"
    tabindex="0"
    @click="$emit('click')"
    @keydown.enter.space.prevent="$emit('click')"
  >
    <div class="overview-tile__top">
      <AtlasIcon
        :color="iconColor || 'primary'"
        size="24"
        class="overview-tile__icon"
      >
        {{ icon }}
      </AtlasIcon>
      <AtlasIcon
        v-if="status && status.status !== 'neutral'"
        :color="statusColor"
        size="18"
      >
        {{ statusIcon }}
      </AtlasIcon>
    </div>
    <div class="overview-tile__title">
      {{ title }}
    </div>
    <div class="overview-tile__desc">
      {{ description }}
    </div>
  </a>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { AtlasIcon } from '@ohdsi/atlas-ui';
import type { ValidationResult } from '../models/Validation';

const props = defineProps<{
  icon: string;
  iconBg?: string;
  iconColor?: string;
  title: string;
  description: string;
  status?: ValidationResult;
}>();

defineEmits<{
  click: [];
}>();

const statusColor = computed(() => {
  if (!props.status) return 'grey';
  switch (props.status.status) {
    case 'valid': return 'success';
    case 'warning': return 'warning';
    case 'error': return 'error';
    default: return 'grey';
  }
});

const statusIcon = computed(() => {
  if (!props.status) return '';
  switch (props.status.status) {
    case 'valid': return 'mdi-check-circle';
    case 'warning': return 'mdi-alert-circle';
    case 'error': return 'mdi-close-circle';
    default: return 'mdi-circle-outline';
  }
});
</script>

<style scoped>
/* Match Atlas3's AtlasCard interactive variant exactly */
.overview-tile {
  display: block;
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  cursor: pointer;
  text-decoration: none;
  color: rgba(0, 0, 0, 0.87);
  box-shadow:
    0 1px 3px rgba(15, 23, 42, 0.08),
    0 8px 24px rgba(15, 23, 42, 0.08);
  transition:
    box-shadow 160ms ease,
    transform 160ms ease;
}

.overview-tile:hover,
.overview-tile:focus-visible {
  box-shadow:
    0 2px 6px rgba(15, 23, 42, 0.1),
    0 12px 32px rgba(15, 23, 42, 0.12);
  outline: none;
}

.overview-tile__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.overview-tile__icon {
  flex-shrink: 0;
}

.overview-tile__title {
  font-size: 15px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.87);
  line-height: 1.3;
  margin-bottom: 4px;
}

.overview-tile__desc {
  font-size: 13px;
  color: rgba(0, 0, 0, 0.55);
  line-height: 1.45;
}
</style>
