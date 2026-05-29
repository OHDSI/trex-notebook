<template>
  <div>
    <!-- Page header (standalone mode only) -->
    <template v-if="!props.embedded">
      <div class="text-overline text-medium-emphasis">
        Module
      </div>
      <div style="width: 28px; height: 2px; background: #eb6622; margin-bottom: 8px" />
      <h1 class="text-h4 font-weight-light text-primary mb-1">
        Cohort Incidence
      </h1>
      <p class="text-body-2 text-medium-emphasis mb-4">
        Incidence rates stratified by demographics
      </p>

      <ModuleEnableBanner
        v-if="!store.isModuleEnabled('CohortIncidence')"
        @enable="store.toggleModule('CohortIncidence')"
      />
    </template>

    <div :class="{ 'module-disabled': !props.embedded && !store.isModuleEnabled('CohortIncidence') }">
      <!-- Stratification card -->
      <v-card
        flat
        rounded="lg"
        class="mb-4"
      >
        <v-card-title class="text-subtitle-1">
          Stratification
        </v-card-title>
        <v-divider />
        <v-card-text>
          <div class="d-flex ga-6">
            <v-checkbox
              v-model="store.cohortIncidenceSettings.byAge"
              label="By age"
              density="compact"
              hide-details
            />
            <v-checkbox
              v-model="store.cohortIncidenceSettings.byGender"
              label="By gender"
              density="compact"
              hide-details
            />
            <v-checkbox
              v-model="store.cohortIncidenceSettings.byYear"
              label="By year"
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
            <v-text-field
              v-model="ageBreaksStr"
              label="Age breaks"
              variant="outlined"
              density="compact"
              rounded="md"
              hint="Comma-separated age boundaries"
              persistent-hint
              style="max-width: 400px"
            />
          </v-card-text>
        </v-card>

        <!-- Per-CI TAR windows -->
        <v-card
          flat
          rounded="lg"
          class="mt-4"
        >
          <v-card-title class="text-subtitle-1">
            Time-at-Risk Windows (Cohort Incidence)
          </v-card-title>
          <v-card-subtitle class="text-caption text-medium-emphasis pb-1">
            These TAR windows are used only by Cohort Incidence. When empty, the global TAR windows are used.
          </v-card-subtitle>
          <v-divider />
          <v-card-text>
            <v-table
              v-if="store.cohortIncidenceTars.length > 0"
              density="compact"
              class="bordered-table mb-3"
            >
              <thead>
                <tr>
                  <th>Label</th>
                  <th>Start Offset</th>
                  <th>Start Anchor</th>
                  <th>End Offset</th>
                  <th>End Anchor</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(tar, idx) in store.cohortIncidenceTars"
                  :key="idx"
                >
                  <td>
                    <v-text-field
                      v-model="tar.label"
                      variant="plain"
                      density="compact"
                      hide-details
                    />
                  </td>
                  <td>
                    <v-text-field
                      v-model.number="tar.riskWindowStart"
                      variant="plain"
                      density="compact"
                      type="number"
                      hide-details
                    />
                  </td>
                  <td>
                    <v-select
                      v-model="tar.startAnchor"
                      :items="anchorItems"
                      variant="plain"
                      density="compact"
                      hide-details
                    />
                  </td>
                  <td>
                    <v-text-field
                      v-model.number="tar.riskWindowEnd"
                      variant="plain"
                      density="compact"
                      type="number"
                      hide-details
                    />
                  </td>
                  <td>
                    <v-select
                      v-model="tar.endAnchor"
                      :items="anchorItems"
                      variant="plain"
                      density="compact"
                      hide-details
                    />
                  </td>
                  <td>
                    <v-btn
                      icon="mdi-delete-outline"
                      size="x-small"
                      variant="text"
                      color="error"
                      @click="removeCiTar(idx)"
                    />
                  </td>
                </tr>
              </tbody>
            </v-table>
            <p
              v-else
              class="text-caption text-medium-emphasis mb-3"
            >
              No CI-specific TARs defined — using global TAR windows.
            </p>
            <v-btn
              size="small"
              variant="tonal"
              color="primary"
              prepend-icon="mdi-plus"
              @click="addCiTar"
            >
              Add TAR
            </v-btn>
          </v-card-text>
        </v-card>

        <!-- CI Analysis list -->
        <v-card
          flat
          rounded="lg"
          class="mt-4"
        >
          <v-card-title class="text-subtitle-1">
            Analysis List
          </v-card-title>
          <v-card-subtitle class="text-caption text-medium-emphasis pb-1">
            Each entry specifies which targets, outcomes, and TAR windows to combine. When empty, all targets × all outcomes × all TARs are used.
          </v-card-subtitle>
          <v-divider />
          <v-card-text>
            <div
              v-if="store.cohortIncidenceAnalyses.length === 0"
              class="text-caption text-medium-emphasis mb-3"
            >
              No explicit analyses — using default (all targets × all outcomes × all TARs).
            </div>
            <div
              v-for="(analysis, idx) in store.cohortIncidenceAnalyses"
              :key="idx"
              class="mb-4 pa-3 bordered-table rounded"
            >
              <div class="d-flex align-center justify-space-between mb-2">
                <span class="text-caption font-weight-medium">Analysis {{ idx + 1 }}</span>
                <v-btn
                  icon="mdi-delete-outline"
                  size="x-small"
                  variant="text"
                  color="error"
                  @click="removeCiAnalysis(idx)"
                />
              </div>
              <v-row dense>
                <v-col cols="4">
                  <v-select
                    v-model="analysis.targets"
                    label="Targets (cohort IDs)"
                    :items="targetCohortItems"
                    multiple
                    chips
                    variant="outlined"
                    density="compact"
                    hide-details
                  />
                </v-col>
                <v-col cols="4">
                  <v-select
                    v-model="analysis.outcomes"
                    label="Outcomes (1-based index)"
                    :items="outcomeIndexItems"
                    multiple
                    chips
                    variant="outlined"
                    density="compact"
                    hide-details
                  />
                </v-col>
                <v-col cols="4">
                  <v-select
                    v-model="analysis.tars"
                    label="TARs (1-based index)"
                    :items="tarIndexItems"
                    multiple
                    chips
                    variant="outlined"
                    density="compact"
                    hide-details
                  />
                </v-col>
              </v-row>
            </div>
            <v-btn
              size="small"
              variant="tonal"
              color="primary"
              prepend-icon="mdi-plus"
              @click="addCiAnalysis"
            >
              Add Analysis
            </v-btn>
          </v-card-text>
        </v-card>
      </AdvancedSection>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useStrategusStore } from '../../store/useStrategusStore';
