<template>
  <div>
    <!-- Page header (standalone mode only) -->
    <template v-if="!props.embedded">
      <div class="text-overline text-medium-emphasis">
        Module
      </div>
      <div style="width: 28px; height: 2px; background: #eb6622; margin-bottom: 8px" />
      <h1 class="text-h4 font-weight-light text-primary mb-1">
        Evidence Synthesis
      </h1>
      <p class="text-body-2 text-medium-emphasis mb-4">
        Meta-analysis of estimation results across database sites
      </p>

      <ModuleEnableBanner
        v-if="!store.isModuleEnabled('EvidenceSynthesis')"
        @enable="store.toggleModule('EvidenceSynthesis')"
      />
    </template>

    <v-alert
      type="info"
      variant="tonal"
      density="compact"
      class="mb-4"
    >
      Evidence Synthesis runs on the results database, not the CDM. It combines estimation results (Cohort Method and/or SCCS) from multiple sites into meta-analytic estimates.
    </v-alert>

    <div :class="{ 'module-disabled': !props.embedded && !store.isModuleEnabled('EvidenceSynthesis') }">
      <!-- Synthesis Analyses card -->
      <v-card
        flat
        rounded="lg"
        class="mb-4"
      >
        <v-card-title class="text-subtitle-1 d-flex align-center justify-space-between">
          <span>Synthesis Analyses</span>
          <v-btn
            size="small"
            variant="tonal"
            color="primary"
            prepend-icon="mdi-plus"
            @click="openAddDialog"
          >
            Add Analysis
          </v-btn>
        </v-card-title>
        <v-divider />
        <v-card-text>
          <!-- Empty state -->
          <div
            v-if="store.evidenceSynthesisSettings.analyses.length === 0"
            class="d-flex flex-column align-center py-8 text-medium-emphasis"
          >
            <v-icon
              size="48"
              class="mb-2"
            >
              mdi-chart-scatter-plot
            </v-icon>
            <span>No synthesis analyses added yet</span>
          </div>

          <!-- Analysis list -->
          <template v-else>
            <v-card
              v-for="(analysis, idx) in store.evidenceSynthesisSettings.analyses"
              :key="analysis.evidenceSynthesisAnalysisId"
              flat
              outlined
              rounded="lg"
              class="mb-2 pa-3"
              style="border: 1px solid rgba(0,0,0,0.12)"
            >
              <div class="d-flex align-center justify-space-between">
                <div>
                  <v-chip
                    size="small"
                    class="mb-1"
                  >
                    {{ analysis.description }}
                  </v-chip>
                  <div class="text-body-2 text-medium-emphasis">
                    Type: {{ analysis.analysisType }} · Source: {{ analysis.sourceMethod }} · Control: {{ analysis.controlType }} · Approximation: {{ analysis.likelihoodApproximation }}
                  </div>
                </div>
                <v-btn
                  icon="mdi-delete"
                  size="small"
                  variant="text"
                  color="error"
                  @click="store.evidenceSynthesisSettings.analyses.splice(idx, 1)"
                />
              </div>
            </v-card>
          </template>
        </v-card-text>
      </v-card>

      <!-- Advanced -->
      <AdvancedSection>
        <v-card
          flat
          rounded="lg"
          class="mt-2"
        >
          <v-card-title class="text-subtitle-2 text-medium-emphasis pt-3 px-4">
            Diagnostic Thresholds
          </v-card-title>
          <v-card-text>
            <!-- Row 1 -->
            <div class="d-flex ga-3">
              <v-text-field
                v-model.number="store.evidenceSynthesisSettings.mdrrThreshold"
                label="MDRR threshold"
                variant="outlined"
                density="compact"
                rounded="md"
                hide-details
                type="number"
                step="0.01"
                style="max-width: 150px"
              />
              <v-text-field
                v-model.number="store.evidenceSynthesisSettings.easeThreshold"
                label="EASE threshold"
                variant="outlined"
                density="compact"
                rounded="md"
                hide-details
                type="number"
                step="0.01"
                style="max-width: 150px"
              />
              <v-text-field
                v-model.number="store.evidenceSynthesisSettings.i2Threshold"
                label="I² threshold"
                variant="outlined"
                density="compact"
                rounded="md"
                hide-details
                type="number"
                step="0.01"
                style="max-width: 150px"
              />
            </div>
            <!-- Row 2 -->
            <div class="d-flex ga-3 mt-3">
              <v-text-field
                v-model.number="store.evidenceSynthesisSettings.tauThreshold"
                label="Tau threshold"
                variant="outlined"
                density="compact"
                rounded="md"
                hide-details
                type="number"
                step="0.01"
                style="max-width: 150px"
              />
              <v-text-field
                v-model.number="store.evidenceSynthesisSettings.alpha"
                label="Alpha"
                variant="outlined"
                density="compact"
                rounded="md"
                hide-details
                type="number"
                step="0.001"
                style="max-width: 120px"
              />
            </div>
          </v-card-text>
        </v-card>
      </AdvancedSection>
    </div>

    <!-- Add Analysis Dialog -->
    <AtlasDialog
      v-model="addDialog"
      eyebrow="SYNTHESIS"
      title="Add Synthesis Analysis"
      :max-width="480"
      @close="addDialog = false"
    >
      <v-text-field
        v-model="newAnalysis.description"
        label="Description"
        variant="outlined"
        density="compact"
        rounded="md"
        class="mb-3"
      />
      <v-select
        v-model="newAnalysis.analysisType"
        label="Analysis type"
        variant="outlined"
        density="compact"
        rounded="md"
        :items="[
          { title: 'Random Effects', value: 'RandomEffects' },
          { title: 'Fixed Effects', value: 'FixedEffects' },
          { title: 'Bayesian', value: 'Bayesian' },
        ]"
        class="mb-3"
      />
      <v-select
        v-model="newAnalysis.sourceMethod"
        label="Source method"
        variant="outlined"
        density="compact"
        rounded="md"
        :items="[
          { title: 'Cohort Method', value: 'CohortMethod' },
          { title: 'Self-Controlled Case Series', value: 'SelfControlledCaseSeries' },
        ]"
        class="mb-3"
      />
      <v-select
        v-model="newAnalysis.likelihoodApproximation"
        label="Likelihood approximation"
        variant="outlined"
        density="compact"
        rounded="md"
        :items="[
          { title: 'Adaptive Grid', value: 'adaptive grid' },
          { title: 'Normal', value: 'normal' },
        ]"
        class="mb-3"
      />
      <v-select
        v-model="newAnalysis.controlType"
        label="Control type"
        variant="outlined"
        density="compact"
        rounded="md"
        :items="[
          { title: 'Outcome', value: 'outcome' },
          { title: 'Exposure', value: 'exposure' },
        ]"
        class="mb-3"
      />
      <v-text-field
        v-model.number="newAnalysis.alpha"
        label="Alpha"
        variant="outlined"
        density="compact"
        rounded="md"
        type="number"
        step="0.001"
        class="mb-3"
      />
      <template v-if="newAnalysis.analysisType === 'Bayesian'">
        <div class="text-caption text-medium-emphasis mb-2">
          Bayesian Settings
        </div>
        <div class="d-flex ga-3 mb-3">
          <v-text-field
            v-model.number="newAnalysis.chainLength"
            label="Chain length"
            variant="outlined"
            density="compact"
            rounded="md"
            type="number"
            hide-details
          />
          <v-text-field
            v-model.number="newAnalysis.burnIn"
            label="Burn-in"
            variant="outlined"
            density="compact"
            rounded="md"
            type="number"
            hide-details
          />
        </div>
        <div class="d-flex ga-3 mb-3">
          <v-text-field
            v-model.number="newAnalysis.subSampleFrequency"
            label="Subsample frequency"
            variant="outlined"
            density="compact"
            rounded="md"
            type="number"
            hide-details
          />
          <v-text-field
            v-model.number="newAnalysis.seed"
            label="Seed"
            variant="outlined"
            density="compact"
            rounded="md"
            type="number"
            hide-details
          />
        </div>
        <div class="d-flex ga-3 mb-3">
          <v-text-field
            v-model.number="newAnalysis.df"
            label="Degrees of freedom"
            variant="outlined"
            density="compact"
            rounded="md"
            type="number"
            hide-details
          />
          <v-checkbox
            v-model="newAnalysis.robust"
            label="Robust"
            density="compact"
            hide-details
          />
        </div>
      </template>
      <template #actions>
        <AtlasButton
          variant="ghost"
          @click="addDialog = false"
        >
          Cancel
        </AtlasButton>
        <AtlasButton
          @click="addAnalysis"
        >
          Add
        </AtlasButton>
      </template>
    </AtlasDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { AtlasDialog, AtlasButton } from '@ohdsi/atlas-ui';
