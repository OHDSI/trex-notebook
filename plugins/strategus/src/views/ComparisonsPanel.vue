<template>
  <div>
    <!-- Page header (standalone only) -->
    <template v-if="!props.embedded">
      <div class="text-overline text-medium-emphasis">
        Study Design
      </div>
      <div style="width: 28px; height: 2px; background: #eb6622; margin-bottom: 8px" />
    </template>
    <div
      v-if="!props.embedded"
      class="mb-3"
    >
      <h1 class="text-h4 font-weight-light text-primary mb-1">
        Comparisons
      </h1>
      <p class="text-body-2 text-medium-emphasis">
        Define target vs comparator pairs
      </p>
    </div>

    <!-- TCI list -->
    <div
      v-if="store.comparisons.length > 0"
      class="mb-2"
    >
      <TciCard
        v-for="(tci, idx) in store.comparisons"
        :key="idx"
        :tci="tci"
        @edit="openEditDialog(idx)"
        @delete="removeComparison(idx)"
      />
    </div>
    <div
      v-else
      class="empty-state-compact"
    >
      No comparisons yet.
    </div>

    <div class="d-flex justify-end">
      <AtlasButton
        variant="tonal"
        tone="primary"
        size="sm"
        prepend-icon="mdi-plus"
        @click="openAddDialog"
      >
        Add Comparison
      </AtlasButton>
    </div>

    <!-- Add/Edit Dialog -->
    <AtlasDialog
      v-model="dialogOpen"
      eyebrow="COMPARISON"
      :title="editingIdx !== null ? 'Edit Comparison' : 'Add Comparison'"
      :max-width="520"
      @close="dialogOpen = false"
    >
      <AtlasRow dense>
        <AtlasCol
          cols="12"
          sm="6"
        >
          <AtlasSelect
            v-model="form.targetId"
            label="Target"
            :items="targetItems"
            item-title="cohortName"
            item-value="cohortId"
            no-data-text="No Target cohorts assigned"
          />
        </AtlasCol>
        <AtlasCol
          cols="12"
          sm="6"
        >
          <AtlasSelect
            v-model="form.comparatorId"
            label="Comparator"
            :items="comparatorItems"
            item-title="cohortName"
            item-value="cohortId"
            no-data-text="No Comparator cohorts assigned"
          />
        </AtlasCol>
        <AtlasCol cols="12">
          <AtlasSelect
            v-model="form.indicationId"
            label="Indication Cohort (optional)"
            :items="indicationItems"
            item-title="title"
            item-value="value"
          />
        </AtlasCol>
        <AtlasCol cols="12">
          <AtlasSelect
            v-model="form.genderConceptIds"
            label="Gender"
            :items="genderOptions"
            item-title="label"
            item-value="value"
            multiple
          />
        </AtlasCol>
        <AtlasCol
          cols="12"
          sm="6"
        >
          <AtlasTextField
            :model-value="form.minAge ?? ''"
            label="Min Age (optional)"
            type="number"
            @update:model-value="v => form.minAge = v === '' || v == null ? null : Number(v)"
          />
        </AtlasCol>
        <AtlasCol
          cols="12"
          sm="6"
        >
          <AtlasTextField
            :model-value="form.maxAge ?? ''"
            label="Max Age (optional)"
            type="number"
            @update:model-value="v => form.maxAge = v === '' || v == null ? null : Number(v)"
          />
        </AtlasCol>
        <AtlasCol cols="12">
          <AtlasTextField
            v-model="excludedConceptsStr"
            label="Excluded covariate concept IDs"
            hint="Comma-separated concept IDs (e.g., drug ingredients to exclude from PS model)"
          />
        </AtlasCol>
      </AtlasRow>
      <template #actions>
        <AtlasButton
          variant="ghost"
          @click="dialogOpen = false"
        >
          Cancel
        </AtlasButton>
        <AtlasButton
          :disabled="!form.targetId || !form.comparatorId"
          @click="saveComparison"
        >
          {{ editingIdx !== null ? 'Save' : 'Add' }}
        </AtlasButton>
      </template>
    </AtlasDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { AtlasDialog, AtlasButton, AtlasSelect, AtlasTextField, AtlasRow, AtlasCol } from '@ohdsi/atlas-ui';
import { useStrategusStore } from '../store/useStrategusStore';
import type { TciDefinition } from '../store/useStrategusStore';
import TciCard from '../components/TciCard.vue';

const props = defineProps<{ embedded?: boolean }>();
const store = useStrategusStore();

const MALE_CONCEPT_ID = 8507;
const FEMALE_CONCEPT_ID = 8532;

const genderOptions = [
  { label: 'Male', value: MALE_CONCEPT_ID },
  { label: 'Female', value: FEMALE_CONCEPT_ID },
];

const targetItems = computed(() => store.cohortsByRole('Target'));
const comparatorItems = computed(() => store.cohortsByRole('Comparator'));
const indicationItems = computed(() => [
  { title: 'None', value: null },
  ...store.cohortsByRole('Indication').map(c => ({ title: c.cohortName, value: c.cohortId })),
]);

const dialogOpen = ref(false);
const editingIdx = ref<number | null>(null);

const defaultForm = (): Omit<TciDefinition, 'excludedCovariateConceptIds'> & { excludedCovariateConceptIds: number[] } => ({
  targetId: 0,
  comparatorId: 0,
  indicationId: null,
  genderConceptIds: [MALE_CONCEPT_ID, FEMALE_CONCEPT_ID],
  minAge: null,
  maxAge: null,
  excludedCovariateConceptIds: [],
});

const form = ref(defaultForm());

const excludedConceptsStr = computed({
  get: () => form.value.excludedCovariateConceptIds.join(', '),
  set: (v: string) => {
    form.value.excludedCovariateConceptIds = v.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
  },
});

function openAddDialog() {
  form.value = defaultForm();
  editingIdx.value = null;
  dialogOpen.value = true;
}

function openEditDialog(idx: number) {
  const tci = store.comparisons[idx];
  form.value = { ...tci };
  editingIdx.value = idx;
  dialogOpen.value = true;
}

function saveComparison() {
  const tci: TciDefinition = {
    targetId: form.value.targetId,
    comparatorId: form.value.comparatorId,
    indicationId: form.value.indicationId,
    genderConceptIds: [...form.value.genderConceptIds],
    minAge: form.value.minAge ?? null,
    maxAge: form.value.maxAge ?? null,
    excludedCovariateConceptIds: [...form.value.excludedCovariateConceptIds],
  };

  if (editingIdx.value !== null) {
    store.comparisons.splice(editingIdx.value, 1, tci);
  } else {
    store.comparisons.push(tci);
  }

  dialogOpen.value = false;
}

function removeComparison(idx: number) {
  store.comparisons.splice(idx, 1);
}
</script>
