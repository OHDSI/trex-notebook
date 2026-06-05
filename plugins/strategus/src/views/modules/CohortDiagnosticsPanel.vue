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
      <AtlasCard
        flat
        rounded="lg"
        class="mb-4"
        padding="none"
      >
        <h3 class="card-title text-subtitle-1">
          Diagnostics to Run
        </h3>
        <AtlasDivider />
        <div class="card-body">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px">
            <AtlasCheckbox
              v-model="store.cohortDiagnosticsSettings.runInclusionStatistics"
              label="Inclusion statistics"
            />
            <AtlasCheckbox
              v-model="store.cohortDiagnosticsSettings.runIncludedSourceConcepts"
              label="Included source concepts"
            />
            <AtlasCheckbox
              v-model="store.cohortDiagnosticsSettings.runOrphanConcepts"
              label="Orphan concepts"
            />
            <AtlasCheckbox
              v-model="store.cohortDiagnosticsSettings.runTimeSeries"
              label="Time series"
            />
            <AtlasCheckbox
              v-model="store.cohortDiagnosticsSettings.runVisitContext"
              label="Visit context"
            />
            <AtlasCheckbox
              v-model="store.cohortDiagnosticsSettings.runBreakdownIndexEvents"
              label="Breakdown index events"
            />
            <AtlasCheckbox
              v-model="store.cohortDiagnosticsSettings.runIncidenceRate"
              label="Incidence rate"
            />
            <AtlasCheckbox
              v-model="store.cohortDiagnosticsSettings.runCohortRelationship"
              label="Cohort relationship"
            />
            <AtlasCheckbox
              v-model="store.cohortDiagnosticsSettings.runTemporalCohortCharacterization"
              label="Temporal characterization"
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
                v-model.number="store.cohortDiagnosticsSettings.minCharacterizationMean"
                label="Min characterization mean"
                type="number"
                step="0.01"
                style="max-width: 200px"
              />
              <AtlasTextField
                v-model.number="store.cohortDiagnosticsSettings.irWashoutPeriod"
                label="IR washout period"
                type="number"
                style="max-width: 200px"
              />
            </div>

            <!-- Cohort filter -->
            <div class="text-subtitle-2 text-medium-emphasis mt-4 mb-2">
              Cohort Filter
            </div>
            <AtlasSelect
              v-model="(store.cohortDiagnosticsSettings as CohortDiagnosticsSettings).cohortIds"
              :items="store.cohorts.map(c => ({ title: c.cohortName, value: c.cohortId }))"
              label="Cohorts to diagnose (empty = all)"
              multiple
              clearable
              style="max-width: 480px"
            />

            <div class="text-subtitle-2 text-medium-emphasis mt-4 mb-2">
              Temporal Covariate Windows
            </div>

            <div class="d-flex ga-3 flex-column">
              <AtlasTextField
                v-model="temporalStartDaysStr"
                label="Start days"
                style="max-width: 400px"
                hint="Comma-separated days relative to index date."
              />
              <AtlasTextField
                v-model="temporalEndDaysStr"
                label="End days"
                style="max-width: 400px"
                hint="Comma-separated days relative to index date."
              />
            </div>

            <!-- Temporal covariate features -->
            <div class="text-subtitle-2 text-medium-emphasis mt-4 mb-2">
              Temporal Covariate Features
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px">
              <AtlasCheckbox
                v-for="(_, key) in (store.cohortDiagnosticsSettings as CohortDiagnosticsSettings).temporalCovariateFeatures"
                :key="key"
                v-model="(store.cohortDiagnosticsSettings as CohortDiagnosticsSettings).temporalCovariateFeatures[key]"
                :label="key"
              />
            </div>
          </div>
        </AtlasCard>
      </AdvancedSection>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { AtlasCard, AtlasDivider, AtlasCheckbox, AtlasTextField, AtlasSelect } from '@ohdsi/atlas-ui';
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

.card-title {
  padding: 12px 16px 12px;
  margin: 0;
}

.card-body {
  padding: 16px;
}
</style>
