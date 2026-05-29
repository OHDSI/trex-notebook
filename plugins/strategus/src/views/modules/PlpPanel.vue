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
      <v-card
        flat
        rounded="lg"
        class="mb-4"
      >
        <v-card-title class="text-subtitle-1">
          Model Design
        </v-card-title>
        <v-divider />
        <v-card-text>
          <v-select
            v-model="store.plpSettings.modelType"
            label="Model type"
            variant="outlined"
            density="compact"
            rounded="md"
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
          <v-alert
            type="info"
            variant="tonal"
            density="compact"
            class="mt-3"
          >
            One model design is created per target × outcome × time-at-risk combination.
          </v-alert>
        </v-card-text>
      </v-card>

      <!-- Covariate Features card -->
      <v-card
        flat
        rounded="lg"
        class="mb-4"
      >
        <v-card-title class="text-subtitle-1">
          Covariate Features
        </v-card-title>
        <v-divider />
        <v-card-text>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px">
            <v-checkbox
              v-model="store.plpSettings.useDemographicsGender"
              label="Demographics: Gender"
              density="compact"
              hide-details
            />
            <v-checkbox
              v-model="store.plpSettings.useDemographicsAgeGroup"
              label="Demographics: Age group"
              density="compact"
              hide-details
            />
            <v-checkbox
              v-model="store.plpSettings.useConditionGroupEraLongTerm"
              label="Conditions: Group era (long term)"
              density="compact"
              hide-details
            />
            <v-checkbox
              v-model="store.plpSettings.useDrugGroupEraLongTerm"
              label="Drugs: Group era (long term)"
              density="compact"
              hide-details
            />
            <v-checkbox
              v-model="store.plpSettings.useVisitConceptCountLongTerm"
              label="Visits: Concept count (long term)"
              density="compact"
              hide-details
            />
            <v-checkbox
              v-model="store.plpSettings.useProcedureGroupEraLongTerm"
              label="Procedures: Group era (long term)"
              density="compact"
              hide-details
            />
            <v-checkbox
              v-model="store.plpSettings.useMeasurementValueLongTerm"
              label="Measurements: Value (long term)"
              density="compact"
              hide-details
            />
            <v-checkbox
              v-model="store.plpSettings.useObservationEraLongTerm"
              label="Observations: Era (long term)"
              density="compact"
              hide-details
            />
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
            <div class="d-flex ga-3">
              <v-text-field
                v-model.number="store.plpSettings.maxSampleSize"
                label="Max sample size"
                variant="outlined"
                density="compact"
                rounded="md"
                hide-details
                type="number"
                style="max-width: 180px"
              />
              <v-text-field
                v-model.number="store.plpSettings.testFraction"
                label="Test fraction"
                variant="outlined"
                density="compact"
                rounded="md"
                hide-details
                type="number"
                step="0.05"
                style="max-width: 130px"
              />
              <v-text-field
                v-model.number="store.plpSettings.nfold"
                label="N-fold"
                variant="outlined"
                density="compact"
                rounded="md"
                hide-details
                type="number"
                style="max-width: 100px"
              />
            </div>

            <div class="text-subtitle-2 text-medium-emphasis mt-4 mb-2">
              Preprocessing
            </div>

            <div class="d-flex ga-3 align-center">
              <v-text-field
                v-model.number="store.plpSettings.minFraction"
                label="Min fraction"
                variant="outlined"
                density="compact"
                rounded="md"
                hide-details
                type="number"
                step="0.001"
                style="max-width: 130px"
              />
              <v-checkbox
                v-model="store.plpSettings.normalize"
                label="Normalize"
                density="compact"
                hide-details
              />
              <v-checkbox
                v-model="store.plpSettings.removeRedundancy"
                label="Remove redundancy"
                density="compact"
                hide-details
              />
            </div>

            <div class="text-subtitle-2 text-medium-emphasis mt-4 mb-2">
              Population Settings
            </div>

            <div class="d-flex ga-6">
              <v-checkbox
                v-model="store.plpSettings.removeSubjectsWithPriorOutcome"
                label="Remove subjects with prior outcome"
                density="compact"
                hide-details
              />
              <v-checkbox
                v-model="store.plpSettings.requireTimeAtRisk"
                label="Require time at risk"
                density="compact"
                hide-details
              />
            </div>

            <div class="d-flex ga-3 mt-3">
              <v-text-field
                v-model.number="store.plpSettings.washoutPeriod"
                label="Washout period"
                variant="outlined"
                density="compact"
                rounded="md"
                hide-details
                type="number"
                style="max-width: 150px"
              />
              <v-text-field
                v-model.number="store.plpSettings.priorOutcomeLookback"
                label="Prior outcome lookback"
                variant="outlined"
                density="compact"
                rounded="md"
                hide-details
                type="number"
                style="max-width: 150px"
              />
              <v-select
                v-model="store.plpSettings.splitType"
                label="Split type"
                variant="outlined"
                density="compact"
                rounded="md"
                hide-details
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
              <v-select
                v-model="store.plpSettings.samplingStrategy"
                label="Sampling strategy"
                variant="outlined"
                density="compact"
                rounded="md"
                hide-details
                :items="[
                  { title: 'None', value: 'none' },
                  { title: 'Under-sample non-outcomes', value: 'underSample' },
                  { title: 'Over-sample outcomes', value: 'overSample' },
                ]"
                style="max-width: 260px"
              />
              <v-text-field
                v-if="store.plpSettings.samplingStrategy !== 'none'"
                v-model.number="store.plpSettings.samplingNumberOutcomesToSampleTo"
                label="Target outcome count"
                variant="outlined"
                density="compact"
                rounded="md"
                hide-details
                type="number"
                style="max-width: 200px"
              />
            </div>

            <div class="text-subtitle-2 text-medium-emphasis mt-4 mb-2">
              Calibration
            </div>

            <div class="d-flex ga-3 align-center">
              <v-checkbox
                v-model="store.plpSettings.runCalibration"
                label="Run calibration"
                density="compact"
                hide-details
              />
              <v-text-field
                v-model.number="store.plpSettings.calibrationBins"
                label="Calibration bins"
                variant="outlined"
                density="compact"
                rounded="md"
                hide-details
                type="number"
                style="max-width: 150px"
                :disabled="!store.plpSettings.runCalibration"
              />
            </div>
          </v-card-text>
        </v-card>
      </AdvancedSection>
    </div>
  </div>
</template>

<script setup lang="ts">
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
</style>
