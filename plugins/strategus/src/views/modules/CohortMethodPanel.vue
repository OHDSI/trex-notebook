<template>
  <div>
    <!-- Page header (standalone mode only) -->
    <template v-if="!props.embedded">
      <div class="text-overline text-medium-emphasis">
        Module
      </div>
      <div style="width: 28px; height: 2px; background: #eb6622; margin-bottom: 8px" />
      <h1 class="text-h4 font-weight-light text-primary mb-1">
        Cohort Method
      </h1>
      <p class="text-body-2 text-medium-emphasis mb-4">
        New-user comparative cohort studies with propensity score adjustment
      </p>

      <ModuleEnableBanner
        v-if="!store.isModuleEnabled('CohortMethod')"
        @enable="store.toggleModule('CohortMethod')"
      />
    </template>

    <div :class="{ 'module-disabled': !props.embedded && !store.isModuleEnabled('CohortMethod') }">
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
            v-for="(analysis, idx) in store.cohortMethodSettings.analyses"
            :key="analysis.analysisId"
            class="analysis-card d-flex align-center pa-3 mb-2 rounded"
          >
            <div class="flex-grow-1">
              <div class="text-body-2 font-weight-medium">
                {{ analysis.description }}
              </div>
              <div class="text-caption text-medium-emphasis">
                {{ psMethodLabel(analysis.psAdjustmentMethod) }}
                · {{ modelTypeLabel(analysis.outcomeModelType) }}
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
              :disabled="store.cohortMethodSettings.analyses.length <= 1"
              @click="deleteAnalysis(idx)"
            />
          </div>
          <div
            v-if="store.cohortMethodSettings.analyses.length === 0"
            class="text-body-2 text-medium-emphasis text-center pa-4"
          >
            No analyses defined. Click "Add Analysis" to create one.
          </div>
        </v-card-text>
      </v-card>

      <!-- Empirical calibration -->
      <v-card
        flat
        rounded="lg"
        class="mb-4"
      >
        <v-card-title class="text-subtitle-1">
          Calibration
        </v-card-title>
        <v-divider />
        <v-card-text>
          <v-checkbox
            v-model="store.cohortMethodSettings.useEmpiricalCalibration"
            label="Empirical calibration (requires negative controls)"
            density="compact"
            hide-details
          />
          <div
            v-if="store.cohortMethodSettings.useEmpiricalCalibration && store.negativeControls.length === 0"
            class="text-caption text-warning mt-1"
          >
            Add negative controls in Study Design first.
          </div>
        </v-card-text>
      </v-card>

      <!-- Advanced -->
      <AdvancedSection>
        <v-card
          flat
          rounded="lg"
          class="mt-2"
        >
          <v-card-text>
            <div class="d-flex ga-3 mb-3">
              <v-text-field
                v-model.number="store.cohortMethodSettings.maxCohortSizeForFitting"
                label="Max cohort size for fitting"
                variant="outlined"
                density="compact"
                rounded="md"
                hide-details
                type="number"
                style="max-width: 200px"
              />
              <v-text-field
                v-model.number="store.cohortMethodSettings.maxCovBalanceCohortSize"
                label="Max cov. balance cohort size"
                variant="outlined"
                density="compact"
                rounded="md"
                hide-details
                type="number"
                style="max-width: 200px"
              />
            </div>
            <div class="d-flex ga-6 mb-4">
              <v-checkbox
                v-model="store.cohortMethodSettings.restrictToCommonPeriod"
                label="Restrict to common period"
                density="compact"
                hide-details
              />
              <v-checkbox
                v-model="store.cohortMethodSettings.firstExposureOnly"
                label="First exposure only"
                density="compact"
                hide-details
              />
            </div>

            <!-- Custom covariates -->
            <div class="text-subtitle-2 mb-2">
              Custom Covariates
            </div>
            <v-text-field
              :model-value="store.cohortMethodSettings.includedCovariateConceptIds.join(', ')"
              label="Included concept IDs (comma-separated)"
              variant="outlined"
              density="compact"
              rounded="md"
              hide-details
              class="mb-3"
              @update:model-value="parseConceptIds($event)"
            />
            <div class="d-flex ga-3 align-center mb-4">
              <v-text-field
                v-model="store.cohortMethodSettings.customCovariateGroupName"
                label="Group name"
                variant="outlined"
                density="compact"
                rounded="md"
                hide-details
                style="max-width: 200px"
              />
              <v-checkbox
                v-model="store.cohortMethodSettings.addDescendantsToInclude"
                label="Include descendants"
                density="compact"
                hide-details
              />
            </div>

            <!-- Covariate features -->
            <div class="text-subtitle-2 mb-2">
              Covariate Features
            </div>
            <v-btn
              size="small"
              variant="tonal"
              prepend-icon="mdi-tune"
              @click="covFeaturesOpen = true"
            >
              Customize covariate features…
            </v-btn>
          </v-card-text>
        </v-card>
      </AdvancedSection>
    </div>

    <!-- Analysis Edit Dialog -->
    <v-dialog
      v-model="dialogOpen"
      max-width="560"
    >
      <v-card v-if="editingAnalysis">
        <v-card-title>
          {{ editingIdx === -1 ? 'New Analysis' : 'Edit Analysis' }}
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
          <v-select
            v-model="editingAnalysis.psAdjustmentMethod"
            :items="psMethodItems"
            label="PS adjustment method"
            variant="outlined"
            density="compact"
            rounded="md"
            hide-details
            class="mb-4"
          />
          <!-- Method-specific fields -->
          <v-text-field
            v-if="editingAnalysis.psAdjustmentMethod === 'matching'"
            v-model.number="editingAnalysis.psMatchMaxRatio"
            label="Matching ratio"
            variant="outlined"
            density="compact"
            rounded="md"
            type="number"
            min="1"
            hint="1 = 1:1. >1 = variable ratio"
            persistent-hint
            class="mb-4"
            style="max-width: 200px"
          />
          <v-text-field
            v-else-if="editingAnalysis.psAdjustmentMethod === 'stratification'"
            v-model.number="editingAnalysis.psStrataCount"
            label="Number of strata"
            variant="outlined"
            density="compact"
            rounded="md"
            type="number"
            min="2"
            hide-details
            class="mb-4"
            style="max-width: 200px"
          />
          <v-text-field
            v-else-if="editingAnalysis.psAdjustmentMethod === 'iptw'"
            v-model.number="editingAnalysis.iptwTruncationFraction"
            label="IPTW truncation fraction"
            variant="outlined"
            density="compact"
            rounded="md"
            type="number"
            min="0"
            max="1"
            step="0.01"
            hint="Truncate weights above this percentile (e.g. 0.99)"
            persistent-hint
            class="mb-4"
            style="max-width: 200px"
          />
          <v-select
            v-model="editingAnalysis.outcomeModelType"
            :items="modelTypeItems"
            label="Outcome model type"
            variant="outlined"
            density="compact"
            rounded="md"
            hide-details
            class="mb-4"
          />
          <v-select
            v-model="editingAnalysis.useCleanWindowForPriorOutcomeLookback"
            label="Prior outcome lookback"
            variant="outlined"
            density="compact"
            rounded="md"
            :items="[{ title: 'All time prior (recommended)', value: false }, { title: 'Use clean window', value: true }]"
            hide-details
          />
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

    <!-- Covariate Features Dialog -->
    <v-dialog
      v-model="covFeaturesOpen"
      max-width="700"
      scrollable
    >
      <v-card>
        <v-card-title>Covariate Features</v-card-title>
        <v-divider />
        <v-card-text style="max-height: 70vh">
          <!-- Windows -->
          <div class="text-subtitle-2 mb-2">
            Time Windows
          </div>
          <div class="d-flex ga-3 mb-4">
            <v-text-field
              v-model.number="store.cohortMethodSettings.covariateWindows.longTermStartDays"
              label="Long term start (days)"
              variant="outlined"
              density="compact"
              rounded="md"
              hide-details
              type="number"
              style="max-width: 160px"
            />
            <v-text-field
              v-model.number="store.cohortMethodSettings.covariateWindows.shortTermStartDays"
              label="Short term start (days)"
              variant="outlined"
              density="compact"
              rounded="md"
              hide-details
              type="number"
              style="max-width: 160px"
            />
            <v-text-field
              v-model.number="store.cohortMethodSettings.covariateWindows.endDays"
              label="End (days)"
              variant="outlined"
              density="compact"
              rounded="md"
              hide-details
              type="number"
              style="max-width: 120px"
            />
          </div>

          <!-- Feature groups -->
          <div
            v-for="group in covFeatureGroups"
            :key="group.label"
            class="mb-4"
          >
            <div class="text-subtitle-2 mb-1">
              {{ group.label }}
            </div>
            <div class="d-flex ga-2 flex-wrap">
              <v-checkbox
                v-for="flag in group.flags"
                :key="flag"
                v-model="store.cohortMethodSettings.covariateFeatures[flag]"
                :label="flag"
                density="compact"
                hide-details
                class="mr-2"
              />
            </div>
          </div>
        </v-card-text>
        <v-divider />
        <v-card-actions class="justify-end">
          <v-btn
            variant="tonal"
            @click="covFeaturesOpen = false"
          >
            Done
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
import AdvancedSection from '../../components/AdvancedSection.vue';
import type { CohortMethodAnalysis } from '../../models/ModuleSettings';
import { createDefaultCohortMethodAnalysis } from '../../services/DefaultsFactory';