import type { CohortIncidenceAnalysis } from '../../store/useStrategusStore';
import { createDefaultTimeAtRisk } from '../../services/DefaultsFactory';
import ModuleEnableBanner from '../../components/ModuleEnableBanner.vue';
import AdvancedSection from '../../components/AdvancedSection.vue';

const props = defineProps<{ embedded?: boolean }>();
const store = useStrategusStore();

const ageBreaksStr = computed({
  get: () => store.cohortIncidenceSettings.ageBreaks.join(', '),
  set: (v: string) => {
    store.cohortIncidenceSettings.ageBreaks = v.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
  },
});

const anchorItems = [
  { title: 'Cohort start', value: 'cohort start' },
  { title: 'Cohort end', value: 'cohort end' },
];

// Items for analysis-list selects
const targetCohortItems = computed(() =>
  store.cohortsByRole('Target').map((c) => ({ title: `${c.cohortName} (${c.cohortId})`, value: c.cohortId }))
);

const outcomeIndexItems = computed(() =>
  store.outcomes.map((o, i) => {
    const name = store.cohorts.find(c => c.cohortId === o.cohortId)?.cohortName
      ?? o.outcomeName
      ?? `Cohort ${o.cohortId}`;
    return { title: `${i + 1}: ${name}`, value: i + 1 };
  })
);

const tarIndexItems = computed(() => {
  const tars = store.cohortIncidenceTars.length > 0 ? store.cohortIncidenceTars : store.timeAtRisk;
  return tars.map((t, i) => ({ title: `${i + 1}: ${t.label}`, value: i + 1 }));
});

function addCiTar() {
  store.cohortIncidenceTars.push(createDefaultTimeAtRisk());
}

function removeCiTar(idx: number) {
  store.cohortIncidenceTars.splice(idx, 1);
}

function addCiAnalysis() {
  const tars = store.cohortIncidenceTars.length > 0 ? store.cohortIncidenceTars : store.timeAtRisk;
  const analysis: CohortIncidenceAnalysis = {
    targets: store.cohortsByRole('Target').map(c => c.cohortId),
    outcomes: store.outcomes.map((_, i) => i + 1),
    tars: tars.map((_, i) => i + 1),
  };
  store.cohortIncidenceAnalyses.push(analysis);
}

function removeCiAnalysis(idx: number) {
  store.cohortIncidenceAnalyses.splice(idx, 1);
}
</script>

<style scoped>
.module-disabled {
  opacity: 0.5;
  pointer-events: none;
}

.bordered-table {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 8px;
}
</style>
