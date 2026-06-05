<template>
  <div>
    <!-- Page header (standalone mode only) -->
    <template v-if="!props.embedded">
      <div class="text-overline text-medium-emphasis">
        Module
      </div>
      <div style="width: 28px; height: 2px; background: #eb6622; margin-bottom: 8px" />
      <h1 class="text-h4 font-weight-light text-primary mb-1">
        Prediction Validation
      </h1>
      <p class="text-body-2 text-medium-emphasis mb-4">
        Validate externally developed prediction models on local data
      </p>

      <ModuleEnableBanner
        v-if="!store.isModuleEnabled('PLPValidation')"
        @enable="store.toggleModule('PLPValidation')"
      />
    </template>

    <div :class="{ 'module-disabled': !props.embedded && !store.isModuleEnabled('PLPValidation') }">
      <!-- Validation Designs card -->
      <v-card
        flat
        rounded="lg"
        class="mb-4"
      >
        <v-card-title class="text-subtitle-1 d-flex align-center justify-space-between">
          Validation Designs
          <v-btn
            variant="tonal"
            size="small"
            prepend-icon="mdi-plus"
            @click="openAddDialog"
          >
            Add Model
          </v-btn>
        </v-card-title>
        <v-divider />
        <v-card-text>
          <!-- Empty state -->
          <div
            v-if="store.plpValidationSettings.validationDesigns.length === 0"
            class="d-flex flex-column align-center justify-center py-8 text-center"
          >
            <v-icon
              icon="mdi-flask-empty-outline"
              size="40"
              color="grey"
              class="mb-3"
            />
            <span class="text-body-2 text-medium-emphasis">No validation designs added yet.</span>
          </div>

          <!-- Designs list -->
          <v-list
            v-else
            density="compact"
          >
            <v-list-item
              v-for="(design, index) in store.plpValidationSettings.validationDesigns"
              :key="index"
              :title="design.plpModelPath"
              :subtitle="`Target: ${design.targetId ?? '—'} · Outcome: ${design.outcomeId ?? '—'} · Recalibrate: ${design.recalibrate}`"
            >
              <template #append>
                <v-btn
                  icon="mdi-delete"
                  variant="text"
                  size="small"
                  color="error"
                  @click="removeDesign(index)"
                />
              </template>
            </v-list-item>
          </v-list>
        </v-card-text>
      </v-card>
    </div>

    <!-- Add Model Dialog -->
    <AtlasDialog
      v-model="dialogOpen"
      eyebrow="MODEL"
      title="Add Validation Model"
      :max-width="480"
      @close="dialogOpen = false"
    >
      <v-text-field
        v-model="form.plpModelPath"
        label="PLP model path"
        variant="outlined"
        density="compact"
        rounded="md"
        hide-details="auto"
        :rules="[v => !!v || 'Required']"
        class="mb-3"
      />
      <div class="d-flex ga-3 mb-3">
        <v-text-field
          v-model.number="form.targetId"
          label="Target ID"
          variant="outlined"
          density="compact"
          rounded="md"
          hide-details
          type="number"
          clearable
          style="flex: 1"
        />
        <v-text-field
          v-model.number="form.outcomeId"
          label="Outcome ID"
          variant="outlined"
          density="compact"
          rounded="md"
          hide-details
          type="number"
          clearable
          style="flex: 1"
        />
      </div>
      <v-select
        v-model="form.recalibrate"
        label="Recalibrate"
        variant="outlined"
        density="compact"
        rounded="md"
        hide-details
        :items="[
          { title: 'Weak Recalibration', value: 'weakRecalibration' },
          { title: 'None', value: 'none' },
        ]"
        class="mb-3"
      />
      <v-checkbox
        v-model="form.runCovariateSummary"
        label="Run covariate summary"
        density="compact"
        hide-details
      />
      <template #actions>
        <AtlasButton
          variant="ghost"
          @click="dialogOpen = false"
        >
          Cancel
        </AtlasButton>
        <AtlasButton
          :disabled="!form.plpModelPath"
          @click="addDesign"
        >
          Add
        </AtlasButton>
      </template>
    </AtlasDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { AtlasDialog, AtlasButton } from '@ohdsi/atlas-ui';
import { useStrategusStore } from '../../store/useStrategusStore';
import ModuleEnableBanner from '../../components/ModuleEnableBanner.vue';

const props = defineProps<{ embedded?: boolean }>();

const store = useStrategusStore();

const dialogOpen = ref(false);

const defaultForm = () => ({
  plpModelPath: '',
  targetId: null as number | null,
  outcomeId: null as number | null,
  recalibrate: 'none' as 'weakRecalibration' | 'none',
  runCovariateSummary: true,
});

const form = reactive(defaultForm());

function openAddDialog() {
  Object.assign(form, defaultForm());
  dialogOpen.value = true;
}

function addDesign() {
  if (!form.plpModelPath) return;
  store.plpValidationSettings.validationDesigns.push({
    plpModelPath: form.plpModelPath,
    targetId: form.targetId,
    outcomeId: form.outcomeId,
    recalibrate: form.recalibrate,
    runCovariateSummary: form.runCovariateSummary,
  });
  dialogOpen.value = false;
}

function removeDesign(index: number) {
  store.plpValidationSettings.validationDesigns.splice(index, 1);
}
</script>

<style scoped>
.module-disabled {
  opacity: 0.5;
  pointer-events: none;
}
</style>
