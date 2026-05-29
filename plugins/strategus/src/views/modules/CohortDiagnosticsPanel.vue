<template>
  <div>
    <!-- Page header (standalone mode only) -->
    <template v-if="!props.embedded">
      <div class="text-overline text-medium-emphasis">
        Module
      </div>
      <div style="width: 28px; height: 2px; background: #eb6622; margin-bottom: 8px" />
      <h1 class="text-h4 font-weight-light text-primary mb-1">
        Cohort Diagnostics
      </h1>
      <p class="text-body-2 text-medium-emphasis mb-4">
        Phenotype evaluation for all cohorts
      </p>

      <ModuleEnableBanner
        v-if="!store.isModuleEnabled('CohortDiagnostics')"
        @enable="store.toggleModule('CohortDiagnostics')"
      />
    </template>

    <div :class="{ 'module-disabled': !props.embedded && !store.isModuleEnabled('CohortDiagnostics') }">
      <!-- Diagnostics to Run card -->
      <v-card
        flat
        rounded="lg"
        class="mb-4"
      >
        <v-card-title class="text-subtitle-1">
          Diagnostics to Run
        </v-card-title>
        <v-divider />
        <v-card-text>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px">
            <v-checkbox
              v-model="store.cohortDiagnosticsSettings.runInclusionStatistics"
              label="Inclusion statistics"
              density="compact"
              hide-details
            />
            <v-checkbox
              v-model="store.cohortDiagnosticsSettings.runIncludedSourceConcepts"
              label="Included source concepts"
              density="compact"
              hide-details
            />
            <v-checkbox
              v-model="store.cohortDiagnosticsSettings.runOrphanConcepts"
              label="Orphan concepts"
              density="compact"
              hide-details
            />
            <v-checkbox
              v-model="store.cohortDiagnosticsSettings.runTimeSeries"
              label="Time series"
              density="compact"
              hide-details
            />
            <v-checkbox
              v-model="store.cohortDiagnosticsSettings.runVisitContext"
              label="Visit context"
              density="compact"
              hide-details
            />
            <v-checkbox
              v-model="store.cohortDiagnosticsSettings.runBreakdownIndexEvents"
              label="Breakdown index events"
              density="compact"
              hide-details
            />
            <v-checkbox
              v-model="store.cohortDiagnosticsSettings.runIncidenceRate"
              label="Incidence rate"
              density="compact"
              hide-details
            />
            <v-checkbox
              v-model="store.cohortDiagnosticsSettings.runCohortRelationship"
              label="Cohort relationship"
              density="compact"
              hide-details
            />
            <v-checkbox
              v-model="store.cohortDiagnosticsSettings.runTemporalCohortCharacterization"
              label="Temporal characterization"
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
                v-model.number="store.cohortDiagnosticsSettings.minCharacterizationMean"
                label="Min characterization mean"
                variant="outlined"
                density="compact"
                rounded="md"
                hide-details
                type="number"
                step="0.01"
                style="max-width: 200px"
              />
              <v-text-field
                v-model.number="store.cohortDiagnosticsSettings.irWashoutPeriod"
                label="IR washout period"
                variant="outlined"
                density="compact"
                rounded="md"
                hide-details
                type="number"
                style="max-width: 200px"
              />
            </div>

            <!-- Cohort filter -->
            <div class="text-subtitle-2 text-medium-emphasis mt-4 mb-2">
              Cohort Filter
            </div>
            <v-select
              v-model="(store.cohortDiagnosticsSettings as CohortDiagnosticsSettings).cohortIds"
              :items="store.cohorts.map(c => ({ title: c.cohortName, value: c.cohortId }))"
              label="Cohorts to diagnose (empty = all)"
              variant="outlined"
              density="compact"
              rounded="md"
              multiple
              chips
              clearable
              style="max-width: 480px"
              hint="Leave empty to run on all cohorts"
              persistent-hint
            />

            <div class="text-subtitle-2 text-medium-emphasis mt-4 mb-2">
              Temporal Covariate Windows
            </div>

            <div class="d-flex ga-3 flex-column">
              <v-text-field
                v-model="temporalStartDaysStr"
                label="Start days"
                variant="outlined"
                density="compact"
                rounded="md"
                style="max-width: 400px"
                hint="Comma-separated days relative to index date."
                persistent-hint
              />
              <v-text-field
                v-model="temporalEndDaysStr"
                label="End days"
                variant="outlined"
                density="compact"
                rounded="md"
                style="max-width: 400px"
                hint="Comma-separated days relative to index date."
                persistent-hint
              />
            </div>

            <!-- Temporal covariate features -->
            <div class="text-subtitle-2 text-medium-emphasis mt-4 mb-2">
              Temporal Covariate Features
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px">
              <v-checkbox
                v-for="(_, key) in (store.cohortDiagnosticsSettings as CohortDiagnosticsSettings).temporalCovariateFeatures"
                :key="key"
                v-model="(store.cohortDiagnosticsSettings as CohortDiagnosticsSettings).temporalCovariateFeatures[key]"
                :label="key"
                density="compact"
                hide-details
              />
            </div>
          </v-card-text>
        </v-card>
      </AdvancedSection>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useStrategusStore } from '../../store/useStrategusStore';
import ModuleEnableBanner from '../../components/ModuleEnableBanner.vue';
import AdvancedSection from '../../components/AdvancedSection.vue';
import type { CohortDiagnosticsSettings } from '../../models/ModuleSettings';

const props = defineProps<{ embedded?: boolean }>();
const store = useStrategusStore();

const temporalStartDaysStr = computed({
  get: () => (store.cohortDiagnosticsSettings as CohortDiagnosticsSettings).temporalStartDays.join(', '),
  set: (v: string) => {
    (store.cohortDiagnosticsSettings as CohortDiagnosticsSettings).temporalStartDays = v.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
  },
});

const temporalEndDaysStr = computed({
  get: () => (store.cohortDiagnosticsSettings as CohortDiagnosticsSettings).temporalEndDays.join(', '),
  set: (v: string) => {
    (store.cohortDiagnosticsSettings as CohortDiagnosticsSettings).temporalEndDays = v.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
  },
});
</script>

<style scoped>
.module-disabled {
  opacity: 0.5;
  pointer-events: none;
}
</style>
