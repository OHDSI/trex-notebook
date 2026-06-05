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
    <table
      v-if="store.outcomes.length > 0"
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
            <AtlasChip
              v-if="outcomeCohortExists(outcome.cohortId)"
              size="sm"
              tone="success"
            >
              {{ outcomeName(outcome.cohortId) }}
            </AtlasChip>
            <div
              v-else
              class="d-flex align-center ga-2"
            >
              <AtlasChip
                size="sm"
                tone="success"
              >
                {{ outcomeName(outcome.cohortId) }}
              </AtlasChip>
              <AtlasTextField
                v-model="outcome.outcomeName"
                placeholder="Outcome name"
                style="max-width: 200px"
              />
            </div>
          </td>
          <td>
            <AtlasTextField
              v-model.number="outcome.cleanWindow"
              type="number"
              class="clean-window-input"
            />
          </td>
        </tr>
      </tbody>
    </table>
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
      <AtlasChip
        v-for="nc in visibleControls"
        :key="nc.cohortId"
        size="sm"
        closable
        @close="removeNc(nc.cohortId)"
      >
        {{ nc.cohortName }}
      </AtlasChip>
      <AtlasChip
        v-if="store.negativeControls.length > NC_DISPLAY_LIMIT && !showAllNc"
        size="sm"
        tone="primary"
        @click="showAllNc = true"
      >
        +{{ store.negativeControls.length - NC_DISPLAY_LIMIT }} more
      </AtlasChip>
    </div>
    <div
      v-else
      class="empty-state-compact"
    >
      No negative controls yet.
    </div>

    <!-- Settings -->
    <AtlasRow
      dense
      class="mt-2"
    >
      <AtlasCol
        cols="12"
        sm="6"
      >
        <AtlasCheckbox
          v-model="store.ncDetectOnDescendants"
          label="Detect on descendants"
        />
      </AtlasCol>
      <AtlasCol
        cols="12"
        sm="6"
      >
        <AtlasSelect
          v-model="store.ncOccurrenceType"
          label="Occurrence type"
          :items="occurrenceItems"
        />
      </AtlasCol>
    </AtlasRow>

    <div class="d-flex justify-end mt-2">
      <AtlasButton
        tone="primary"
        variant="tonal"
        size="sm"
        prepend-icon="mdi-plus"
        @click="openNcDialog"
      >
        Add Negative Control
      </AtlasButton>
    </div>

    <!-- Add Negative Control Dialog -->
    <AtlasDialog
      v-model="ncDialogOpen"
      eyebrow="OUTCOME"
      title="Add Negative Control"
      :max-width="460"
      @close="ncDialogOpen = false"
    >
      <AtlasRow dense>
        <AtlasCol
          cols="12"
          sm="4"
        >
          <AtlasTextField
            :model-value="ncForm.cohortId ?? undefined"
            label="Cohort ID"
            type="number"
            @update:model-value="v => ncForm.cohortId = v ? Number(v) : null"
          />
        </AtlasCol>
        <AtlasCol
          cols="12"
          sm="8"
        >
          <AtlasTextField
            v-model="ncForm.cohortName"
            label="Cohort Name"
          />
        </AtlasCol>
        <AtlasCol cols="12">
          <AtlasTextField
            :model-value="ncForm.outcomeConceptId ?? undefined"
            label="Outcome Concept ID"
            type="number"
            @update:model-value="v => ncForm.outcomeConceptId = v ? Number(v) : null"
          />
        </AtlasCol>
      </AtlasRow>
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
import { AtlasDialog, AtlasButton, AtlasChip, AtlasTextField, AtlasRow, AtlasCol, AtlasCheckbox, AtlasSelect } from '@ohdsi/atlas-ui';
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
