<template>
  <v-card
    variant="outlined"
    class="tci-card mb-3"
  >
    <v-card-text class="pa-3">
      <div class="d-flex align-center justify-space-between">
        <!-- T vs C -->
        <div class="d-flex align-center gap-2 flex-wrap">
          <v-chip
            color="primary"
            variant="tonal"
            size="small"
            label
          >
            {{ targetName }}
          </v-chip>
          <span class="text-caption text-medium-emphasis font-weight-bold">vs</span>
          <v-chip
            color="secondary"
            variant="tonal"
            size="small"
            label
          >
            {{ comparatorName }}
          </v-chip>
        </div>
        <!-- Actions -->
        <div class="d-flex align-center">
          <v-btn
            icon
            size="x-small"
            variant="text"
            color="primary"
            @click="$emit('edit')"
          >
            <v-icon size="16">
              mdi-pencil-outline
            </v-icon>
          </v-btn>
          <v-btn
            icon
            size="x-small"
            variant="text"
            color="error"
            @click="$emit('delete')"
          >
            <v-icon size="16">
              mdi-delete-outline
            </v-icon>
          </v-btn>
        </div>
      </div>

      <!-- Detail row -->
      <div class="d-flex align-center flex-wrap gap-3 mt-2">
        <div class="detail-item">
          <span class="text-caption text-medium-emphasis">Indication:</span>
          <span class="text-caption ml-1">{{ indicationName }}</span>
        </div>
        <div class="detail-item">
          <span class="text-caption text-medium-emphasis">Gender:</span>
          <span class="text-caption ml-1">{{ genderLabel }}</span>
        </div>
        <div class="detail-item">
          <span class="text-caption text-medium-emphasis">Age:</span>
          <span class="text-caption ml-1">{{ ageLabel }}</span>
        </div>
        <div class="detail-item">
          <span class="text-caption text-medium-emphasis">Excluded concepts:</span>
          <span class="text-caption ml-1">{{ tci.excludedCovariateConceptIds.length }}</span>
        </div>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useStrategusStore } from '../store/useStrategusStore';
import type { TciDefinition } from '../store/useStrategusStore';

const props = defineProps<{ tci: TciDefinition }>();
defineEmits<{ edit: []; delete: [] }>();

const store = useStrategusStore();

const MALE_CONCEPT_ID = 8507;
const FEMALE_CONCEPT_ID = 8532;

const targetName = computed(() => {
  const c = store.cohorts.find(c => c.cohortId === props.tci.targetId);
  return c?.cohortName ?? `Cohort ${props.tci.targetId}`;
});

const comparatorName = computed(() => {
  const c = store.cohorts.find(c => c.cohortId === props.tci.comparatorId);
  return c?.cohortName ?? `Cohort ${props.tci.comparatorId}`;
});

const indicationName = computed(() => {
  if (props.tci.indicationId == null) return 'None';
  const c = store.cohorts.find(c => c.cohortId === props.tci.indicationId);
  return c?.cohortName ?? `Cohort ${props.tci.indicationId}`;
});

const genderLabel = computed(() => {
  const ids = props.tci.genderConceptIds;
  const hasMale = ids.includes(MALE_CONCEPT_ID);
  const hasFemale = ids.includes(FEMALE_CONCEPT_ID);
  if (hasMale && hasFemale) return 'M+F';
  if (hasMale) return 'M';
  if (hasFemale) return 'F';
  return 'All';
});

const ageLabel = computed(() => {
  const { minAge, maxAge } = props.tci;
  if (minAge == null && maxAge == null) return 'Any';
  if (minAge != null && maxAge != null) return `${minAge}–${maxAge}`;
  if (minAge != null) return `≥${minAge}`;
  return `≤${maxAge}`;
});
</script>

<style scoped>
.tci-card {
  border-radius: 6px;
}

.detail-item {
  display: flex;
  align-items: center;
}

.gap-2 {
  gap: 8px;
}

.gap-3 {
  gap: 12px;
}
</style>
