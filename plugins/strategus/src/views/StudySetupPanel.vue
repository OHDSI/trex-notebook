<template>
  <div>
    <!-- Page header (standalone only) -->
    <template v-if="!props.embedded">
      <div class="text-overline text-medium-emphasis">
        Study
      </div>
      <div style="width: 28px; height: 2px; background: #eb6622; margin-bottom: 8px" />
      <h1 class="text-h4 font-weight-light text-primary mb-3">
        Study Setup
      </h1>
    </template>

    <AtlasCard
      padding="sm"
      class="mb-3"
    >
      <AtlasRow dense>
        <AtlasCol cols="12">
          <AtlasTextField
            v-model="store.studyName"
            label="Study Name"
            :error="studyNameError"
            required
          />
        </AtlasCol>
        <AtlasCol cols="12">
          <AtlasTextField
            v-model="store.description"
            label="Description"
            multiline
            :rows="2"
          />
        </AtlasCol>
        <AtlasCol
          cols="12"
          sm="6"
        >
          <AtlasTextField
            :model-value="store.studyStartDate ?? ''"
            label="Study Start Date"
            placeholder="YYYY-MM-DD"
            hint="Leave empty for all available data"
            @update:model-value="store.studyStartDate = ($event as string) || null"
          />
        </AtlasCol>
        <AtlasCol
          cols="12"
          sm="6"
        >
          <AtlasTextField
            :model-value="store.studyEndDate ?? ''"
            label="Study End Date"
            placeholder="YYYY-MM-DD"
            hint="Leave empty for all available data"
            @update:model-value="store.studyEndDate = ($event as string) || null"
          />
        </AtlasCol>
      </AtlasRow>
    </AtlasCard>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { AtlasCard, AtlasTextField, AtlasRow, AtlasCol } from '@ohdsi/atlas-ui';
import { useStrategusStore } from '../store/useStrategusStore';

const props = defineProps<{ embedded?: boolean }>();
const store = useStrategusStore();

// Preserve :rules validation: study name is required
const studyNameError = computed(() => (store.studyName ? undefined : 'Study name is required'));
</script>
