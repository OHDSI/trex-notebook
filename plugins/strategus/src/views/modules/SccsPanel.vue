<template>
  <div>
    <!-- Page header (standalone mode only) -->
    <template v-if="!props.embedded">
      <div class="text-overline text-medium-emphasis">
        Module
      </div>
      <div style="width: 28px; height: 2px; background: #eb6622; margin-bottom: 8px" />
      <h1 class="text-h4 font-weight-light text-primary mb-1">
        Self-Controlled Case Series
      </h1>
      <p class="text-body-2 text-medium-emphasis mb-4">
        Within-person self-controlled design
      </p>

      <ModuleEnableBanner
        v-if="!store.isModuleEnabled('SCCS')"
        @enable="store.toggleModule('SCCS')"
      />
    </template>

    <div :class="{ 'module-disabled': !props.embedded && !store.isModuleEnabled('SCCS') }">
      <!-- Shared settings card -->
      <AtlasCard
        flat
        rounded="lg"
        class="mb-4"
        padding="none"
      >
        <h3 class="card-title text-subtitle-1">
          SCCS Settings
        </h3>
        <AtlasDivider />
        <div class="card-body">
          <AtlasTextField
            v-model.number="store.sccsSettings.maxCasesPerOutcome"
            label="Max cases per outcome"
            type="number"
            style="max-width: 200px"
            class="mb-4"
          />
          <AtlasCheckbox
            v-model="store.sccsSettings.useEmpiricalCalibration"
            label="Empirical calibration (requires negative controls)"
          />
          <div
            v-if="store.sccsSettings.useEmpiricalCalibration && store.negativeControls.length === 0"
            class="text-caption text-warning mt-1"
          >
            Add negative controls in Study Design first.
          </div>
        </div>
      </AtlasCard>

      <!-- Analyses list card -->
      <AtlasCard
        flat
        rounded="lg"
        class="mb-4"
        padding="none"
      >
        <h3 class="card-title text-subtitle-1 d-flex align-center justify-space-between">
          <span>Analyses</span>
          <AtlasButton
            size="sm"
            variant="tonal"
            prepend-icon="mdi-plus"
            @click="addAnalysis"
          >
            Add Analysis
          </AtlasButton>
        </h3>
        <AtlasDivider />
        <div class="card-body pa-2">
          <div
            v-for="(analysis, idx) in store.sccsSettings.analyses"
            :key="analysis.analysisId"
            class="analysis-card d-flex align-center pa-3 mb-2 rounded"
          >
            <div class="flex-grow-1">
              <div class="text-body-2 font-weight-medium">
                {{ analysis.description }}
              </div>
              <div class="text-caption text-medium-emphasis">
                {{ analysis.eraWindows.length }} era window(s)
                · naive period {{ analysis.naivePeriod }}d
                <template v-if="analysis.includeCalendarTime">
                  · calendar time
                </template>
                <template v-if="analysis.includeSeasonality">
                  · seasonality
                </template>
                <template v-if="analysis.includeAgeEffect">
                  · age effect
                </template>
              </div>
            </div>
            <AtlasIconButton
              icon="mdi-pencil"
              size="sm"
              variant="text"
              ariaLabel="Edit analysis"
              class="mr-1"
              @click="openEditDialog(idx)"
            />
            <AtlasIconButton
              icon="mdi-delete"
              size="sm"
              variant="text"
              tone="danger"
              ariaLabel="Delete analysis"
              :disabled="store.sccsSettings.analyses.length <= 1"
              @click="deleteAnalysis(idx)"
            />
          </div>
          <div
            v-if="store.sccsSettings.analyses.length === 0"
            class="text-body-2 text-medium-emphasis text-center pa-4"
          >
            No analyses defined. Click "Add Analysis" to create one.
          </div>
        </div>
      </AtlasCard>
    </div>

    <!-- Analysis Edit Dialog -->
    <AtlasDialog
      v-model="dialogOpen"
      eyebrow="SCCS"
      :title="editingIdx === -1 ? 'New SCCS Analysis' : 'Edit SCCS Analysis'"
      :max-width="700"
      @close="dialogOpen = false"
    >
      <template v-if="editingAnalysis">
        <AtlasTextField
          v-model="editingAnalysis.description"
          label="Description"
          class="mb-4"
        />

        <!-- Era Windows Table -->
        <div class="text-subtitle-2 text-medium-emphasis mb-2">
          Era Windows
        </div>
        <AtlasDataTable
          :headers="eraWindowHeaders"
          :items="editingAnalysis.eraWindows"
          density="compact"
          class="mb-2"
        >
          <template #item.label="{ item }">
            <AtlasTextField
              v-model="item.label"
              style="min-width: 110px"
            />
          </template>
          <template #item.start="{ item }">
            <AtlasTextField
              v-model.number="item.start"
              type="number"
              style="width: 70px"
            />
          </template>
          <template #item.startAnchor="{ item }">
            <AtlasSelect
              v-model="item.startAnchor"
              :items="anchorOptions"
              style="min-width: 110px"
            />
          </template>
          <template #item.end="{ item }">
            <AtlasTextField
              v-model.number="item.end"
              type="number"
              style="width: 70px"
            />
          </template>
          <template #item.endAnchor="{ item }">
            <AtlasSelect
              v-model="item.endAnchor"
              :items="anchorOptions"
              style="min-width: 110px"
            />
          </template>
          <template #item.exposureOfInterest="{ item }">
            <AtlasCheckbox
              v-model="item.exposureOfInterest"
            />
          </template>
          <template #item.profileLikelihood="{ item }">
            <AtlasCheckbox
              v-model="item.profileLikelihood"
            />
          </template>
          <template #item.actions="{ index }">
            <AtlasIconButton
              icon="mdi-delete"
              size="sm"
              variant="text"
              tone="danger"
              ariaLabel="Remove era window"
              @click="removeEraWindow(index)"
            />
          </template>
        </AtlasDataTable>
        <AtlasButton
          size="sm"
          variant="tonal"
          prepend-icon="mdi-plus"
          class="mb-4"
          @click="addEraWindow"
        >
          Add Era Window
        </AtlasButton>

        <!-- Effects -->
        <div class="text-subtitle-2 text-medium-emphasis mb-2 mt-2">
          Effects
        </div>
        <div class="d-flex ga-4 flex-wrap mb-4">
          <AtlasCheckbox
            v-model="editingAnalysis.includeAgeEffect"
            label="Age effect"
          />
          <AtlasCheckbox
            v-model="editingAnalysis.includeSeasonality"
            label="Seasonality"
          />
          <AtlasCheckbox
            v-model="editingAnalysis.includeCalendarTime"
            label="Calendar time"
          />
        </div>

        <!-- Knots + naive period -->
        <div class="d-flex ga-3">
          <AtlasTextField
            v-model.number="editingAnalysis.naivePeriod"
            label="Naive period (days)"
            type="number"
            style="max-width: 150px"
          />
          <AtlasTextField
            v-model.number="editingAnalysis.calendarTimeKnots"
            label="Calendar time knots"
            type="number"
            style="max-width: 130px"
            :disabled="!editingAnalysis.includeCalendarTime"
          />
          <AtlasTextField
            v-model.number="editingAnalysis.seasonalityKnots"
            label="Seasonality knots"
            type="number"
            style="max-width: 130px"
            :disabled="!editingAnalysis.includeSeasonality"
          />
        </div>
      </template>
      <template #actions>
        <AtlasButton
          variant="ghost"
          @click="dialogOpen = false"
        >
          Cancel
        </AtlasButton>
        <AtlasButton
          @click="saveAnalysis"
        >
          Save
        </AtlasButton>
      </template>
    </AtlasDialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { AtlasDialog, AtlasButton, AtlasCard, AtlasDivider, AtlasTextField, AtlasSelect, AtlasCheckbox, AtlasIconButton, AtlasDataTable } from '@ohdsi/atlas-ui';
