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
        </div>
      </AtlasCard>

      <!-- Empirical calibration -->
      <AtlasCard
        flat
        rounded="lg"
        class="mb-4"
        padding="none"
      >
        <h3 class="card-title text-subtitle-1">
          Calibration
        </h3>
        <AtlasDivider />
        <div class="card-body">
          <AtlasCheckbox
            v-model="store.cohortMethodSettings.useEmpiricalCalibration"
            label="Empirical calibration (requires negative controls)"
          />
          <div
            v-if="store.cohortMethodSettings.useEmpiricalCalibration && store.negativeControls.length === 0"
            class="text-caption text-warning mt-1"
          >
            Add negative controls in Study Design first.
          </div>
        </div>
      </AtlasCard>

      <!-- Advanced -->
      <AdvancedSection>
        <AtlasCard
          flat
          rounded="lg"
          class="mt-2"
          padding="none"
        >
          <div class="card-body">
            <div class="d-flex ga-3 mb-3">
              <AtlasTextField
                v-model.number="store.cohortMethodSettings.maxCohortSizeForFitting"
                label="Max cohort size for fitting"
                type="number"
                style="max-width: 200px"
              />
              <AtlasTextField
                v-model.number="store.cohortMethodSettings.maxCovBalanceCohortSize"
                label="Max cov. balance cohort size"
                type="number"
                style="max-width: 200px"
              />
            </div>
            <div class="d-flex ga-6 mb-4">
              <AtlasCheckbox
                v-model="store.cohortMethodSettings.restrictToCommonPeriod"
                label="Restrict to common period"
              />
              <AtlasCheckbox
                v-model="store.cohortMethodSettings.firstExposureOnly"
                label="First exposure only"
              />
            </div>

            <!-- Custom covariates -->
            <div class="text-subtitle-2 mb-2">
              Custom Covariates
            </div>
            <AtlasTextField
              :model-value="store.cohortMethodSettings.includedCovariateConceptIds.join(', ')"
              label="Included concept IDs (comma-separated)"
              class="mb-3"
              @update:model-value="parseConceptIds($event)"
            />
            <div class="d-flex ga-3 align-center mb-4">
              <AtlasTextField
                v-model="store.cohortMethodSettings.customCovariateGroupName"
                label="Group name"
                style="max-width: 200px"
              />
              <AtlasCheckbox
                v-model="store.cohortMethodSettings.addDescendantsToInclude"
                label="Include descendants"
              />
            </div>

            <!-- Covariate features -->
            <div class="text-subtitle-2 mb-2">
              Covariate Features
            </div>
            <AtlasButton
              size="sm"
              variant="tonal"
              prepend-icon="mdi-tune"
              @click="covFeaturesOpen = true"
            >
              Customize covariate features…
            </AtlasButton>
          </div>
        </AtlasCard>
      </AdvancedSection>
    </div>

    <!-- Analysis Edit Dialog -->
    <AtlasDialog
      v-model="dialogOpen"
      eyebrow="ANALYSIS"
      :title="editingIdx === -1 ? 'New Analysis' : 'Edit Analysis'"
      :max-width="560"
      @close="dialogOpen = false"
    >
      <template v-if="editingAnalysis">
        <AtlasTextField
          v-model="editingAnalysis.description"
          label="Description"
          class="mb-4"
        />
        <AtlasSelect
          v-model="editingAnalysis.psAdjustmentMethod"
          :items="psMethodItems"
          label="PS adjustment method"
          class="mb-4"
        />
        <!-- Method-specific fields -->
        <AtlasTextField
          v-if="editingAnalysis.psAdjustmentMethod === 'matching'"
          v-model.number="editingAnalysis.psMatchMaxRatio"
          label="Matching ratio"
          type="number"
          min="1"
          hint="1 = 1:1. >1 = variable ratio"
          class="mb-4"
          style="max-width: 200px"
        />
        <AtlasTextField
          v-else-if="editingAnalysis.psAdjustmentMethod === 'stratification'"
          v-model.number="editingAnalysis.psStrataCount"
          label="Number of strata"
          type="number"
          min="2"
          class="mb-4"
          style="max-width: 200px"
        />
        <AtlasTextField
          v-else-if="editingAnalysis.psAdjustmentMethod === 'iptw'"
          v-model.number="editingAnalysis.iptwTruncationFraction"
          label="IPTW truncation fraction"
          type="number"
          min="0"
          max="1"
          step="0.01"
          hint="Truncate weights above this percentile (e.g. 0.99)"
          class="mb-4"
          style="max-width: 200px"
        />
        <AtlasSelect
          v-model="editingAnalysis.outcomeModelType"
          :items="modelTypeItems"
          label="Outcome model type"
          class="mb-4"
        />
        <AtlasSelect
          v-model="editingAnalysis.useCleanWindowForPriorOutcomeLookback"
          label="Prior outcome lookback"
          :items="[{ title: 'All time prior (recommended)', value: false }, { title: 'Use clean window', value: true }]"
          class="mb-4"
        />

        <!-- Study population window -->
        <div class="text-subtitle-2 mb-2">
          Study population window
        </div>
        <div class="d-flex ga-3 mb-3">
          <AtlasTextField
            v-model.number="editingAnalysis.riskWindowStart"
            label="Risk window start"
            type="number"
            style="max-width: 160px"
          />
          <AtlasSelect
            v-model="editingAnalysis.startAnchor"
            :items="anchorItems"
            label="Start anchor"
            style="max-width: 200px"
          />
        </div>
        <div class="d-flex ga-3 mb-3">
          <AtlasTextField
            v-model.number="editingAnalysis.riskWindowEnd"
            label="Risk window end"
            type="number"
            style="max-width: 160px"
          />
          <AtlasSelect
            v-model="editingAnalysis.endAnchor"
            :items="anchorItems"
            label="End anchor"
            style="max-width: 200px"
          />
        </div>
        <div class="d-flex ga-3">
          <AtlasTextField
            v-model.number="editingAnalysis.minDaysAtRisk"
            label="Min days at risk"
            type="number"
            style="max-width: 160px"
          />
          <AtlasTextField
            v-model.number="editingAnalysis.priorOutcomeLookback"
            label="Prior outcome lookback (days)"
            type="number"
            style="max-width: 220px"
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

    <!-- Covariate Features Dialog -->
    <AtlasDialog
      v-model="covFeaturesOpen"
      eyebrow="SETTINGS"
      title="Covariate Features"
      :max-width="700"
      @close="covFeaturesOpen = false"
    >
      <!-- Windows -->
      <div class="text-subtitle-2 mb-2">
        Time Windows
      </div>
      <div class="d-flex ga-3 mb-4">
        <AtlasTextField
          v-model.number="store.cohortMethodSettings.covariateWindows.longTermStartDays"
          label="Long term start (days)"
          type="number"
          style="max-width: 160px"
        />
        <AtlasTextField
          v-model.number="store.cohortMethodSettings.covariateWindows.shortTermStartDays"
          label="Short term start (days)"
          type="number"
          style="max-width: 160px"
        />
        <AtlasTextField
          v-model.number="store.cohortMethodSettings.covariateWindows.endDays"
          label="End (days)"
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
          <AtlasCheckbox
            v-for="flag in group.flags"
            :key="flag"
            v-model="store.cohortMethodSettings.covariateFeatures[flag]"
            :label="flag"
            class="mr-2"
          />
        </div>
      </div>
      <template #actions>
        <AtlasButton
          @click="covFeaturesOpen = false"
        >
          Done
        </AtlasButton>
      </template>
    </AtlasDialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { AtlasDialog, AtlasButton, AtlasIconButton, AtlasCard, AtlasDivider, AtlasCheckbox, AtlasTextField, AtlasSelect } from '@ohdsi/atlas-ui';
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

const anchorItems = [
  { title: 'Cohort start', value: 'cohort start' },
  { title: 'Cohort end', value: 'cohort end' },
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

function parseConceptIds(val: string | number) {
  const ids = String(val)
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

.card-title {
  padding: 12px 16px;
  margin: 0;
}

.card-body {
  padding: 16px;
}
</style>
