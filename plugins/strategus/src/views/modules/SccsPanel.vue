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
      <v-card
        flat
        rounded="lg"
        class="mb-4"
      >
        <v-card-title class="text-subtitle-1">
          SCCS Settings
        </v-card-title>
        <v-divider />
        <v-card-text>
          <v-text-field
            v-model.number="store.sccsSettings.maxCasesPerOutcome"
            label="Max cases per outcome"
            variant="outlined"
            density="compact"
            rounded="md"
            hide-details
            type="number"
            style="max-width: 200px"
            class="mb-4"
          />
          <v-checkbox
            v-model="store.sccsSettings.useEmpiricalCalibration"
            label="Empirical calibration (requires negative controls)"
            density="compact"
            hide-details
          />
          <div
            v-if="store.sccsSettings.useEmpiricalCalibration && store.negativeControls.length === 0"
            class="text-caption text-warning mt-1"
          >
            Add negative controls in Study Design first.
          </div>
        </v-card-text>
      </v-card>

      <!-- Analyses list card -->
      <v-card
        flat
        rounded="lg"
        class="mb-4"
      >
        <v-card-title class="text-subtitle-1 d-flex align-center justify-space-between">
          <span>Analyses</span>
          <v-btn
            size="small"
            variant="tonal"
            color="primary"
            prepend-icon="mdi-plus"
            @click="addAnalysis"
          >
            Add Analysis
          </v-btn>
        </v-card-title>
        <v-divider />
        <v-card-text class="pa-2">
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
            <v-btn
              icon="mdi-pencil"
              size="x-small"
              variant="text"
              class="mr-1"
              @click="openEditDialog(idx)"
            />
            <v-btn
              icon="mdi-delete"
              size="x-small"
              variant="text"
              color="error"
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
        </v-card-text>
      </v-card>
    </div>

    <!-- Analysis Edit Dialog -->
    <v-dialog
      v-model="dialogOpen"
      max-width="700"
    >
      <v-card v-if="editingAnalysis">
        <v-card-title>
          {{ editingIdx === -1 ? 'New SCCS Analysis' : 'Edit SCCS Analysis' }}
        </v-card-title>
        <v-divider />
        <v-card-text class="pt-4">
          <v-text-field
            v-model="editingAnalysis.description"
            label="Description"
            variant="outlined"
            density="compact"
            rounded="md"
            hide-details
            class="mb-4"
          />

          <!-- Era Windows Table -->
          <div class="text-subtitle-2 text-medium-emphasis mb-2">
            Era Windows
          </div>
          <v-table
            density="compact"
            class="mb-2"
          >
            <thead>
              <tr>
                <th>Label</th>
                <th>Start</th>
                <th>Start Anchor</th>
                <th>End</th>
                <th>End Anchor</th>
                <th>Exposure of interest</th>
                <th>Profile likelihood</th>
                <th />
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(win, widx) in editingAnalysis.eraWindows"
                :key="widx"
              >
                <td>
                  <v-text-field
                    v-model="win.label"
                    variant="plain"
                    density="compact"
                    hide-details
                    style="min-width: 110px"
                  />
                </td>
                <td>
                  <v-text-field
                    v-model.number="win.start"
                    variant="plain"
                    density="compact"
                    hide-details
                    type="number"
                    style="width: 70px"
                  />
                </td>
                <td>
                  <v-select
                    v-model="win.startAnchor"
                    :items="anchorOptions"
                    variant="plain"
                    density="compact"
                    hide-details
                    style="min-width: 110px"
                  />
                </td>
                <td>
                  <v-text-field
                    v-model.number="win.end"
                    variant="plain"
                    density="compact"
                    hide-details
                    type="number"
                    style="width: 70px"
                  />
                </td>
                <td>
                  <v-select
                    v-model="win.endAnchor"
                    :items="anchorOptions"
                    variant="plain"
                    density="compact"
                    hide-details
                    style="min-width: 110px"
                  />
                </td>
                <td class="text-center">
                  <v-checkbox
                    v-model="win.exposureOfInterest"
                    density="compact"
                    hide-details
                  />
                </td>
                <td class="text-center">
                  <v-checkbox
                    v-model="win.profileLikelihood"
                    density="compact"
                    hide-details
                  />
                </td>
                <td>
                  <v-btn
                    icon
                    size="x-small"
                    variant="text"
                    color="error"
                    @click="removeEraWindow(widx)"
                  >
                    <v-icon>mdi-delete</v-icon>
                  </v-btn>
                </td>
              </tr>
            </tbody>
          </v-table>
          <v-btn
            size="small"
            variant="tonal"
            prepend-icon="mdi-plus"
            class="mb-4"
            @click="addEraWindow"
          >
            Add Era Window
          </v-btn>

          <!-- Effects -->
          <div class="text-subtitle-2 text-medium-emphasis mb-2 mt-2">
            Effects
          </div>
          <div class="d-flex ga-4 flex-wrap mb-4">
            <v-checkbox
              v-model="editingAnalysis.includeAgeEffect"
              label="Age effect"
              density="compact"
              hide-details
            />
            <v-checkbox
              v-model="editingAnalysis.includeSeasonality"
              label="Seasonality"
              density="compact"
              hide-details
            />
            <v-checkbox
              v-model="editingAnalysis.includeCalendarTime"
              label="Calendar time"
              density="compact"
              hide-details
            />
          </div>

          <!-- Knots + naive period -->
          <div class="d-flex ga-3">
            <v-text-field
              v-model.number="editingAnalysis.naivePeriod"
              label="Naive period (days)"
              variant="outlined"
              density="compact"
              rounded="md"
              hide-details
              type="number"
              style="max-width: 150px"
            />
            <v-text-field
              v-model.number="editingAnalysis.calendarTimeKnots"
              label="Calendar time knots"
              variant="outlined"
              density="compact"
              rounded="md"
              hide-details
              type="number"
              style="max-width: 130px"
              :disabled="!editingAnalysis.includeCalendarTime"
            />
            <v-text-field
              v-model.number="editingAnalysis.seasonalityKnots"
              label="Seasonality knots"
              variant="outlined"
              density="compact"
              rounded="md"
              hide-details
              type="number"
              style="max-width: 130px"
              :disabled="!editingAnalysis.includeSeasonality"
            />
          </div>
        </v-card-text>
        <v-divider />
        <v-card-actions class="justify-end">
          <v-btn
            variant="text"
            @click="dialogOpen = false"
          >
            Cancel
          </v-btn>
          <v-btn
            variant="tonal"
            color="primary"
            @click="saveAnalysis"
          >
            Save
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
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
</style>