import { useStrategusStore } from '../../store/useStrategusStore';
import ModuleEnableBanner from '../../components/ModuleEnableBanner.vue';
import type { SccsAnalysis, SccsEraWindow } from '../../models/ModuleSettings';
import { createDefaultSccsAnalysis, createDefaultSccsEraWindows } from '../../services/DefaultsFactory';

const props = defineProps<{ embedded?: boolean }>();
const store = useStrategusStore();

const dialogOpen = ref(false);
const editingIdx = ref(-1);
const editingAnalysis = ref<SccsAnalysis | null>(null);

const anchorOptions = [
  { title: 'Era start', value: 'era start' },
  { title: 'Era end', value: 'era end' },
];

const eraWindowHeaders = [
  { key: 'label', title: 'Label', sortable: false },
  { key: 'start', title: 'Start', sortable: false },
  { key: 'startAnchor', title: 'Start Anchor', sortable: false },
  { key: 'end', title: 'End', sortable: false },
  { key: 'endAnchor', title: 'End Anchor', sortable: false },
  { key: 'exposureOfInterest', title: 'Exposure of interest', sortable: false },
  { key: 'profileLikelihood', title: 'Profile likelihood', sortable: false },
  { key: 'actions', title: '', sortable: false },
];

function addAnalysis() {
  const sccs = store.sccsSettings;
  const nextId = sccs.analyses.length > 0
    ? Math.max(...sccs.analyses.map((a) => a.analysisId)) + 1
    : 1;
  editingIdx.value = -1;
  editingAnalysis.value = { ...createDefaultSccsAnalysis(nextId), eraWindows: createDefaultSccsEraWindows() };
  dialogOpen.value = true;
}

function openEditDialog(idx: number) {
  editingIdx.value = idx;
  const a = store.sccsSettings.analyses[idx];
  editingAnalysis.value = { ...a, eraWindows: a.eraWindows.map((w) => ({ ...w })) };
  dialogOpen.value = true;
}

function deleteAnalysis(idx: number) {
  store.sccsSettings.analyses.splice(idx, 1);
}

function saveAnalysis() {
  if (!editingAnalysis.value) return;
  const sccs = store.sccsSettings;
  if (editingIdx.value === -1) {
    sccs.analyses.push({ ...editingAnalysis.value });
  } else {
    sccs.analyses[editingIdx.value] = { ...editingAnalysis.value };
  }
  dialogOpen.value = false;
  editingAnalysis.value = null;
}

function addEraWindow() {
  if (!editingAnalysis.value) return;
  const newWindow: SccsEraWindow = {
    label: 'New window',
    start: 0,
    end: 0,
    startAnchor: 'era start',
    endAnchor: 'era end',
    exposureOfInterest: false,
    profileLikelihood: false,
  };
  editingAnalysis.value.eraWindows.push(newWindow);
}

function removeEraWindow(idx: number) {
  if (!editingAnalysis.value) return;
  editingAnalysis.value.eraWindows.splice(idx, 1);
}
</script>

<style scoped>
.module-disabled {
  opacity: 0.5;
  pointer-events: none;
}

.analysis-card {
  background: rgb(var(--v-theme-surface-variant));
}
.card-title {
  padding: 12px 16px 12px;
  margin: 0;
}
.card-body {
  padding: 16px;
}
</style>
