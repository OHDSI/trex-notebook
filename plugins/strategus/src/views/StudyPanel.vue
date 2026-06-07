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

    <!-- Study actions -->
    <div class="study-actions">
      <AtlasButton :loading="saving" data-test="study-save" @click="onSave">Save</AtlasButton>
      <AtlasButton variant="ghost" data-test="study-run" @click="runOpen = true">Run analysis</AtlasButton>
      <AtlasButton variant="ghost" class="study-actions__delete" data-test="study-delete" @click="confirmOpen = true">Delete</AtlasButton>
      <span v-if="saveMsg" class="study-actions__msg" :class="{ 'is-error': saveError }" data-test="study-save-msg">{{ saveMsg }}</span>
    </div>

    <!-- Run analysis (reuses the existing execute dialog) -->
    <RunAnalysisDialog :open="runOpen" :spec="spec" @close="runOpen = false" @submitted="onRun" />

    <!-- Delete confirmation -->
    <AtlasDialog
      :model-value="confirmOpen"
      eyebrow="DELETE"
      title="Delete study"
      :max-width="440"
      @close="confirmOpen = false"
      @update:model-value="(v: boolean) => { if (!v) confirmOpen = false }"
    >
      <p class="text-body-2">
        Delete this study? This removes it locally and, if it was saved, deletes the
        server definition. This cannot be undone.
      </p>
      <template #actions>
        <AtlasButton variant="ghost" @click="confirmOpen = false">Cancel</AtlasButton>
        <AtlasButton class="study-actions__delete" data-test="study-delete-confirm" :loading="deleting" @click="onDelete">Delete</AtlasButton>
      </template>
    </AtlasDialog>

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
import { computed, ref } from 'vue';
import { AtlasIcon, AtlasTooltip, AtlasButton, AtlasDialog } from '@ohdsi/atlas-ui';
import StudySetupPanel from './StudySetupPanel.vue';
import CohortsPanel from './CohortsPanel.vue';
import ComparisonsPanel from './ComparisonsPanel.vue';
import OutcomesPanel from './OutcomesPanel.vue';
import TimeAtRiskPanel from './TimeAtRiskPanel.vue';
import RunAnalysisDialog from '../components/RunAnalysisDialog.vue';
import { useStrategusStore } from '../store/useStrategusStore';
import { useStudiesStore } from '../store/useStudiesStore';
import { serializeSpec } from '../services/SpecSerializer';
import { useValidation } from '../store/validation';
import type { SidebarItem, ValidationStatus } from '../models/Validation';

const store = useStrategusStore();
const studies = useStudiesStore();
const { statusFor } = useValidation();

const saving = ref(false);
const deleting = ref(false);
const runOpen = ref(false);
const confirmOpen = ref(false);
const saveMsg = ref('');
const saveError = ref(false);

// Cast as StudiesListView/ExportPanel do: serializeSpec is duck-typed against a
// snapshot whose cohortsByRole/timeAtRisk are slightly looser than the live store.
const spec = computed(() => serializeSpec(store as unknown as Parameters<typeof serializeSpec>[0]));

async function onSave(): Promise<void> {
  saving.value = true;
  saveMsg.value = '';
  saveError.value = false;
  try {
    await studies.saveCurrent(store);
    saveMsg.value = 'Saved';
  } catch (e) {
    saveError.value = true;
    saveMsg.value = e instanceof Error ? e.message : String(e);
  } finally {
    saving.value = false;
  }
}

async function onDelete(): Promise<void> {
  deleting.value = true;
  try {
    await studies.deleteCurrent();
  } finally {
    deleting.value = false;
    confirmOpen.value = false;
  }
}

function onRun(jobId: string): void {
  runOpen.value = false;
  window.location.assign(`/plugins/jobs-plugin/?job=${encodeURIComponent(jobId)}`);
}

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
.study-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 20px;
}
.study-actions__delete {
  color: #c62828;
}
.study-actions__msg {
  font-size: 13px;
  color: rgba(0, 0, 0, 0.6);
  margin-left: 4px;
}
.study-actions__msg.is-error {
  color: #c62828;
}
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
