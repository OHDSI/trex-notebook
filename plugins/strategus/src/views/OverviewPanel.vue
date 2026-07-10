<template>
  <div>
    <!-- Study-type guidance banner -->
    <AtlasAlert
      v-if="studyTypePreset"
      severity="info"
      variant="tonal"
      class="mb-4"
    >
      <div class="text-subtitle-2">{{ studyTypePreset.label }}</div>
      <div class="text-body-2 mb-1">{{ studyTypePreset.question }}</div>
      <div class="text-caption">Define: {{ studyTypePreset.requiredRoles.join(' · ') }}</div>
    </AtlasAlert>

    <!-- Page header -->
    <div class="text-overline text-medium-emphasis">
      Strategus Analysis
    </div>
    <div style="width: 28px; height: 2px; background: #eb6622; margin-bottom: 8px" />
    <div class="d-flex align-start justify-space-between mb-1">
      <div>
        <h1 class="text-h4 font-weight-light text-primary mb-1">
          {{ store.studyName || 'New Analysis' }}
        </h1>
        <p
          v-if="store.description"
          class="text-body-2 text-medium-emphasis"
        >
          {{ store.description }}
        </p>
      </div>
      <div class="d-flex gap-2 mt-1">
        <AtlasButton
          variant="ghost"
          size="sm"
          prepend-icon="mdi-import"
          @click="triggerImport"
        >
          Import JSON
        </AtlasButton>
        <AtlasButton
          variant="primary"
          size="sm"
          prepend-icon="mdi-export"
          @click="store.activePanel = 'export'"
        >
          Export
        </AtlasButton>
      </div>
    </div>

    <!-- Hidden file input for import (triggered by Import JSON button) -->
    <input
      ref="fileInput"
      type="file"
      accept=".json"
      aria-label="Import JSON analysis specification file"
      style="display: none"
      @change="handleFileImport"
    >

    <!-- Study Design section -->
    <div class="section-label text-overline text-medium-emphasis mt-4 mb-2">
      Study Design
    </div>

    <AtlasRow dense>
      <AtlasCol
        v-for="card in designCards"
        :key="card.panel"
        cols="12"
        sm="6"
        lg="4"
      >
        <OverviewCard
          :icon="card.icon"
          :icon-bg="card.iconBg"
          :icon-color="card.iconColor"
          :title="card.title"
          :description="card.description"
          :status="card.status"
          @click="card.anchor ? goToDesignSection(card.anchor) : store.activePanel = card.panel"
        />
      </AtlasCol>
    </AtlasRow>

    <!-- Enabled Modules section -->
    <template v-if="enabledModules.length > 0">
      <div class="section-label text-overline text-medium-emphasis mt-4 mb-2">
        Enabled Modules
      </div>
      <AtlasRow dense>
        <AtlasCol
          v-for="mod in enabledModules"
          :key="mod.panel"
          cols="12"
          sm="6"
          lg="4"
        >
          <OverviewCard
            :icon="mod.icon"
            :icon-bg="mod.iconBg"
            :icon-color="mod.iconColor"
            :title="mod.title"
            :description="mod.description"
            :status="mod.status"
            @click="goToModuleSection(mod.anchor)"
          />
        </AtlasCol>
      </AtlasRow>
    </template>

    <!-- Disabled Modules section -->
    <template v-if="disabledModules.length > 0">
      <div class="section-label text-overline text-medium-emphasis mt-4 mb-2">
        Disabled Modules
      </div>
      <div class="d-flex flex-wrap gap-2">
        <AtlasChip
          v-for="mod in disabledModules"
          :key="mod.panel"
          size="sm"
          :prepend-icon="mod.icon"
          tone="neutral"
          class="disabled-chip"
          @click="goToModuleSection(mod.anchor)"
        >
          {{ mod.title }}
        </AtlasChip>
      </div>
    </template>

    <!-- Import error snackbar -->
    <AtlasSnackbar
      v-model="importError"
      :timeout="4000"
      severity="danger"
      :text="importErrorMessage"
      location="bottom"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { AtlasAlert, AtlasButton, AtlasRow, AtlasCol, AtlasChip, AtlasSnackbar } from '@ohdsi/atlas-ui';
