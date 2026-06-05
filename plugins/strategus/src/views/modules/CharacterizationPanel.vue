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
      <AtlasCard
        flat
        rounded="lg"
        class="mb-4"
        padding="none"
      >
        <h3 class="card-title text-subtitle-1">
          Analyses to Include
        </h3>
        <AtlasDivider />
        <div class="card-body">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px">
            <AtlasCheckbox
              v-model="store.characterizationSettings.includeTimeToEvent"
              label="Time-to-event"
            />
            <AtlasCheckbox
              v-model="store.characterizationSettings.includeDechallengeRechallenge"
              label="Dechallenge-rechallenge"
            />
            <AtlasCheckbox
              v-model="store.characterizationSettings.includeTargetBaseline"
              label="Target baseline"
            />
            <AtlasCheckbox
              v-model="store.characterizationSettings.includeRiskFactors"
              label="Risk factors"
            />
            <AtlasCheckbox
              v-model="store.characterizationSettings.includeCaseSeries"
              label="Case series"
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
            <div class="d-flex ga-3 mb-3">
              <AtlasTextField
                v-model.number="store.characterizationSettings.minCharacterizationMean"
                label="Min characterization mean"
                type="number"
                step="0.01"
              />
              <AtlasTextField
                v-model.number="store.characterizationSettings.minPriorObservation"
                label="Min prior observation (days)"
                type="number"
              />
            </div>
            <div class="d-flex ga-3 mb-3">
              <AtlasTextField
                v-model.number="store.characterizationSettings.dechallengeStopInterval"
                label="Dechallenge stop interval"
                type="number"
              />
              <AtlasTextField
                v-model.number="store.characterizationSettings.dechallengeEvaluationWindow"
                label="Dechallenge eval window"
                type="number"
              />
            </div>
            <div class="d-flex ga-3 mb-3">
              <AtlasTextField
                v-model.number="store.characterizationSettings.casePreTargetDuration"
                label="Case pre-target duration"
                type="number"
              />
              <AtlasTextField
                v-model.number="store.characterizationSettings.casePostOutcomeDuration"
                label="Case post-outcome duration"
                type="number"
              />
            </div>
          </div>
        </AtlasCard>
      </AdvancedSection>
    </div>
  </div>
</template>

<script setup lang="ts">
import { AtlasCard, AtlasDivider, AtlasCheckbox, AtlasTextField } from '@ohdsi/atlas-ui';
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
