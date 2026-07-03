<template>
  <div class="study-panel">
    <!-- Page header -->
    <div class="text-overline text-medium-emphasis">
      Strategus Analysis
    </div>
    <div style="width: 28px; height: 2px; background: #eb6622; margin: 4px 0 8px" />
    <h1 class="text-h4 font-weight-light text-primary mb-1">
      {{ store.studyName.trim() || 'Untitled Study' }}
    </h1>
    <p class="text-body-2 text-medium-emphasis mb-4">
      Configure cohorts, comparisons, time-at-risk and analysis modules.
    </p>

    <!-- Design sections -->
    <section
      v-for="section in designSections"
      :id="section.id"
      :key="section.id"
      class="study-section"
    >
      <h2 class="study-section__heading">
        <AtlasIcon
          :icon="section.icon"
          size="18"
        />
        <span class="study-section__title">{{ section.title }}</span>
        <AtlasTooltip
          :text="statusFor(section.key).message"
          location="right"
          :open-delay="200"
        >
          <template #activator="{ props: tipProps }">
            <AtlasIcon
              v-bind="tipProps"
              :icon="iconFor(section.key)"
              :color="colorFor(section.key)"
              size="16"
              class="ml-2"
            />
          </template>
        </AtlasTooltip>
      </h2>
      <component
        :is="section.component"
        :embedded="true"
      />
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { AtlasIcon, AtlasTooltip } from '@ohdsi/atlas-ui';
import StudySetupPanel from './StudySetupPanel.vue';
import CohortsPanel from './CohortsPanel.vue';
import ComparisonsPanel from './ComparisonsPanel.vue';
import OutcomesPanel from './OutcomesPanel.vue';
import TimeAtRiskPanel from './TimeAtRiskPanel.vue';
import { useStrategusStore } from '../store/useStrategusStore';
import { useValidation } from '../store/validation';
import type { SidebarItem, ValidationStatus } from '../models/Validation';

const store = useStrategusStore();
const { statusFor } = useValidation();

interface DesignSection {
  id: string;
  key: SidebarItem;
  icon: string;
  title: string;
  component: unknown;
}

const designSections = computed<DesignSection[]>(() => [
  { id: 'sec-setup', key: 'setup', icon: 'mdi-information-outline', title: 'Setup', component: StudySetupPanel },
  { id: 'sec-cohorts', key: 'cohorts', icon: 'mdi-account-group-outline', title: 'Cohorts', component: CohortsPanel },
  { id: 'sec-comparisons', key: 'comparisons', icon: 'mdi-compare-horizontal', title: 'Comparisons', component: ComparisonsPanel },
  { id: 'sec-outcomes', key: 'outcomes', icon: 'mdi-target', title: 'Outcomes & Negative Controls', component: OutcomesPanel },
  { id: 'sec-tar', key: 'tar', icon: 'mdi-clock-outline', title: 'Time-at-Risk', component: TimeAtRiskPanel },
]);

const ICON_BY_STATUS: Record<ValidationStatus, string> = {
  valid: 'mdi-check-circle',
  warning: 'mdi-alert-circle',
  error: 'mdi-close-circle',
  neutral: 'mdi-circle-outline',
};
const COLOR_BY_STATUS: Record<ValidationStatus, string> = {
  valid: 'success',
  warning: 'warning',
  error: 'error',
  neutral: 'grey-lighten-1',
};

function iconFor(key: SidebarItem): string {
  return ICON_BY_STATUS[statusFor(key).status];
}
function colorFor(key: SidebarItem): string {
  return COLOR_BY_STATUS[statusFor(key).status];
}
</script>

<style scoped>
.study-section {
  padding: 18px 0;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  scroll-margin-top: 24px;
}
.study-section:first-of-type {
  border-top: none;
  padding-top: 12px;
}
.study-section__heading {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: rgba(0, 0, 0, 0.72);
  margin-bottom: 10px;
}
.study-section__heading .v-icon {
  color: rgba(0, 0, 0, 0.4);
}
.study-section__title {
  flex: 0 0 auto;
}
.study-section__disabled-hint {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
  padding: 8px 14px;
  background: rgba(0, 0, 0, 0.02);
  border: 1px dashed rgba(0, 0, 0, 0.08);
  border-radius: 8px;
}
</style>
