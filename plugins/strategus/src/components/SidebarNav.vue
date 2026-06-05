<template>
  <nav class="sidebar-nav">
    <!-- Back to studies button -->
    <button
      class="sidebar-nav__back"
      @click="handleBack"
    >
      <AtlasIcon
        icon="mdi-arrow-left"
        size="14"
      />
      <span>All Studies</span>
    </button>

    <!-- Header -->
    <div class="sidebar-nav__header">
      <div class="sidebar-nav__study-name text-truncate">
        {{ store.studyName.trim() || 'Untitled Study' }}
      </div>
      <div class="sidebar-nav__draft-badge text-caption text-medium-emphasis">
        {{ studiesStore.currentStudyId ? 'SAVED' : 'UNSAVED' }}
      </div>
    </div>

    <div class="sidebar-nav__body">
      <SidebarItem
        icon="mdi-view-dashboard-outline"
        label="Overview"
        panel="overview"
      />

      <!-- Study Design section -->
      <SidebarItem
        icon="mdi-pencil-ruler"
        label="Study Design"
        panel="study"
      />
      <div class="sidebar-nav__anchors">
        <button
          v-for="anchor in designAnchors"
          :key="anchor.id"
          class="sidebar-nav__anchor"
          @click="goAnchor(anchor.id)"
        >
          <span class="sidebar-nav__anchor-label">· {{ anchor.label }}</span>
          <AtlasTooltip
            :text="anchor.message"
            location="right"
            :open-delay="200"
          >
            <template #activator="{ props: tipProps }">
              <AtlasIcon
                v-bind="tipProps"
                :icon="anchor.icon"
                :color="anchor.color"
                size="12"
                class="ml-auto"
              />
            </template>
          </AtlasTooltip>
        </button>
      </div>

      <!-- Modules section — own page -->
      <SidebarItem
        icon="mdi-puzzle-outline"
        label="Modules"
        panel="modules"
      />
      <div class="sidebar-nav__anchors">
        <div
          v-for="anchor in moduleAnchors"
          :key="anchor.id"
          class="sidebar-nav__anchor-row"
        >
          <button
            class="sidebar-nav__anchor sidebar-nav__anchor--module"
            @click="goAnchor(anchor.id)"
          >
            <span class="sidebar-nav__anchor-label">· {{ anchor.label }}</span>
            <AtlasTooltip
              v-if="anchor.enabled"
              :text="anchor.message"
              location="right"
              :open-delay="200"
            >
              <template #activator="{ props: tipProps }">
                <AtlasIcon
                  v-bind="tipProps"
                  :icon="anchor.icon"
                  :color="anchor.color"
                  size="12"
                />
              </template>
            </AtlasTooltip>
          </button>
          <AtlasSwitch
            :model-value="anchor.enabled"
            label=""
            class="sidebar-nav__anchor-toggle"
            @update:model-value="store.toggleModule(anchor.moduleName as never)"
          />
        </div>
      </div>

      <!-- Spacer pushes Export to bottom -->
      <div class="sidebar-nav__spacer" />

      <!-- Export -->
      <SidebarItem
        icon="mdi-export-variant"
        label="Export"
        panel="export"
      />
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { AtlasIcon, AtlasTooltip, AtlasSwitch } from '@ohdsi/atlas-ui';
import { useStrategusStore } from '../store/useStrategusStore';
import { useStudiesStore } from '../store/useStudiesStore';
import { useValidation } from '../store/validation';
import SidebarItem from './SidebarItem.vue';
import type { SidebarItem as SidebarItemType, ValidationStatus } from '../models/Validation';

const store = useStrategusStore();
const studiesStore = useStudiesStore();
const { statusFor } = useValidation();

const ANCHOR_ICON: Record<ValidationStatus, string> = {
  valid: 'mdi-check-circle',
  warning: 'mdi-alert-circle',
  error: 'mdi-close-circle',
  neutral: 'mdi-circle-outline',
};
const ANCHOR_COLOR: Record<ValidationStatus, string> = {
  valid: 'success',
  warning: 'warning',
  error: 'error',
  neutral: 'grey-lighten-1',
};

interface DesignAnchor {
  id: string;
  label: string;
  key: SidebarItemType;
  icon: string;
  color: string;
  message: string;
}

interface ModuleAnchor extends DesignAnchor {
  isModule: true;
  moduleName: string;
  enabled: boolean;
}

const designAnchors = computed<DesignAnchor[]>(() => {
  const defs: Array<{ id: string; label: string; key: SidebarItemType }> = [
    { id: 'sec-setup', label: 'Setup', key: 'setup' },
    { id: 'sec-cohorts', label: 'Cohorts', key: 'cohorts' },
    { id: 'sec-comparisons', label: 'Comparisons', key: 'comparisons' },
    { id: 'sec-outcomes', label: 'Outcomes & NC', key: 'outcomes' },
    { id: 'sec-tar', label: 'Time-at-Risk', key: 'tar' },
  ];
  return defs.map(d => {
    const result = statusFor(d.key);
    return {
      ...d,
      icon: ANCHOR_ICON[result.status],
      color: ANCHOR_COLOR[result.status],
      message: result.message,
    };
  });
});