const props = defineProps<{ embedded?: boolean }>();
const store = useStrategusStore();

const dialogOpen = ref(false);
const editingIdx = ref(-1);
const editingAnalysis = ref<CohortMethodAnalysis | null>(null);
const covFeaturesOpen = ref(false);

const covFeatureGroups = [
  {
    label: 'Demographics',
    flags: [
      'DemographicsGender', 'DemographicsAge', 'DemographicsAgeGroup', 'DemographicsRace',
      'DemographicsEthnicity', 'DemographicsIndexYear', 'DemographicsIndexMonth',
      'DemographicsPriorObservationTime', 'DemographicsPostObservationTime',
      'DemographicsTimeInCohort', 'DemographicsIndexYearMonth',
    ],
  },
  {
    label: 'Conditions',
    flags: ['ConditionGroupEraLongTerm', 'ConditionGroupEraShortTerm'],
  },
  {
    label: 'Drugs',
    flags: ['DrugGroupEraLongTerm', 'DrugGroupEraShortTerm', 'DrugGroupEraOverlapping'],
  },
  {
    label: 'Procedures',
    flags: ['ProcedureOccurrenceLongTerm', 'ProcedureOccurrenceShortTerm'],
  },
  {
    label: 'Devices',
    flags: ['DeviceExposureLongTerm', 'DeviceExposureShortTerm'],
  },
  {
    label: 'Measurements',
    flags: ['MeasurementLongTerm', 'MeasurementShortTerm', 'MeasurementRangeGroupLongTerm'],
  },
  {
    label: 'Observations',
    flags: ['ObservationLongTerm', 'ObservationShortTerm'],
  },
  {
    label: 'Indices',
    flags: ['CharlsonIndex', 'Dcsi', 'Chads2', 'Chads2Vasc'],
  },
  {
    label: 'Visits',
    flags: ['VisitCountLongTerm', 'VisitCountShortTerm', 'VisitConceptCountLongTerm', 'VisitConceptCountShortTerm'],
  },
];

