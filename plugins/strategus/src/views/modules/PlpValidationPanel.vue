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
      <AtlasCard
        flat
        rounded="lg"
        class="mb-4"
        padding="none"
      >
        <div class="card-title-row">
          <h3 class="card-title text-subtitle-1">
            Validation Designs
          </h3>
          <AtlasButton
            variant="tonal"
            size="sm"
            prepend-icon="mdi-plus"
            @click="openAddDialog"
          >
            Add Model
          </AtlasButton>
        </div>
        <AtlasDivider />
        <div class="card-body">
          <!-- Empty state -->
          <div
            v-if="store.plpValidationSettings.validationDesigns.length === 0"
            class="d-flex flex-column align-center justify-center py-8 text-center"
          >
            <AtlasIcon
              icon="mdi-flask-empty-outline"
              size="40"
              color="grey"
              class="mb-3"
            />
            <span class="text-body-2 text-medium-emphasis">No validation designs added yet.</span>
          </div>

          <!-- Designs list -->
          <AtlasList v-else>
            <AtlasListItem
              v-for="(design, index) in store.plpValidationSettings.validationDesigns"
              :key="index"
              :title="design.plpModelPath"
              :subtitle="`Target: ${design.targetId ?? '—'} · Outcome: ${design.outcomeId ?? '—'} · Recalibrate: ${design.recalibrate}`"
            >
              <template #append>
                <AtlasIconButton
                  icon="mdi-delete"
                  ariaLabel="Remove validation design"
                  tone="danger"
                  size="sm"
                  @click="removeDesign(index)"
                />
              </template>
            </AtlasListItem>
          </AtlasList>
        </div>
      </AtlasCard>
    </div>

    <!-- Add Model Dialog -->
    <AtlasDialog
      v-model="dialogOpen"
      eyebrow="MODEL"
      title="Add Validation Model"
      :max-width="480"
      @close="dialogOpen = false"
    >
      <!-- :rules preserved — required validation kept via :error binding -->
      <AtlasTextField
        v-model="form.plpModelPath"
        label="PLP model path"
        :error="plpModelPathError"
        class="mb-3"
      />
      <div class="d-flex ga-3 mb-3">
        <AtlasTextField
          :model-value="form.targetId ?? ''"
          label="Target ID"
          type="number"
          style="flex: 1"
          @update:model-value="v => form.targetId = v === '' || v == null ? null : Number(v)"
        />
        <AtlasTextField
          :model-value="form.outcomeId ?? ''"
          label="Outcome ID"
          type="number"
          style="flex: 1"
          @update:model-value="v => form.outcomeId = v === '' || v == null ? null : Number(v)"
        />
      </div>
      <AtlasSelect
        v-model="form.recalibrate"
        label="Recalibrate"
        :items="[
          { title: 'Weak Recalibration', value: 'weakRecalibration' },
          { title: 'None', value: 'none' },
        ]"
        class="mb-3"
      />
      <AtlasCheckbox
        v-model="form.runCovariateSummary"
        label="Run covariate summary"
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
import { ref, reactive, computed } from 'vue';
import { AtlasCard, AtlasDivider, AtlasButton, AtlasIconButton, AtlasIcon, AtlasList, AtlasListItem, AtlasTextField, AtlasSelect, AtlasCheckbox, AtlasDialog } from '@ohdsi/atlas-ui';
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

// Preserve the original :rules="[v => !!v || 'Required']" logic as an error string
const plpModelPathError = computed(() => (!form.plpModelPath ? 'Required' : ''));

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

.card-title {
  padding: 12px 16px 12px;
  margin: 0;
}

.card-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px 8px 0;
}

.card-body {
  padding: 16px;
}
</style>