import { useStrategusStore } from '../../store/useStrategusStore';
import ModuleEnableBanner from '../../components/ModuleEnableBanner.vue';
import AdvancedSection from '../../components/AdvancedSection.vue';
import type { EvidenceSynthesisAnalysis } from '../../models/ModuleSettings';

const props = defineProps<{ embedded?: boolean }>();
const store = useStrategusStore();

const addDialog = ref(false);

const BAYESIAN_DEFAULTS = {
  chainLength: 1100000,
  burnIn: 100000,
  subSampleFrequency: 100,
  priorSd: [2, 0.5] as [number, number],
  robust: false,
  df: 4,
  seed: 1,
};

const defaultNewAnalysis = (): Omit<EvidenceSynthesisAnalysis, 'evidenceSynthesisAnalysisId'> => ({
  description: 'Random-effects meta-analysis',
  analysisType: 'RandomEffects',
  sourceMethod: 'CohortMethod',
  likelihoodApproximation: 'adaptive grid',
  controlType: 'outcome',
  alpha: 0.05,
});

const newAnalysis = reactive<Omit<EvidenceSynthesisAnalysis, 'evidenceSynthesisAnalysisId'> & {
  chainLength?: number;
  burnIn?: number;
  subSampleFrequency?: number;
  priorSd?: [number, number];
  robust?: boolean;
  df?: number;
  seed?: number;
}>(defaultNewAnalysis());