const psMethodItems = [
  { title: 'PS Matching', value: 'matching' },
  { title: 'PS Stratification', value: 'stratification' },
  { title: 'Inverse Probability of Treatment Weighting (IPTW)', value: 'iptw' },
  { title: 'PS Trimming', value: 'trimming' },
  { title: 'No PS adjustment', value: 'none' },
];

const modelTypeItems = [
  { title: 'Cox proportional hazards (time-to-event)', value: 'cox' },
  { title: 'Logistic regression', value: 'logistic' },
  { title: 'Poisson regression', value: 'poisson' },
];

function psMethodLabel(method: CohortMethodAnalysis['psAdjustmentMethod']): string {
  return psMethodItems.find((i) => i.value === method)?.title ?? method;
}

function modelTypeLabel(type: CohortMethodAnalysis['outcomeModelType']): string {
  return modelTypeItems.find((i) => i.value === type)?.title ?? type;
}

function addAnalysis() {
  const cms = store.cohortMethodSettings;
  const nextId = cms.analyses.length > 0
    ? Math.max(...cms.analyses.map((a) => a.analysisId)) + 1
    : 1;
  editingIdx.value = -1;
  editingAnalysis.value = { ...createDefaultCohortMethodAnalysis(nextId) };
  dialogOpen.value = true;
}

function openEditDialog(idx: number) {
  editingIdx.value = idx;
  editingAnalysis.value = { ...store.cohortMethodSettings.analyses[idx] };
  dialogOpen.value = true;
}

function deleteAnalysis(idx: number) {
  store.cohortMethodSettings.analyses.splice(idx, 1);
}

function saveAnalysis() {
  if (!editingAnalysis.value) return;
  const cms = store.cohortMethodSettings;
  if (editingIdx.value === -1) {
    cms.analyses.push({ ...editingAnalysis.value });
  } else {
    cms.analyses[editingIdx.value] = { ...editingAnalysis.value };
  }
  dialogOpen.value = false;
  editingAnalysis.value = null;
}

function parseConceptIds(val: string) {
  const ids = val
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '')
    .map(Number)
    .filter((n) => !isNaN(n) && n > 0);
  store.cohortMethodSettings.includedCovariateConceptIds = ids;
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
