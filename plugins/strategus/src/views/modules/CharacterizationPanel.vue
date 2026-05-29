<template>
  <div>
    <!-- Page header (standalone mode only) -->
    <template v-if="!props.embedded">
      <div class="text-overline text-medium-emphasis">
        Module
      </div>
      <div style="width: 28px; height: 2px; background: #eb6622; margin-bottom: 8px" />
      <h1 class="text-h4 font-weight-light text-primary mb-1">
        Characterization
      </h1>
      <p class="text-body-2 text-medium-emphasis mb-4">
        Baseline features, risk factors, dechallenge-rechallenge analysis
      </p>

      <ModuleEnableBanner
        v-if="!store.isModuleEnabled('Characterization')"
        @enable="store.toggleModule('Characterization')"
      />
    </template>

    <div :class="{ 'module-disabled': !props.embedded && !store.isModuleEnabled('Characterization') }">
      <!-- Analyses to Include card -->
      <v-card
        flat
        rounded="lg"
        class="mb-4"
      >
        <v-card-title class="text-subtitle-1">
          Analyses to Include
        </v-card-title>
        <v-divider />
        <v-card-text>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px">
            <v-checkbox
              v-model="store.characterizationSettings.includeTimeToEvent"
              label="Time-to-event"
              density="compact"
              hide-details
            />
            <v-checkbox
              v-model="store.characterizationSettings.includeDechallengeRechallenge"
              label="Dechallenge-rechallenge"
              density="compact"
              hide-details
            />
            <v-checkbox
              v-model="store.characterizationSettings.includeTargetBaseline"
              label="Target baseline"
              density="compact"
              hide-details
            />
            <v-checkbox
              v-model="store.characterizationSettings.includeRiskFactors"
              label="Risk factors"
              density="compact"
              hide-details
            />
            <v-checkbox
              v-model="store.characterizationSettings.includeCaseSeries"
              label="Case series"
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
            <div class="d-flex ga-3 mb-3">
              <v-text-field
                v-model.number="store.characterizationSettings.minCharacterizationMean"
                label="Min characterization mean"
                variant="outlined"
                density="compact"
                rounded="md"
                hide-details
                type="number"
                step="0.01"
              />
              <v-text-field
                v-model.number="store.characterizationSettings.minPriorObservation"
                label="Min prior observation (days)"
                variant="outlined"
                density="compact"
                rounded="md"
                hide-details
                type="number"
              />
            </div>
            <div class="d-flex ga-3 mb-3">
              <v-text-field
                v-model.number="store.characterizationSettings.dechallengeStopInterval"
                label="Dechallenge stop interval"
                variant="outlined"
                density="compact"
                rounded="md"
                hide-details
                type="number"
              />
              <v-text-field
                v-model.number="store.characterizationSettings.dechallengeEvaluationWindow"
                label="Dechallenge eval window"
                variant="outlined"
                density="compact"
                rounded="md"
                hide-details
                type="number"
              />
            </div>
            <div class="d-flex ga-3 mb-3">
              <v-text-field
                v-model.number="store.characterizationSettings.casePreTargetDuration"
                label="Case pre-target duration"
                variant="outlined"
                density="compact"
                rounded="md"
                hide-details
                type="number"
              />
              <v-text-field
                v-model.number="store.characterizationSettings.casePostOutcomeDuration"
                label="Case post-outcome duration"
                variant="outlined"
                density="compact"
                rounded="md"
                hide-details
                type="number"
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