const moduleAnchors = computed<ModuleAnchor[]>(() => {
  const defs: Array<{ id: string; label: string; key: SidebarItemType; moduleName: string }> = [
    { id: 'sec-cohortDiagnostics', label: 'Cohort Diagnostics', key: 'cohortDiagnostics', moduleName: 'CohortDiagnostics' },
    { id: 'sec-characterization', label: 'Characterization', key: 'characterization', moduleName: 'Characterization' },
    { id: 'sec-cohortIncidence', label: 'Incidence', key: 'cohortIncidence', moduleName: 'CohortIncidence' },
    { id: 'sec-cohortMethod', label: 'Cohort Method', key: 'cohortMethod', moduleName: 'CohortMethod' },
    { id: 'sec-sccs', label: 'SCCS', key: 'sccs', moduleName: 'SCCS' },
    { id: 'sec-plp', label: 'Prediction', key: 'plp', moduleName: 'PLP' },
    { id: 'sec-plpValidation', label: 'PLP Validation', key: 'plpValidation', moduleName: 'PLPValidation' },
    { id: 'sec-treatmentPatterns', label: 'Treatment Patterns', key: 'treatmentPatterns', moduleName: 'TreatmentPatterns' },
    { id: 'sec-evidenceSynthesis', label: 'Evidence Synthesis', key: 'evidenceSynthesis', moduleName: 'EvidenceSynthesis' },
  ];
  return defs.map(d => {
    const enabled = store.isModuleEnabled(d.moduleName as Parameters<typeof store.isModuleEnabled>[0]);
    const result = statusFor(d.key);
    return {
      ...d,
      isModule: true as const,
      enabled,
      icon: ANCHOR_ICON[result.status],
      color: ANCHOR_COLOR[result.status],
      message: result.message,
    };
  });
});

const DESIGN_ANCHOR_IDS = ['sec-setup', 'sec-cohorts', 'sec-comparisons', 'sec-outcomes', 'sec-tar'];

function goAnchor(anchorId: string) {
  // Design anchors live on 'study' panel; module anchors on 'modules' panel
  const targetPanel = DESIGN_ANCHOR_IDS.includes(anchorId) ? 'study' : 'modules';
  if (store.activePanel !== targetPanel) {
    store.activePanel = targetPanel;
    setTimeout(() => scrollTo(anchorId), 50);
  } else {
    scrollTo(anchorId);
  }
}

function scrollTo(anchorId: string) {
  document.getElementById(anchorId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function handleBack(): void {
  // Save current edits if we have an open study record
  if (studiesStore.currentStudyId) {
    studiesStore.updateStudy(studiesStore.currentStudyId, {
      name: store.studyName.trim() || 'Untitled study',
      description: store.description,
      state: store.snapshot(),
    });
  } else if (store.studyName.trim()) {
    // Persist new study if user gave it a name
    const created = studiesStore.createStudy(store.snapshot(), store.studyName.trim(), store.description);
    studiesStore.currentStudyId = created.id;
  }
  studiesStore.closeEditor();
}
</script>

<style scoped>
.sidebar-nav {
  width: 240px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border-right: 1px solid rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.sidebar-nav__back {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px 6px;
  background: none;
  border: none;
  color: rgba(0, 0, 0, 0.55);
  font-size: 11px;
  cursor: pointer;
  text-align: left;
  font-weight: 500;
  letter-spacing: 0.02em;
  flex-shrink: 0;
  transition: color 120ms ease;
}
.sidebar-nav__back:hover { color: rgb(31, 66, 90); }

.sidebar-nav__header {
  padding: 8px 12px 10px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  flex-shrink: 0;
}

.sidebar-nav__study-name {
  font-size: 14px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.87);
}

.sidebar-nav__draft-badge {
  margin-top: 2px;
  letter-spacing: 0.08em;
}

.sidebar-nav__body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 6px;
  display: flex;
  flex-direction: column;
}

.sidebar-nav__group-label {
  padding: 4px 12px 2px;
  font-size: 10px;
  letter-spacing: 0.1em;
}

.sidebar-nav__spacer {
  flex: 1;
}

.sidebar-nav__anchors {
  padding: 2px 0 6px;
}

.sidebar-nav__anchor {
  display: flex;
  align-items: center;
  width: 100%;
  text-align: left;
  padding: 3px 12px 3px 32px;
  font-size: 11px;
  color: rgba(0, 0, 0, 0.5);
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
}
.sidebar-nav__anchor-label {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sidebar-nav__anchor:hover {
  color: rgb(31, 66, 90);
  background: rgba(31, 66, 90, 0.03);
}

.sidebar-nav__anchors-divider {
  height: 1px;
  background: rgba(0, 0, 0, 0.06);
  margin: 6px 12px;
}

.sidebar-nav__anchor-row {
  display: flex;
  align-items: center;
  gap: 4px;
}
.sidebar-nav__anchor-row .sidebar-nav__anchor {
  flex: 1;
  padding-right: 4px;
}
.sidebar-nav__anchor-toggle {
  transform: scale(0.7);
  transform-origin: center right;
  margin-right: 4px;
  flex-shrink: 0;
}
</style>