function openAddDialog() {
  Object.assign(newAnalysis, defaultNewAnalysis());
  addDialog.value = true;
}

function addAnalysis() {
  const analyses = store.evidenceSynthesisSettings.analyses;
  const maxId = analyses.length > 0 ? Math.max(...analyses.map(a => a.evidenceSynthesisAnalysisId)) : 0;
  const entry: EvidenceSynthesisAnalysis = {
    evidenceSynthesisAnalysisId: maxId + 1,
    description: newAnalysis.description,
    analysisType: newAnalysis.analysisType,
    sourceMethod: newAnalysis.sourceMethod,
    likelihoodApproximation: newAnalysis.likelihoodApproximation,
    controlType: newAnalysis.controlType,
    alpha: newAnalysis.alpha,
  };
  if (newAnalysis.analysisType === 'Bayesian') {
    const defaults = BAYESIAN_DEFAULTS;
    entry.chainLength = newAnalysis.chainLength ?? defaults.chainLength;
    entry.burnIn = newAnalysis.burnIn ?? defaults.burnIn;
    entry.subSampleFrequency = newAnalysis.subSampleFrequency ?? defaults.subSampleFrequency;
    entry.priorSd = newAnalysis.priorSd ?? defaults.priorSd;
    entry.robust = newAnalysis.robust ?? defaults.robust;
    entry.df = newAnalysis.df ?? defaults.df;
    entry.seed = newAnalysis.seed ?? defaults.seed;
  }
  analyses.push(entry);
  addDialog.value = false;
}
</script>

<style scoped>
.module-disabled {
  opacity: 0.5;
  pointer-events: none;
}
</style>
