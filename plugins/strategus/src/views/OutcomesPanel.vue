<template>
  <div>
    <!-- Page header (standalone only) -->
    <template v-if="!props.embedded">
      <div class="text-overline text-medium-emphasis">
        Study Design
      </div>
      <div style="width: 28px; height: 2px; background: #eb6622; margin-bottom: 8px" />
      <h1 class="text-h4 font-weight-light text-primary mb-4">
        Outcomes &amp; Negative Controls
      </h1>
    </template>

    <!-- Outcomes -->
    <div class="sub-label">
      Outcomes
    </div>
    <v-table
      v-if="store.outcomes.length > 0"
      density="compact"
      class="bordered-table mb-4"
    >
      <thead>
        <tr>
          <th>Cohort</th>
          <th style="width: 180px">
            Clean Window (days)
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="outcome in store.outcomes"
          :key="outcome.cohortId"
        >
          <td>
            <v-chip
              v-if="outcomeCohortExists(outcome.cohortId)"
              size="small"
              variant="tonal"
              color="success"
              label
            >
              {{ outcomeName(outcome.cohortId) }}
            </v-chip>
            <div
              v-else
              class="d-flex align-center ga-2"
            >
              <v-chip
                size="small"
                variant="tonal"
                color="success"
                label
              >
                {{ outcomeName(outcome.cohortId) }}
              </v-chip>
              <v-text-field
                v-model="outcome.outcomeName"
                variant="outlined"
                density="compact"
                hide-details
                placeholder="Outcome name"
                style="max-width: 200px"
              />
            </div>
          </td>
          <td>
            <v-text-field
              v-model.number="outcome.cleanWindow"
              variant="plain"
              density="compact"
              type="number"
              hide-details
              class="clean-window-input"
            />
          </td>
        </tr>
      </tbody>
    </v-table>
    <div
      v-else
      class="empty-state-compact mb-4"
    >
      Outcomes auto-populate when cohorts are assigned the "Outcome" role in the Cohorts section.
    </div>

    <!-- Negative Controls -->
    <div class="sub-label">
      Negative Controls
      <span
        v-if="store.negativeControls.length > 0"
        class="sub-label__count"
      >({{ store.negativeControls.length }})</span>
    </div>
    <div
      v-if="store.negativeControls.length > 0"
      class="d-flex flex-wrap gap-2 mb-3"
    >
      <v-chip
        v-for="nc in visibleControls"
        :key="nc.cohortId"
        size="small"
        closable
        @click:close="removeNc(nc.cohortId)"
      >
        {{ nc.cohortName }}
      </v-chip>
      <v-chip
        v-if="store.negativeControls.length > NC_DISPLAY_LIMIT && !showAllNc"
        size="small"
        variant="tonal"
        color="primary"
        @click="showAllNc = true"
      >
        +{{ store.negativeControls.length - NC_DISPLAY_LIMIT }} more
      </v-chip>
    </div>
    <div
      v-else
      class="empty-state-compact"
    >
      No negative controls yet.
    </div>

    <!-- Settings -->
    <v-row
      dense
      class="mt-2"
    >
      <v-col
        cols="12"
        sm="6"
      >
        <v-checkbox
          v-model="store.ncDetectOnDescendants"
          label="Detect on descendants"
          density="compact"
          hide-details
        />
      </v-col>
      <v-col
        cols="12"
        sm="6"
      >
        <v-select
          v-model="store.ncOccurrenceType"
          label="Occurrence type"
          :items="occurrenceItems"
          variant="outlined"
          density="compact"
          hide-details
        />
      </v-col>
    </v-row>

    <div class="d-flex justify-end mt-2">
      <v-btn
        color="primary"
        variant="tonal"
        size="small"
        prepend-icon="mdi-plus"
        @click="openNcDialog"
      >
        Add Negative Control
      </v-btn>
    </div>

    <!-- Add Negative Control Dialog -->
    <AtlasDialog
      v-model="ncDialogOpen"
      eyebrow="OUTCOME"
      title="Add Negative Control"
      :max-width="460"
      @close="ncDialogOpen = false"
    >
      <v-row dense>
        <v-col
          cols="12"
          sm="4"
        >
          <v-text-field
            v-model.number="ncForm.cohortId"
            label="Cohort ID"
            variant="outlined"
            density="compact"
            type="number"
          />
        </v-col>
        <v-col
          cols="12"
          sm="8"
        >
          <v-text-field
            v-model="ncForm.cohortName"
            label="Cohort Name"
            variant="outlined"
            density="compact"
          />
        </v-col>
        <v-col cols="12">
          <v-text-field
            v-model.number="ncForm.outcomeConceptId"
            label="Outcome Concept ID"
            variant="outlined"
            density="compact"
            type="number"
          />
        </v-col>
      </v-row>
      <template #actions>
        <AtlasButton
          variant="ghost"
          @click="ncDialogOpen = false"
        >
          Cancel
        </AtlasButton>
        <AtlasButton
          :disabled="!ncForm.cohortId || !ncForm.cohortName || !ncForm.outcomeConceptId"
          @click="addNc"
        >
          Add
        </AtlasButton>
      </template>
    </AtlasDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { AtlasDialog, AtlasButton } from '@ohdsi/atlas-ui';
import { useStrategusStore } from '../store/useStrategusStore';
import type { NegativeControlEntry } from '../store/useStrategusStore';

const props = defineProps<{ embedded?: boolean }>();
const store = useStrategusStore();

const NC_DISPLAY_LIMIT = 8;
const showAllNc = ref(false);

const occurrenceItems = [
  { title: 'First occurrence', value: 'first' },
  { title: 'All occurrences', value: 'all' },
];

const visibleControls = computed(() =>
  showAllNc.value
    ? store.negativeControls
    : store.negativeControls.slice(0, NC_DISPLAY_LIMIT)
);

function outcomeCohortExists(cohortId: number): boolean {
  return store.cohorts.some(c => c.cohortId === cohortId);
}

function outcomeName(cohortId: number): string {
  const c = store.cohorts.find(c => c.cohortId === cohortId);
  if (c) return c.cohortName;
  // Fall back to outcomeName stored on the entry, then a generic label
  const o = store.outcomes.find(o => o.cohortId === cohortId);
  return o?.outcomeName ?? `Cohort ${cohortId}`;
}

function removeNc(cohortId: number) {
  const idx = store.negativeControls.findIndex(nc => nc.cohortId === cohortId);
  if (idx !== -1) store.negativeControls.splice(idx, 1);
}

// Add NC dialog
const ncDialogOpen = ref(false);
const defaultNcForm = () => ({ cohortId: null as number | null, cohortName: '', outcomeConceptId: null as number | null });
const ncForm = ref(defaultNcForm());

function openNcDialog() {
  ncForm.value = defaultNcForm();
  ncDialogOpen.value = true;
}

function addNc() {
  if (!ncForm.value.cohortId || !ncForm.value.cohortName || !ncForm.value.outcomeConceptId) return;
  const entry: NegativeControlEntry = {
    cohortId: ncForm.value.cohortId,
    cohortName: ncForm.value.cohortName,
    outcomeConceptId: ncForm.value.outcomeConceptId,
  };
  store.negativeControls.push(entry);
  ncDialogOpen.value = false;
}
</script>

<style scoped>
.clean-window-input :deep(.v-field__input) {
  padding-top: 4px;
  padding-bottom: 4px;
  min-height: unset;
}

.gap-2 {
  gap: 8px;
}
</style>
