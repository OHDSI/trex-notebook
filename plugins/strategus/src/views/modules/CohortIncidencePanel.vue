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
      <AtlasCard
        flat
        rounded="lg"
        class="mb-4"
        padding="none"
      >
        <h3 class="card-title text-subtitle-1">
          Stratification
        </h3>
        <AtlasDivider />
        <div class="card-body">
          <div class="d-flex ga-6">
            <AtlasCheckbox
              v-model="store.cohortIncidenceSettings.byAge"
              label="By age"
            />
            <AtlasCheckbox
              v-model="store.cohortIncidenceSettings.byGender"
              label="By gender"
            />
            <AtlasCheckbox
              v-model="store.cohortIncidenceSettings.byYear"
              label="By year"
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
            <AtlasTextField
              v-model="ageBreaksStr"
              label="Age breaks"
              hint="Comma-separated age boundaries"
              style="max-width: 400px"
            />
          </div>
        </AtlasCard>

        <!-- Per-CI TAR windows -->
        <AtlasCard
          flat
          rounded="lg"
          class="mt-4"
          padding="none"
        >
          <h3 class="card-title text-subtitle-1">
            Time-at-Risk Windows (Cohort Incidence)
          </h3>
          <p class="card-subtitle text-caption text-medium-emphasis">
            These TAR windows are used only by Cohort Incidence. When empty, the global TAR windows are used.
          </p>
          <AtlasDivider />
          <div class="card-body">
            <AtlasDataTable
              v-if="store.cohortIncidenceTars.length > 0"
              :headers="tarTableHeaders"
              :items="store.cohortIncidenceTars"
              density="compact"
              class="bordered-table mb-3"
            >
              <template #item.label="{ item }">
                <AtlasTextField
                  v-model="item.label"
                />
              </template>
              <template #item.riskWindowStart="{ item }">
                <AtlasTextField
                  v-model.number="item.riskWindowStart"
                  type="number"
                />
              </template>
              <template #item.startAnchor="{ item }">
                <AtlasSelect
                  v-model="item.startAnchor"
                  :items="anchorItems"
                />
              </template>
              <template #item.riskWindowEnd="{ item }">
                <AtlasTextField
                  v-model.number="item.riskWindowEnd"
                  type="number"
                />
              </template>
              <template #item.endAnchor="{ item }">
                <AtlasSelect
                  v-model="item.endAnchor"
                  :items="anchorItems"
                />
              </template>
              <template #item.actions="{ index }">
                <AtlasIconButton
                  icon="mdi-delete-outline"
                  size="sm"
                  variant="text"
                  tone="danger"
                  ariaLabel="Remove TAR"
                  @click="removeCiTar(index)"
                />
              </template>
            </AtlasDataTable>
            <p
              v-else
              class="text-caption text-medium-emphasis mb-3"
            >
              No CI-specific TARs defined — using global TAR windows.
            </p>
            <AtlasButton
              size="sm"
              variant="tonal"
              prepend-icon="mdi-plus"
              @click="addCiTar"
            >
              Add TAR
            </AtlasButton>
          </div>
        </AtlasCard>

        <!-- CI Analysis list -->
        <AtlasCard
          flat
          rounded="lg"
          class="mt-4"
          padding="none"
        >
          <h3 class="card-title text-subtitle-1">
            Analysis List
          </h3>
          <p class="card-subtitle text-caption text-medium-emphasis">
            Each entry specifies which targets, outcomes, and TAR windows to combine. When empty, all targets × all outcomes × all TARs are used.
          </p>
          <AtlasDivider />
          <div class="card-body">
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
                <AtlasIconButton
                  icon="mdi-delete-outline"
                  size="sm"
                  variant="text"
                  tone="danger"
                  ariaLabel="Remove analysis"
                  @click="removeCiAnalysis(idx)"
                />
              </div>
              <AtlasRow dense>
                <AtlasCol cols="4">
                  <AtlasSelect
                    v-model="analysis.targets"
                    label="Targets (cohort IDs)"
                    :items="targetCohortItems"
                    multiple
                    chips
                  />
                </AtlasCol>
                <AtlasCol cols="4">
                  <AtlasSelect
                    v-model="analysis.outcomes"
                    label="Outcomes (1-based index)"
                    :items="outcomeIndexItems"
                    multiple
                    chips
                  />
                </AtlasCol>
                <AtlasCol cols="4">
                  <AtlasSelect
                    v-model="analysis.tars"
                    label="TARs (1-based index)"
                    :items="tarIndexItems"
                    multiple
                    chips
                  />
                </AtlasCol>
              </AtlasRow>
            </div>
            <AtlasButton
              size="sm"
              variant="tonal"
              prepend-icon="mdi-plus"
              @click="addCiAnalysis"
            >
              Add Analysis
            </AtlasButton>
          </div>
        </AtlasCard>
      </AdvancedSection>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { AtlasCard, AtlasDivider, AtlasCheckbox, AtlasTextField, AtlasSelect, AtlasButton, AtlasIconButton, AtlasDataTable, AtlasRow, AtlasCol } from '@ohdsi/atlas-ui';
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

const tarTableHeaders = [
  { key: 'label', title: 'Label', sortable: false },
  { key: 'riskWindowStart', title: 'Start Offset', sortable: false },
  { key: 'startAnchor', title: 'Start Anchor', sortable: false },
  { key: 'riskWindowEnd', title: 'End Offset', sortable: false },
  { key: 'endAnchor', title: 'End Anchor', sortable: false },
  { key: 'actions', title: '', sortable: false },
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

.card-title {
  padding: 12px 16px;
  margin: 0;
}

.card-subtitle {
  padding: 0 16px 4px;
  margin: 0;
}

.card-body {
  padding: 16px;
}
</style>
