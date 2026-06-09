<template>
  <div>
    <!-- Page header (standalone mode only) -->
    <template v-if="!props.embedded">
      <div class="text-overline text-medium-emphasis">
        Module
      </div>
      <div style="width: 28px; height: 2px; background: #eb6622; margin-bottom: 8px" />
      <h1 class="text-h4 font-weight-light text-primary mb-1">
        Patient-Level Prediction
      </h1>
      <p class="text-body-2 text-medium-emphasis mb-4">
        Develop patient-level prediction models using machine learning
      </p>

      <ModuleEnableBanner
        v-if="!store.isModuleEnabled('PLP')"
        @enable="store.toggleModule('PLP')"
      />
    </template>

    <div :class="{ 'module-disabled': !props.embedded && !store.isModuleEnabled('PLP') }">
      <!-- Model Design card -->
      <AtlasCard
        flat
        rounded="lg"
        class="mb-4"
        padding="none"
      >
        <h3 class="card-title text-subtitle-1">
          Model Design
        </h3>
        <AtlasDivider />
        <div class="card-body">
          <AtlasSelect
            v-model="store.plpSettings.modelType"
            label="Model type"
            :items="[
              { title: 'LASSO Logistic Regression', value: 'lassoLogisticRegression' },
              { title: 'Gradient Boosting', value: 'gradientBoosting' },
              { title: 'Random Forest', value: 'randomForest' },
              { title: 'AdaBoost', value: 'adaBoost' },
              { title: 'Decision Tree', value: 'decisionTree' },
              { title: 'MLP Neural Network', value: 'mlp' },
            ]"
            style="max-width: 320px"
          />
          <AtlasAlert
            severity="info"
            variant="tonal"
            class="mt-3"
          >
            One model design is created per target × outcome × time-at-risk combination.
          </AtlasAlert>
        </div>
      </AtlasCard>

      <!-- Covariate Features card -->
      <AtlasCard
        flat
        rounded="lg"
        class="mb-4"
        padding="none"
      >
        <h3 class="card-title text-subtitle-1">
          Covariate Features
        </h3>
        <AtlasDivider />
        <div class="card-body">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px">
            <AtlasCheckbox
              v-model="store.plpSettings.useDemographicsGender"
              label="Demographics: Gender"
            />
            <AtlasCheckbox
              v-model="store.plpSettings.useDemographicsAgeGroup"
              label="Demographics: Age group"
            />
            <AtlasCheckbox
              v-model="store.plpSettings.useConditionGroupEraLongTerm"
              label="Conditions: Group era (long term)"
            />
            <AtlasCheckbox
              v-model="store.plpSettings.useDrugGroupEraLongTerm"
              label="Drugs: Group era (long term)"
            />
            <AtlasCheckbox
              v-model="store.plpSettings.useVisitConceptCountLongTerm"
              label="Visits: Concept count (long term)"
            />
            <AtlasCheckbox
              v-model="store.plpSettings.useProcedureGroupEraLongTerm"
              label="Procedures: Group era (long term)"
            />
            <AtlasCheckbox
              v-model="store.plpSettings.useMeasurementValueLongTerm"
              label="Measurements: Value (long term)"
            />
            <AtlasCheckbox
              v-model="store.plpSettings.useObservationEraLongTerm"
              label="Observations: Era (long term)"
            />
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
            <div class="d-flex ga-3">
              <AtlasTextField
                v-model.number="store.plpSettings.maxSampleSize"
                label="Max sample size"
                type="number"
                style="max-width: 180px"
              />
              <AtlasTextField
                v-model.number="store.plpSettings.testFraction"
                label="Test fraction"
                type="number"
                step="0.05"
                style="max-width: 130px"
              />
              <AtlasTextField
                v-model.number="store.plpSettings.nfold"
                label="N-fold"
                type="number"
                style="max-width: 100px"
              />
            </div>

            <div class="text-subtitle-2 text-medium-emphasis mt-4 mb-2">
              Preprocessing
            </div>

            <div class="d-flex ga-3 align-center">
              <AtlasTextField
                v-model.number="store.plpSettings.minFraction"
                label="Min fraction"
                type="number"
                step="0.001"
                style="max-width: 130px"
              />
              <AtlasCheckbox
                v-model="store.plpSettings.normalize"
                label="Normalize"
              />
              <AtlasCheckbox
                v-model="store.plpSettings.removeRedundancy"
                label="Remove redundancy"
              />
            </div>

            <div class="text-subtitle-2 text-medium-emphasis mt-4 mb-2">
              Population Settings
            </div>

            <div class="d-flex ga-6">
              <AtlasCheckbox
                v-model="store.plpSettings.removeSubjectsWithPriorOutcome"
                label="Remove subjects with prior outcome"
              />
              <AtlasCheckbox
                v-model="store.plpSettings.requireTimeAtRisk"
                label="Require time at risk"
              />
            </div>

            <div class="d-flex ga-3 mt-3">
              <AtlasTextField
                v-model.number="store.plpSettings.washoutPeriod"
                label="Washout period"
                type="number"
                style="max-width: 150px"
              />
              <AtlasTextField
                v-model.number="store.plpSettings.priorOutcomeLookback"
                label="Prior outcome lookback"
                type="number"
                style="max-width: 150px"
              />
              <AtlasSelect
                v-model="store.plpSettings.splitType"
                label="Split type"
                :items="[
                  { title: 'By subject', value: 'subject' },
                  { title: 'By time', value: 'time' },
                  { title: 'Stratified', value: 'stratified' },
                ]"
                style="max-width: 180px"
              />
            </div>

            <div class="text-subtitle-2 text-medium-emphasis mt-4 mb-2">
              Sampling
            </div>

            <div class="d-flex ga-3 align-center">
              <AtlasSelect
                v-model="store.plpSettings.samplingStrategy"
                label="Sampling strategy"
                :items="[
                  { title: 'None', value: 'none' },
                  { title: 'Under-sample non-outcomes', value: 'underSample' },
                  { title: 'Over-sample outcomes', value: 'overSample' },
                ]"
                style="max-width: 260px"
              />
              <AtlasTextField
                v-if="store.plpSettings.samplingStrategy !== 'none'"
                v-model.number="store.plpSettings.samplingNumberOutcomesToSampleTo"
                label="Target outcome count"
                type="number"
                style="max-width: 200px"
              />
            </div>

            <div class="text-subtitle-2 text-medium-emphasis mt-4 mb-2">
              Calibration
            </div>

            <div class="d-flex ga-3 align-center">
              <AtlasCheckbox
                v-model="store.plpSettings.runCalibration"
                label="Run calibration"
              />
              <AtlasTextField
                v-model.number="store.plpSettings.calibrationBins"
                label="Calibration bins"
                type="number"
                style="max-width: 150px"
                :disabled="!store.plpSettings.runCalibration"
              />
            </div>

            <div class="text-subtitle-2 text-medium-emphasis mt-4 mb-2">
              Execution
            </div>

            <div class="d-flex flex-wrap ga-6">
              <AtlasCheckbox
                v-model="store.plpSettings.runFeatureEngineering"
                label="Run feature engineering"
              />
              <AtlasCheckbox
                v-model="store.plpSettings.runSampleData"
                label="Run sample data"
              />
              <AtlasCheckbox
                v-model="store.plpSettings.runPreprocessData"
                label="Run preprocess data"
              />
              <AtlasCheckbox
                v-model="store.plpSettings.runModelDevelopment"
                label="Run model development"
              />
              <AtlasCheckbox
                v-model="store.plpSettings.runCovariateSummary"
                label="Run covariate summary"
              />
              <AtlasCheckbox
                v-model="store.plpSettings.skipDiagnostics"
                label="Skip diagnostics"
              />
            </div>
          </div>
        </AtlasCard>
      </AdvancedSection>
    </div>
  </div>
</template>

<script setup lang="ts">
import { AtlasCard, AtlasDivider, AtlasSelect, AtlasAlert, AtlasCheckbox, AtlasTextField } from '@ohdsi/atlas-ui';
import { useStrategusStore } from '../../store/useStrategusStore';
import ModuleEnableBanner from '../../components/ModuleEnableBanner.vue';
import AdvancedSection from '../../components/AdvancedSection.vue';

const props = defineProps<{ embedded?: boolean }>();
const store = useStrategusStore();
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
