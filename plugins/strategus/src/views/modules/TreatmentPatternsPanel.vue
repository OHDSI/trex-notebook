<template>
  <div>
    <!-- Page header (standalone mode only) -->
    <template v-if="!props.embedded">
      <div class="text-overline text-medium-emphasis">
        Module
      </div>
      <div style="width: 28px; height: 2px; background: #eb6622; margin-bottom: 8px" />
      <h1 class="text-h4 font-weight-light text-primary mb-1">
        Treatment Patterns
      </h1>
      <p class="text-body-2 text-medium-emphasis mb-4">
        Characterize treatment sequences and pathways
      </p>

      <ModuleEnableBanner
        v-if="!store.isModuleEnabled('TreatmentPatterns')"
        @enable="store.toggleModule('TreatmentPatterns')"
      />
    </template>

    <div :class="{ 'module-disabled': !props.embedded && !store.isModuleEnabled('TreatmentPatterns') }">
      <!-- Card 1: Cohort Roles -->
      <v-card
        flat
        rounded="lg"
        class="mb-4"
      >
        <v-card-title class="text-subtitle-1">
          Cohort Roles
        </v-card-title>
        <v-divider />
        <v-card-text>
          <v-alert
            type="info"
            variant="tonal"
            density="compact"
            class="mb-3"
          >
            Assign treatment pattern roles to your cohorts. 'Target' defines the population, 'Event' cohorts are the treatments to track, 'Exit' cohorts end the observation.
          </v-alert>
          <v-table density="compact">
            <thead>
              <tr>
                <th>Cohort Name</th>
                <th style="width: 200px">
                  TP Role
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="cohort in store.cohorts"
                :key="cohort.cohortId"
              >
                <td>{{ cohort.cohortName }}</td>
                <td>
                  <v-select
                    :model-value="getTpRole(cohort.cohortId)"
                    :items="[{ title: '—', value: null }, { title: 'target', value: 'target' }, { title: 'event', value: 'event' }, { title: 'exit', value: 'exit' }]"
                    variant="outlined"
                    density="compact"
                    rounded="md"
                    hide-details
                    clearable
                    style="max-width: 160px"
                    @update:model-value="(v) => setTpRole(cohort.cohortId, cohort.cohortName, v)"
                  />
                </td>
              </tr>
              <tr v-if="store.cohorts.length === 0">
                <td
                  colspan="2"
                  class="text-center text-medium-emphasis py-4"
                >
                  No cohorts defined yet. Add cohorts in the Cohorts panel.
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-card-text>
      </v-card>

      <!-- Card 2: Pathway Settings -->
      <v-card
        flat
        rounded="lg"
        class="mb-4"
      >
        <v-card-title class="text-subtitle-1">
          Pathway Settings
        </v-card-title>
        <v-divider />
        <v-card-text>
          <div class="d-flex ga-3">
            <v-text-field
              v-model.number="store.treatmentPatternsSettings.maxPathLength"
              label="Max path length"
              variant="outlined"
              density="compact"
              rounded="md"
              type="number"
              hint="Maximum number of treatment steps to track"
              persistent-hint
              style="max-width: 150px"
            />
            <v-text-field
              v-model.number="store.treatmentPatternsSettings.combinationWindow"
              label="Combination window (days)"
              variant="outlined"
              density="compact"
              rounded="md"
              type="number"
              hint="Window for overlapping treatments to count as combination"
              persistent-hint
              style="max-width: 180px"
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
            <!-- Row 1 -->
            <div class="d-flex ga-3">
              <v-text-field
                v-model.number="store.treatmentPatternsSettings.eraCollapseSize"
                label="Era collapse size (days)"
                variant="outlined"
                density="compact"
                rounded="md"
                hide-details
                type="number"
                style="max-width: 180px"
              />
              <v-text-field
                v-model.number="store.treatmentPatternsSettings.minEraDuration"
                label="Min era duration (days)"
                variant="outlined"
                density="compact"
                rounded="md"
                hide-details
                type="number"
                style="max-width: 180px"
              />
            </div>
            <!-- Row 2 -->
            <div class="d-flex ga-3 mt-3">
              <v-text-field
                v-model.number="store.treatmentPatternsSettings.minPostCombinationDuration"
                label="Min post-combination duration"
                variant="outlined"
                density="compact"
                rounded="md"
                hide-details
                type="number"
                style="max-width: 220px"
              />
              <v-select
                v-model="store.treatmentPatternsSettings.filterTreatments"
                label="Filter treatments"
                variant="outlined"
                density="compact"
                rounded="md"
                hide-details
                :items="['First', 'Changes', 'All']"
                style="max-width: 150px"
              />
            </div>
            <!-- Row 3 -->
            <div class="d-flex ga-3 mt-3">
              <v-text-field
                v-model.number="store.treatmentPatternsSettings.minCellCount"
                label="Min cell count"
                variant="outlined"
                density="compact"
                rounded="md"
                hide-details
                type="number"
                style="max-width: 130px"
              />
              <v-text-field
                v-model.number="store.treatmentPatternsSettings.ageWindow"
                label="Age window (years)"
                variant="outlined"
                density="compact"
                rounded="md"
                hide-details
                type="number"
                style="max-width: 130px"
              />
            </div>
            <!-- Row 4 -->
            <div class="d-flex ga-3 mt-3">
              <v-select
                v-model="store.treatmentPatternsSettings.includeTreatments"
                label="Include treatments"
                variant="outlined"
                density="compact"
                rounded="md"
                hide-details
                :items="['First', 'Changes', 'All']"
                style="max-width: 150px"
              />
              <v-select
                v-model="store.treatmentPatternsSettings.censorType"
                label="Censor type"
                variant="outlined"
                density="compact"
                rounded="md"
                hide-details
                :items="['minCellCount', 'remove', 'mean']"
                style="max-width: 150px"
              />
              <v-text-field
                v-model.number="store.treatmentPatternsSettings.indexDateOffset"
                label="Index date offset"
                variant="outlined"
                density="compact"
                rounded="md"
                hide-details
                type="number"
                style="max-width: 150px"
              />
            </div>
            <!-- Row 5 -->
            <div class="d-flex ga-6 mt-3">
              <v-checkbox
                v-model="store.treatmentPatternsSettings.stratify"
                label="Stratify by age/gender"
                density="compact"
                hide-details
              />
              <v-checkbox
                v-model="store.treatmentPatternsSettings.concatTargets"
                label="Concatenate targets"
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
import { useStrategusStore } from '../../store/useStrategusStore';
import ModuleEnableBanner from '../../components/ModuleEnableBanner.vue';
import AdvancedSection from '../../components/AdvancedSection.vue';

const props = defineProps<{ embedded?: boolean }>();
const store = useStrategusStore();

function getTpRole(cohortId: number): string | null {
  return store.treatmentPatternsSettings.cohortRoles.find(r => r.cohortId === cohortId)?.type ?? null;
}

function setTpRole(cohortId: number, cohortName: string, role: string | null) {
  const roles = store.treatmentPatternsSettings.cohortRoles;
  const idx = roles.findIndex(r => r.cohortId === cohortId);
  if (!role) {
    if (idx >= 0) roles.splice(idx, 1);
  } else if (idx >= 0) {
    roles[idx].type = role as 'target' | 'event' | 'exit';
  } else {
    roles.push({ cohortId, cohortName, type: role as 'target' | 'event' | 'exit' });
  }
}
</script>

<style scoped>
.module-disabled {
  opacity: 0.5;
  pointer-events: none;
}
</style>
