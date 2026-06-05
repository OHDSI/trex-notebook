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

    <AtlasAlert
      severity="info"
      variant="tonal"
      class="mb-4"
    >
      Evidence Synthesis runs on the results database, not the CDM. It combines estimation results (Cohort Method and/or SCCS) from multiple sites into meta-analytic estimates.
    </AtlasAlert>

    <div :class="{ 'module-disabled': !props.embedded && !store.isModuleEnabled('EvidenceSynthesis') }">
      <!-- Synthesis Analyses card -->
      <AtlasCard
        flat
        rounded="lg"
        class="mb-4"
        padding="none"
      >
        <h3 class="card-title text-subtitle-1 d-flex align-center justify-space-between">
          <span>Synthesis Analyses</span>
          <AtlasButton
            size="sm"
            variant="tonal"
            prepend-icon="mdi-plus"
            @click="openAddDialog"
          >
            Add Analysis
          </AtlasButton>
        </h3>
        <AtlasDivider />
        <div class="card-body">
          <!-- Empty state -->
          <div
            v-if="store.evidenceSynthesisSettings.analyses.length === 0"
            class="d-flex flex-column align-center py-8 text-medium-emphasis"
          >
            <AtlasIcon
              size="48"
              class="mb-2"
            >
              mdi-chart-scatter-plot
            </AtlasIcon>
            <span>No synthesis analyses added yet</span>
          </div>

          <!-- Analysis list -->
          <template v-else>
            <AtlasCard
              v-for="(analysis, idx) in store.evidenceSynthesisSettings.analyses"
              :key="analysis.evidenceSynthesisAnalysisId"
              flat
              rounded="lg"
              class="mb-2"
              padding="sm"
              style="border: 1px solid rgba(0,0,0,0.12)"
            >
              <div class="d-flex align-center justify-space-between">
                <div>
                  <AtlasChip
                    size="sm"
                    class="mb-1"
                  >
                    {{ analysis.description }}
                  </AtlasChip>
                  <div class="text-body-2 text-medium-emphasis">
                    Type: {{ analysis.analysisType }} · Source: {{ analysis.sourceMethod }} · Control: {{ analysis.controlType }} · Approximation: {{ analysis.likelihoodApproximation }}
                  </div>
                </div>
                <AtlasIconButton
                  icon="mdi-delete"
                  size="sm"
                  variant="text"
                  tone="danger"
                  ariaLabel="Delete analysis"
                  @click="store.evidenceSynthesisSettings.analyses.splice(idx, 1)"
                />
              </div>
            </AtlasCard>
          </template>
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
          <h3 class="card-title text-subtitle-2 text-medium-emphasis pt-3 px-4">
            Diagnostic Thresholds
          </h3>
          <div class="card-body">
            <!-- Row 1 -->
            <div class="d-flex ga-3">
              <AtlasTextField
                v-model.number="store.evidenceSynthesisSettings.mdrrThreshold"
                label="MDRR threshold"
                type="number"
                step="0.01"
                style="max-width: 150px"
              />
              <AtlasTextField
                v-model.number="store.evidenceSynthesisSettings.easeThreshold"
                label="EASE threshold"
                type="number"
                step="0.01"
                style="max-width: 150px"
              />
              <AtlasTextField
                v-model.number="store.evidenceSynthesisSettings.i2Threshold"
                label="I² threshold"
                type="number"
                step="0.01"
                style="max-width: 150px"
              />
            </div>
            <!-- Row 2 -->
            <div class="d-flex ga-3 mt-3">
              <AtlasTextField
                v-model.number="store.evidenceSynthesisSettings.tauThreshold"
                label="Tau threshold"
                type="number"
                step="0.01"
                style="max-width: 150px"
              />
              <AtlasTextField
                v-model.number="store.evidenceSynthesisSettings.alpha"
                label="Alpha"
                type="number"
                step="0.001"
                style="max-width: 120px"
              />
            </div>
          </div>
        </AtlasCard>
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
      <AtlasTextField
        v-model="newAnalysis.description"
        label="Description"
        class="mb-3"
      />
      <AtlasSelect
        v-model="newAnalysis.analysisType"
        label="Analysis type"
        :items="[
          { title: 'Random Effects', value: 'RandomEffects' },
          { title: 'Fixed Effects', value: 'FixedEffects' },
          { title: 'Bayesian', value: 'Bayesian' },
        ]"
        class="mb-3"
      />
      <AtlasSelect
        v-model="newAnalysis.sourceMethod"
        label="Source method"
        :items="[
          { title: 'Cohort Method', value: 'CohortMethod' },
          { title: 'Self-Controlled Case Series', value: 'SelfControlledCaseSeries' },
        ]"
        class="mb-3"
      />
      <AtlasSelect
        v-model="newAnalysis.likelihoodApproximation"
        label="Likelihood approximation"
        :items="[
          { title: 'Adaptive Grid', value: 'adaptive grid' },
          { title: 'Normal', value: 'normal' },
        ]"
        class="mb-3"
      />
      <AtlasSelect
        v-model="newAnalysis.controlType"
        label="Control type"
        :items="[
          { title: 'Outcome', value: 'outcome' },
          { title: 'Exposure', value: 'exposure' },
        ]"
        class="mb-3"
      />
      <AtlasTextField
        v-model.number="newAnalysis.alpha"
        label="Alpha"
        type="number"
        step="0.001"
        class="mb-3"
      />
      <template v-if="newAnalysis.analysisType === 'Bayesian'">
        <div class="text-caption text-medium-emphasis mb-2">
          Bayesian Settings
        </div>
        <div class="d-flex ga-3 mb-3">
          <AtlasTextField
            v-model.number="newAnalysis.chainLength"
            label="Chain length"
            type="number"
          />
          <AtlasTextField
            v-model.number="newAnalysis.burnIn"
            label="Burn-in"
            type="number"
          />
        </div>
        <div class="d-flex ga-3 mb-3">
          <AtlasTextField
            v-model.number="newAnalysis.subSampleFrequency"
            label="Subsample frequency"
            type="number"
          />
          <AtlasTextField
            v-model.number="newAnalysis.seed"
            label="Seed"
            type="number"
          />
        </div>
        <div class="d-flex ga-3 mb-3">
          <AtlasTextField
            v-model.number="newAnalysis.df"
            label="Degrees of freedom"
            type="number"
          />
          <AtlasCheckbox
            v-model="newAnalysis.robust"
            label="Robust"
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
import { AtlasDialog, AtlasButton, AtlasCard, AtlasDivider, AtlasAlert, AtlasIcon, AtlasChip, AtlasTextField, AtlasSelect, AtlasCheckbox, AtlasIconButton } from '@ohdsi/atlas-ui';
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
.card-title {
  padding: 12px 16px 12px;
  margin: 0;
}
.card-body {
  padding: 16px;
}
</style>
