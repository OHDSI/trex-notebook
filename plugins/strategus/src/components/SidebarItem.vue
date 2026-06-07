<template>
  <div
    class="sidebar-item"
    :class="{ 'sidebar-item--active': store.activePanel === panel }"
    role="button"
    tabindex="0"
    @click="store.activePanel = panel"
    @keydown.enter.space.prevent="store.activePanel = panel"
  >
    <AtlasIcon
      :icon="icon"
      size="18"
      class="sidebar-item__icon"
    />
    <span class="sidebar-item__label">{{ label }}</span>
    <AtlasTooltip
      v-if="validationResult.message"
      :text="validationResult.message"
      location="right"
      :open-delay="300"
    >
      <template #activator="{ props: tooltipProps }">
        <AtlasIcon
          v-bind="tooltipProps"
          class="sidebar-item__status ml-auto"
          :icon="statusIcon"
          :color="statusColor"
          size="14"
        />
      </template>
    </AtlasTooltip>
    <AtlasIcon
      v-else
      class="sidebar-item__status ml-auto"
      :icon="statusIcon"
      :color="statusColor"
      size="14"
    />
    <AtlasSwitch
      v-if="toggle"
      :model-value="enabled"
      label=""
      class="sidebar-item__toggle ml-1"
      @update:model-value="$emit('toggle')"
      @click.stop
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { AtlasIcon, AtlasTooltip, AtlasSwitch } from '@ohdsi/atlas-ui';
import { useStrategusStore } from '../store/useStrategusStore';
import { useValidation } from '../store/validation';
import type { SidebarItem } from '../models/Validation';

const props = defineProps<{
  icon: string;
  label: string;
  panel: SidebarItem;
  toggle?: boolean;
  enabled?: boolean;
}>();

defineEmits<{ toggle: [] }>();

const store = useStrategusStore();
const validation = useValidation();

const validationResult = computed(() => validation.statusFor(props.panel));

const statusIcon = computed(() => {
  switch (validationResult.value.status) {
    case 'valid':   return 'mdi-check-circle';
    case 'warning': return 'mdi-alert-circle';
    case 'error':   return 'mdi-close-circle';
    default:        return 'mdi-circle-outline';
  }
});

const statusColor = computed(() => {
  switch (validationResult.value.status) {
    case 'valid':   return 'success';
    case 'warning': return 'warning';
    case 'error':   return 'error';
    default:        return 'grey';
  }
});
</script>

<style scoped>
.sidebar-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 12px;
  cursor: pointer;
  border-radius: 6px;
  border-left: 3px solid transparent;
  transition: background 0.15s, border-color 0.15s;
  user-select: none;
}

.sidebar-item:hover {
  background: rgba(0, 0, 0, 0.05);
}

.sidebar-item--active {
  background: rgba(var(--v-theme-primary), 0.1);
  border-left-color: rgb(var(--v-theme-primary));
}

.sidebar-item__label {
  font-size: 13px;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-item__toggle {
  flex-shrink: 0;
}
</style>
