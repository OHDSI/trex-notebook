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
      class="mb-4"
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
      <v-btn
        color="primary"
        variant="tonal"
        size="small"
        prepend-icon="mdi-plus"
        @click="openAddDialog"
      >
        Add Comparison
      </v-btn>
    </div>

    <!-- Add/Edit Dialog -->
    <v-dialog
      v-model="dialogOpen"
      max-width="520"
    >
      <v-card>
        <v-card-title class="text-h6 pa-4 pb-2">
          {{ editingIdx !== null ? 'Edit Comparison' : 'Add Comparison' }}
        </v-card-title>
        <v-card-text class="pa-4 pt-2">
          <v-row dense>
            <v-col
              cols="12"
              sm="6"
            >
              <v-select
                v-model="form.targetId"
                label="Target"
                :items="targetItems"
                item-title="cohortName"
                item-value="cohortId"
                variant="outlined"
                density="compact"
                no-data-text="No Target cohorts assigned"
              />
            </v-col>
            <v-col
              cols="12"
              sm="6"
            >
              <v-select
                v-model="form.comparatorId"
                label="Comparator"
                :items="comparatorItems"
                item-title="cohortName"
                item-value="cohortId"
                variant="outlined"
                density="compact"
                no-data-text="No Comparator cohorts assigned"
              />
            </v-col>
            <v-col cols="12">
              <v-select
                v-model="form.indicationId"
                label="Indication Cohort (optional)"
                :items="indicationItems"
                item-title="title"
                item-value="value"
                variant="outlined"
                density="compact"
              />
            </v-col>
            <v-col cols="12">
              <v-select
                v-model="form.genderConceptIds"
                label="Gender"
                :items="genderOptions"
                item-title="label"
                item-value="value"
                variant="outlined"
                density="compact"
                multiple
                chips
                closable-chips
              />
            </v-col>
            <v-col
              cols="12"
              sm="6"
            >
              <v-text-field
                v-model.number="form.minAge"
                label="Min Age (optional)"
                variant="outlined"
                density="compact"
                type="number"
                clearable
              />
            </v-col>
            <v-col
              cols="12"
              sm="6"
            >
              <v-text-field
                v-model.number="form.maxAge"
                label="Max Age (optional)"
                variant="outlined"
                density="compact"
                type="number"
                clearable
              />
            </v-col>
            <v-col cols="12">
              <v-text-field
                v-model="excludedConceptsStr"
                label="Excluded covariate concept IDs"
                hint="Comma-separated concept IDs (e.g., drug ingredients to exclude from PS model)"
                persistent-hint
                variant="outlined"
                density="compact"
              />
            </v-col>
          </v-row>
        </v-card-text>
        <v-card-actions class="pa-4 pt-0">
          <v-spacer />
          <v-btn
            variant="text"
            @click="dialogOpen = false"
          >
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            variant="tonal"
            :disabled="!form.targetId || !form.comparatorId"
            @click="saveComparison"
          >
            {{ editingIdx !== null ? 'Save' : 'Add' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
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