import { useStrategusStore } from '../store/useStrategusStore';
import { useValidation } from '../store/validation';
import { deserializeSpec } from '../services/SpecDeserializer';
import { getPreset } from '../services/StudyTypePresets';
import type { AnalysisSpecification } from '../models/AnalysisSpec';
import type { SidebarItem } from '../models/Validation';
import OverviewCard from './OverviewCard.vue';

const store = useStrategusStore();
const validation = useValidation();

const studyTypePreset = computed(() => store.studyType ? getPreset(store.studyType) : null);

const fileInput = ref<HTMLInputElement | null>(null);
const importError = ref(false);
const importErrorMessage = ref('');

// ── Design cards ──────────────────────────────────────────────────────────────

function goToDesignSection(anchorId: string) {
  store.activePanel = 'study';
  // wait for next tick so the panel renders before scrolling
  setTimeout(() => {
    document.getElementById(anchorId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 50);
}

function goToModuleSection(anchorId: string) {
  store.activePanel = 'modules';
  setTimeout(() => {
    document.getElementById(anchorId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 50);
}

const designCards = computed(() => [
  {
    panel: 'study' as SidebarItem,
    anchor: 'sec-setup',
    icon: 'mdi-information-outline',
    iconBg: 'rgba(25, 118, 210, 0.1)',
    iconColor: 'primary',
    title: 'Setup',
    description: setupDescription.value,
    status: validation.statusFor('setup'),
  },
  {
    panel: 'study' as SidebarItem,
    anchor: 'sec-cohorts',
    icon: 'mdi-account-group',
    iconBg: 'rgba(46, 125, 50, 0.1)',
    iconColor: 'success',
    title: 'Cohorts',
    description: cohortDescription.value,
    status: validation.statusFor('cohorts'),
  },
  {
    panel: 'study' as SidebarItem,
    anchor: 'sec-comparisons',
    icon: 'mdi-compare-horizontal',
    iconBg: 'rgba(156, 39, 176, 0.1)',
    iconColor: '#9c27b0',
    title: 'Comparisons',
    description: comparisonDescription.value,
    status: validation.statusFor('comparisons'),
  },
  {
    panel: 'study' as SidebarItem,
    anchor: 'sec-outcomes',
    icon: 'mdi-target',
    iconBg: 'rgba(211, 47, 47, 0.1)',
    iconColor: 'error',
    title: 'Outcomes',
    description: outcomeDescription.value,
    status: validation.statusFor('outcomes'),
  },
  {
    panel: 'study' as SidebarItem,
    anchor: 'sec-tar',
    icon: 'mdi-clock-outline',
    iconBg: 'rgba(245, 124, 0, 0.1)',
    iconColor: 'warning',
    title: 'Time-at-Risk',
    description: tarDescription.value,
    status: validation.statusFor('tar'),
  },
]);

const setupDescription = computed(() => {
  if (!store.studyName) return 'No study name set';
  const parts: string[] = [];
  if (store.studyStartDate) parts.push(`from ${store.studyStartDate}`);
  if (store.studyEndDate) parts.push(`to ${store.studyEndDate}`);
  return parts.length > 0 ? parts.join(' ') : 'All available data';
});

const cohortDescription = computed(() => {
  const n = store.cohorts.length;
  if (n === 0) return 'No cohorts defined';
  const targets = store.cohorts.filter((c) => c.role === 'Target').length;
  const comparators = store.cohorts.filter((c) => c.role === 'Comparator').length;
  const outcomes = store.cohorts.filter((c) => c.role === 'Outcome').length;
  return `${n} cohort(s): ${targets} target, ${comparators} comparator, ${outcomes} outcome`;
});

const comparisonDescription = computed(() => {
  const n = store.comparisons.length;
  if (n === 0) return 'No TCIs defined';
  return `${n} target-comparator-indication(s)`;
});

const outcomeDescription = computed(() => {
  const n = store.outcomes.length;
  const nc = store.negativeControls.length;
  if (n === 0) return 'No outcomes defined';
  return nc > 0 ? `${n} outcome(s), ${nc} negative control(s)` : `${n} outcome(s)`;
});

const tarDescription = computed(() => {
  const tar = store.timeAtRisk;
  if (!tar || !tar.label) return 'Not configured';
  return tar.label;
});

// ── Module definitions ────────────────────────────────────────────────────────

const allModuleDefinitions = [
  { panel: 'cohortDiagnostics', anchor: 'sec-cohortDiagnostics', icon: 'mdi-stethoscope', title: 'Cohort Diagnostics', moduleName: 'CohortDiagnostics', iconBg: 'rgba(2, 136, 209, 0.1)', iconColor: '#0288d1' },
  { panel: 'characterization', anchor: 'sec-characterization', icon: 'mdi-chart-bar', title: 'Characterization', moduleName: 'Characterization', iconBg: 'rgba(56, 142, 60, 0.1)', iconColor: '#388e3c' },
  { panel: 'cohortIncidence', anchor: 'sec-cohortIncidence', icon: 'mdi-chart-timeline-variant', title: 'Cohort Incidence', moduleName: 'CohortIncidence', iconBg: 'rgba(123, 31, 162, 0.1)', iconColor: '#7b1fa2' },
  { panel: 'cohortMethod', anchor: 'sec-cohortMethod', icon: 'mdi-scale-balance', title: 'Cohort Method', moduleName: 'CohortMethod', iconBg: 'rgba(198, 40, 40, 0.1)', iconColor: '#c62828' },
  { panel: 'sccs', anchor: 'sec-sccs', icon: 'mdi-swap-horizontal', title: 'SCCS', moduleName: 'SCCS', iconBg: 'rgba(230, 81, 0, 0.1)', iconColor: '#e65100' },
  { panel: 'plp', anchor: 'sec-plp', icon: 'mdi-brain', title: 'Prediction', moduleName: 'PLP', iconBg: 'rgba(0, 96, 100, 0.1)', iconColor: '#006064' },
  { panel: 'plpValidation', anchor: 'sec-plpValidation', icon: 'mdi-check-decagram-outline', title: 'PLP Validation', moduleName: 'PLPValidation', iconBg: 'rgba(27, 94, 32, 0.1)', iconColor: '#1b5e20' },
  { panel: 'treatmentPatterns', anchor: 'sec-treatmentPatterns', icon: 'mdi-swap-vertical', title: 'Treatment Patterns', moduleName: 'TreatmentPatterns', iconBg: 'rgba(74, 20, 140, 0.1)', iconColor: '#4a148c' },
  { panel: 'evidenceSynthesis', anchor: 'sec-evidenceSynthesis', icon: 'mdi-chart-scatter-plot', title: 'Evidence Synthesis', moduleName: 'EvidenceSynthesis', iconBg: 'rgba(13, 71, 161, 0.1)', iconColor: '#0d47a1' },
] as const;

const enabledModules = computed(() =>
  allModuleDefinitions
    .filter((m) => store.isModuleEnabled(m.moduleName as Parameters<typeof store.isModuleEnabled>[0]))
    .map((m) => ({
      ...m,
      panel: m.panel as SidebarItem,
      description: validation.moduleStatus(m.panel as Parameters<typeof validation.moduleStatus>[0]).message,
      status: validation.moduleStatus(m.panel as Parameters<typeof validation.moduleStatus>[0]),
    }))
);

const disabledModules = computed(() =>
  allModuleDefinitions.filter(
    (m) => !store.isModuleEnabled(m.moduleName as Parameters<typeof store.isModuleEnabled>[0])
  )
);

// ── Import ────────────────────────────────────────────────────────────────────

function triggerImport() {
  fileInput.value?.click();
}

function handleFileImport(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const text = e.target?.result as string;
      const json = JSON.parse(text) as AnalysisSpecification;
      deserializeSpec(json, store);
    } catch {
      importErrorMessage.value = 'Failed to import: invalid JSON or unrecognized format.';
      importError.value = true;
    } finally {
      // Reset so the same file can be re-imported if needed
      target.value = '';
    }
  };
  reader.onerror = () => {
    importErrorMessage.value = 'Failed to read file.';
    importError.value = true;
    target.value = '';
  };
  reader.readAsText(file);
}
</script>

<style scoped>
.section-label {
  letter-spacing: 0.1em;
}

.disabled-chip {
  cursor: pointer;
}
</style>
