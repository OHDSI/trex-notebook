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
      <AtlasCard
        flat
        rounded="lg"
        class="mb-4"
        padding="none"
      >
        <h3 class="text-subtitle-1 card-title-pad">
          Cohort Roles
        </h3>
        <AtlasDivider />
        <div class="card-body-pad">
          <AtlasAlert
            severity="info"
            variant="tonal"
            class="mb-3"
          >
            Assign treatment pattern roles to your cohorts. 'Target' defines the population, 'Event' cohorts are the treatments to track, 'Exit' cohorts end the observation.
          </AtlasAlert>
          <table class="tp-table">
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
                  <AtlasSelect
                    :model-value="getTpRole(cohort.cohortId)"
                    :items="[{ title: '—', value: null }, { title: 'target', value: 'target' }, { title: 'event', value: 'event' }, { title: 'exit', value: 'exit' }]"
                    clearable
                    style="max-width: 160px"
                    @update:model-value="(v) => setTpRole(cohort.cohortId, cohort.cohortName, v as string | null)"
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
          </table>
        </div>
      </AtlasCard>

      <!-- Card 2: Pathway Settings -->
      <AtlasCard
        flat
        rounded="lg"
        class="mb-4"
        padding="none"
      >
        <h3 class="text-subtitle-1 card-title-pad">
          Pathway Settings
        </h3>
        <AtlasDivider />
        <div class="card-body-pad">
          <div class="d-flex ga-3">
            <AtlasTextField
              v-model.number="store.treatmentPatternsSettings.maxPathLength"
              label="Max path length"
              type="number"
              hint="Maximum number of treatment steps to track"
              style="max-width: 150px"
            />
            <AtlasTextField
              v-model.number="store.treatmentPatternsSettings.combinationWindow"
              label="Combination window (days)"
              type="number"
              hint="Window for overlapping treatments to count as combination"
              style="max-width: 180px"
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
          padding="md"
        >
          <div>
            <!-- Row 1 -->
            <div class="d-flex ga-3">
              <AtlasTextField
                v-model.number="store.treatmentPatternsSettings.eraCollapseSize"
                label="Era collapse size (days)"
                type="number"
                style="max-width: 180px"
              />
              <AtlasTextField
                v-model.number="store.treatmentPatternsSettings.minEraDuration"
                label="Min era duration (days)"
                type="number"
                style="max-width: 180px"
              />
            </div>
            <!-- Row 2 -->
            <div class="d-flex ga-3 mt-3">
              <AtlasTextField
                v-model.number="store.treatmentPatternsSettings.minPostCombinationDuration"
                label="Min post-combination duration"
                type="number"
                style="max-width: 220px"
              />
              <AtlasSelect
                v-model="store.treatmentPatternsSettings.filterTreatments"
                label="Filter treatments"
                :items="['First', 'Changes', 'All']"
                style="max-width: 150px"
              />
            </div>
            <!-- Row 3 -->
            <div class="d-flex ga-3 mt-3">
              <AtlasTextField
                v-model.number="store.treatmentPatternsSettings.minCellCount"
                label="Min cell count"
                type="number"
                style="max-width: 130px"
              />
              <AtlasTextField
                v-model.number="store.treatmentPatternsSettings.ageWindow"
                label="Age window (years)"
                type="number"
                style="max-width: 130px"
              />
            </div>
            <!-- Row 4 -->
            <div class="d-flex ga-3 mt-3">
              <AtlasSelect
                v-model="store.treatmentPatternsSettings.includeTreatments"
                label="Include treatments"
                :items="['First', 'Changes', 'All']"
                style="max-width: 150px"
              />
              <AtlasSelect
                v-model="store.treatmentPatternsSettings.censorType"
                label="Censor type"
                :items="['minCellCount', 'remove', 'mean']"
                style="max-width: 150px"
              />
              <AtlasTextField
                v-model.number="store.treatmentPatternsSettings.indexDateOffset"
                label="Index date offset"
                type="number"
                style="max-width: 150px"
              />
            </div>
            <!-- Row 5 -->
            <div class="d-flex ga-6 mt-3">
              <AtlasCheckbox
                v-model="store.treatmentPatternsSettings.stratify"
                label="Stratify by age/gender"
              />
              <AtlasCheckbox
                v-model="store.treatmentPatternsSettings.concatTargets"
                label="Concatenate targets"
              />
            </div>
          </div>
        </AtlasCard>
      </AdvancedSection>
    </div>
  </div>
</template>

<script setup lang="ts">
import { AtlasCard, AtlasDivider, AtlasAlert, AtlasTextField, AtlasSelect, AtlasCheckbox } from '@ohdsi/atlas-ui';
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

.card-title-pad {
  padding: 12px 16px;
  font-weight: 500;
}

.card-body-pad {
  padding: 16px;
}

.tp-table {
  width: 100%;
  border-collapse: collapse;
}

.tp-table th,
.tp-table td {
  padding: 4px 8px;
  text-align: left;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
</style>
