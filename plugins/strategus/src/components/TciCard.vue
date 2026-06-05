<template>
  <AtlasCard
    variant="outlined"
    class="tci-card mb-3"
    padding="sm"
  >
    <div class="d-flex align-center justify-space-between">
      <!-- T vs C -->
      <div class="d-flex align-center gap-2 flex-wrap">
        <AtlasChip
          tone="primary"
          variant="tonal"
          size="sm"
        >
          {{ targetName }}
        </AtlasChip>
        <span class="text-caption text-medium-emphasis font-weight-bold">vs</span>
        <AtlasChip
          tone="neutral"
          variant="tonal"
          size="sm"
        >
          {{ comparatorName }}
        </AtlasChip>
      </div>
      <!-- Actions -->
      <div class="d-flex align-center">
        <AtlasIconButton
          icon="mdi-pencil-outline"
          ariaLabel="Edit"
          tone="neutral"
          size="sm"
          @click="$emit('edit')"
        />
        <AtlasIconButton
          icon="mdi-delete-outline"
          ariaLabel="Delete"
          tone="danger"
          size="sm"
          @click="$emit('delete')"
        />
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
  </AtlasCard>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { AtlasCard, AtlasChip, AtlasIconButton } from '@ohdsi/atlas-ui';
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
