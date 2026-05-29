<template>
  <div>
    <!-- Page header (standalone only) -->
    <template v-if="!props.embedded">
      <div class="text-overline text-medium-emphasis">
        Study
      </div>
      <div style="width: 28px; height: 2px; background: #eb6622; margin-bottom: 8px" />
      <h1 class="text-h4 font-weight-light text-primary mb-4">
        Study Setup
      </h1>
    </template>

    <v-card
      variant="outlined"
      class="mb-4"
    >
      <v-card-text class="pa-4">
        <v-row dense>
          <v-col cols="12">
            <v-text-field
              v-model="store.studyName"
              label="Study Name"
              variant="outlined"
              density="compact"
              :rules="[v => !!v || 'Study name is required']"
              required
            />
          </v-col>
          <v-col cols="12">
            <v-textarea
              v-model="store.description"
              label="Description"
              variant="outlined"
              density="compact"
              :rows="2"
              auto-grow
            />
          </v-col>
          <v-col
            cols="12"
            sm="6"
          >
            <v-text-field
              v-model="store.studyStartDate"
              label="Study Start Date"
              variant="outlined"
              density="compact"
              placeholder="YYYY-MM-DD"
              hint="Leave empty for all available data"
              persistent-hint
              clearable
            />
          </v-col>
          <v-col
            cols="12"
            sm="6"
          >
            <v-text-field
              v-model="store.studyEndDate"
              label="Study End Date"
              variant="outlined"
              density="compact"
              placeholder="YYYY-MM-DD"
              hint="Leave empty for all available data"
              persistent-hint
              clearable
            />
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { useStrategusStore } from '../store/useStrategusStore';

const props = defineProps<{ embedded?: boolean }>();
const store = useStrategusStore();
</script>
