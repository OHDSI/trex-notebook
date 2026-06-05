<template>
  <AtlasDialog
    :model-value="modelValue"
    eyebrow="COHORT"
    title="Select Cohort from Atlas"
    :max-width="700"
    @close="$emit('update:modelValue', false)"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <AtlasTextField
      v-model="search"
      prepend-icon="mdi-magnify"
      label="Search cohorts"
      class="mb-3"
    />

    <table
      v-if="cohorts.length > 0"
      class="cohort-table"
    >
      <thead>
        <tr>
          <th style="width:60px">
            ID
          </th>
          <th>Name</th>
          <th
            style="width:100px"
            class="text-right"
          >
            Subjects
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="cohort in filteredCohorts"
          :key="cohort.cohortId"
          class="cohort-table__row"
          @click="selectCohort(cohort)"
        >
          <td class="text-medium-emphasis">
            {{ cohort.cohortId }}
          </td>
          <td>{{ cohort.cohortName }}</td>
          <td class="text-right text-medium-emphasis">
            {{ cohort.subjectCount?.toLocaleString() ?? '—' }}
          </td>
        </tr>
      </tbody>
    </table>

    <div
      v-else-if="loading"
      class="text-center py-6"
    >
      <AtlasProgressCircular
        indeterminate
        color="primary"
        size="32"
      />
      <div class="text-body-2 text-medium-emphasis mt-2">
        Loading cohorts from Atlas...
      </div>
    </div>

    <!-- Manual entry fallback -->
    <div v-else>
      <AtlasAlert
        severity="info"
        variant="tonal"
        class="mb-3"
      >
        Could not load cohorts from Atlas. You can enter cohort details manually.
      </AtlasAlert>
      <AtlasTextField
        v-model.number="manualId"
        label="Cohort ID"
        type="number"
        class="mb-3"
      />
      <AtlasTextField
        v-model="manualName"
        label="Cohort Name"
        class="mb-3"
      />
      <AtlasButton
        variant="primary"
        :disabled="!manualName"
        @click="selectManual"
      >
        Add
      </AtlasButton>
    </div>

    <template #actions>
      <AtlasButton
        variant="ghost"
        @click="$emit('update:modelValue', false)"
      >
        Cancel
      </AtlasButton>
    </template>
  </AtlasDialog>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { AtlasDialog, AtlasButton, AtlasTextField, AtlasProgressCircular, AtlasAlert } from '@ohdsi/atlas-ui';

interface AtlasCohort {
  cohortId: number;
  cohortName: string;
  subjectCount: number | null;
  cohortDefinition: string;
}

const props = defineProps<{
  modelValue: boolean;
  messageBus?: { request: <TReq, TRes>(type: string, payload: TReq) => Promise<TRes> };
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  select: [cohort: AtlasCohort];
}>();

const search = ref('');
const loading = ref(false);
const cohorts = ref<AtlasCohort[]>([]);
const manualId = ref(1);
const manualName = ref('');

const filteredCohorts = computed(() => {
  if (!search.value) return cohorts.value;
  const q = search.value.toLowerCase();
  return cohorts.value.filter(
    (c) => c.cohortName.toLowerCase().includes(q) || String(c.cohortId).includes(q)
  );
});

onMounted(async () => {
  if (!props.messageBus) return;
  loading.value = true;
  try {
    const result = await props.messageBus.request<unknown, AtlasCohort[]>('data:request', { resource: 'cohorts' });
    if (Array.isArray(result)) {
      cohorts.value = result;
    }
  } catch {
    // Atlas doesn't support this message type yet — show manual fallback
  } finally {
    loading.value = false;
  }
});

function selectCohort(cohort: AtlasCohort) {
  emit('select', cohort);
  emit('update:modelValue', false);
}

function selectManual() {
  emit('select', {
    cohortId: manualId.value,
    cohortName: manualName.value,
    subjectCount: null,
    cohortDefinition: '{}',
  });
  emit('update:modelValue', false);
  manualId.value++;
  manualName.value = '';
}
</script>

<style scoped>
.cohort-table {
  width: 100%;
  border-collapse: collapse;
  border-radius: 8px;
  overflow: hidden;
}

.cohort-table th,
.cohort-table td {
  padding: 8px 12px;
  text-align: left;
  font-size: 13px;
}

.cohort-table thead tr {
  background: rgba(0, 0, 0, 0.04);
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

.cohort-table th {
  font-weight: 600;
  color: rgba(0, 0, 0, 0.7);
}

.cohort-table__row {
  cursor: pointer;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.cohort-table__row:hover {
  background: rgba(0, 0, 0, 0.04);
}

.text-right {
  text-align: right;
}
</style>
