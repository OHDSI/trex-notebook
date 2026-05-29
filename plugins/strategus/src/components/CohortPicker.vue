<template>
  <v-dialog
    :model-value="modelValue"
    max-width="700"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card rounded="lg">
      <v-card-title class="text-h6">
        Select Cohort from Atlas
      </v-card-title>
      <v-divider />
      <v-card-text>
        <v-text-field
          v-model="search"
          prepend-inner-icon="mdi-magnify"
          label="Search cohorts"
          variant="outlined"
          density="compact"
          rounded="md"
          hide-details
          class="mb-3"
        />

        <v-table
          v-if="cohorts.length > 0"
          density="comfortable"
          hover
          class="rounded-lg"
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
              style="cursor: pointer"
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
        </v-table>

        <div
          v-else-if="loading"
          class="text-center py-6"
        >
          <v-progress-circular
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
          <v-alert
            type="info"
            variant="tonal"
            density="compact"
            class="mb-3"
          >
            Could not load cohorts from Atlas. You can enter cohort details manually.
          </v-alert>
          <v-text-field
            v-model.number="manualId"
            label="Cohort ID"
            type="number"
            variant="outlined"
            density="compact"
            rounded="md"
            class="mb-3"
          />
          <v-text-field
            v-model="manualName"
            label="Cohort Name"
            variant="outlined"
            density="compact"
            rounded="md"
            class="mb-3"
          />
          <v-btn
            color="primary"
            variant="flat"
            class="text-none"
            rounded="lg"
            :disabled="!manualName"
            @click="selectManual"
          >
            Add
          </v-btn>
        </div>
      </v-card-text>
      <v-divider />
      <v-card-actions class="justify-end pa-4">
        <v-btn
          variant="text"
          class="text-none"
          @click="$emit('update:modelValue', false)"
        >
          Cancel
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

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
