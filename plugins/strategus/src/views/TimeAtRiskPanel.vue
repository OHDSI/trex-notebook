<template>
  <div>
    <!-- Page header (standalone only) -->
    <template v-if="!props.embedded">
      <div class="text-overline text-medium-emphasis">
        Study Design
      </div>
      <div style="width: 28px; height: 2px; background: #eb6622; margin-bottom: 8px" />
      <div class="d-flex align-start justify-space-between mb-1">
        <div>
          <h1 class="text-h4 font-weight-light text-primary mb-1">
            Time-at-Risk
          </h1>
          <p class="text-body-2 text-medium-emphasis mb-3">
            Shared across all modules. Override per module in Advanced.
          </p>
        </div>
      </div>
    </template>

    <!-- Shared Windows card -->
    <AtlasCard
      variant="outlined"
      class="mb-3"
      padding="none"
    >
      <h3 class="card-title pa-3 pb-1 d-flex align-center justify-space-between text-subtitle-2 font-weight-medium">
        Shared Windows
      </h3>
      <AtlasDataTable
        :headers="tarHeaders"
        :items="store.timeAtRisk"
        density="compact"
      >
        <template #item.label="{ item }">
          <AtlasTextField
            v-model="item.label"
          />
        </template>
        <template #item.riskWindowStart="{ item }">
          <AtlasTextField
            v-model.number="item.riskWindowStart"
            type="number"
            style="max-width: 80px"
          />
        </template>
        <template #item.startAnchor="{ item }">
          <AtlasSelect
            v-model="item.startAnchor"
            :items="anchorOptions"
            style="min-width: 140px"
          />
        </template>
        <template #item.riskWindowEnd="{ item }">
          <AtlasTextField
            v-model.number="item.riskWindowEnd"
            type="number"
            style="max-width: 80px"
          />
        </template>
        <template #item.endAnchor="{ item }">
          <AtlasSelect
            v-model="item.endAnchor"
            :items="anchorOptions"
            style="min-width: 140px"
          />
        </template>
        <template #item.actions="{ index }">
          <AtlasIconButton
            icon="mdi-delete-outline"
            size="sm"
            variant="text"
            tone="danger"
            ariaLabel="Remove window"
            :disabled="store.timeAtRisk.length <= 1"
            @click="removeSharedWindow(index)"
          />
        </template>
      </AtlasDataTable>
      <div class="card-actions" style="display:flex; gap:8px; justify-content:flex-start; padding: 6px 12px">
        <AtlasButton
          prepend-icon="mdi-plus"
          variant="ghost"
          size="sm"
          @click="addSharedWindow"
        >
          Add Window
        </AtlasButton>
      </div>
    </AtlasCard>

    <!-- Advanced overrides -->
    <AdvancedSection>
      <!-- SCCS Override -->
      <AtlasCard
        variant="outlined"
        class="mb-3 mt-2"
        padding="none"
      >
        <h3 class="card-title text-subtitle-2 pa-3 pb-1 font-weight-medium">
          SCCS Override
        </h3>
        <div class="pa-3 pt-0">
          <p class="text-body-2 text-medium-emphasis mb-3">
            Avoid intent-to-treat time-at-risk windows for SCCS. On-treatment or similarly defined TARs are more appropriate.
          </p>
          <AtlasCheckbox
            v-model="sccsOverrideEnabled"
            label="Override shared time-at-risk for SCCS"
            class="mb-3"
            @update:model-value="onSccsOverrideToggle"
          />
          <template v-if="store.sccsTimeAtRiskOverride">
            <AtlasDataTable
              :headers="tarHeaders"
              :items="store.sccsTimeAtRiskOverride"
              density="compact"
            >
              <template #item.label="{ item }">
                <AtlasTextField
                  v-model="item.label"
                />
              </template>
              <template #item.riskWindowStart="{ item }">
                <AtlasTextField
                  v-model.number="item.riskWindowStart"
                  type="number"
                  style="max-width: 80px"
                />
              </template>
              <template #item.startAnchor="{ item }">
                <AtlasSelect
                  v-model="item.startAnchor"
                  :items="anchorOptions"
                  style="min-width: 140px"
                />
              </template>
              <template #item.riskWindowEnd="{ item }">
                <AtlasTextField
                  v-model.number="item.riskWindowEnd"
                  type="number"
                  style="max-width: 80px"
                />
              </template>
              <template #item.endAnchor="{ item }">
                <AtlasSelect
                  v-model="item.endAnchor"
                  :items="anchorOptions"
                  style="min-width: 140px"
                />
              </template>
              <template #item.actions="{ index }">
                <AtlasIconButton
                  icon="mdi-delete-outline"
                  size="sm"
                  variant="text"
                  tone="danger"
                  ariaLabel="Remove window"
                  :disabled="store.sccsTimeAtRiskOverride!.length <= 1"
                  @click="removeSccsWindow(index)"
                />
              </template>
            </AtlasDataTable>
            <div class="pa-2">
              <AtlasButton
                prepend-icon="mdi-plus"
                variant="ghost"
                size="sm"
                @click="addSccsWindow"
              >
                Add Window
              </AtlasButton>
            </div>
          </template>
        </div>
      </AtlasCard>

      <!-- PLP Override -->
      <AtlasCard
        variant="outlined"
        padding="none"
      >
        <h3 class="card-title text-subtitle-2 pa-3 pb-1 font-weight-medium">
          PLP Override
        </h3>
        <div class="pa-3 pt-0">
          <p class="text-body-2 text-medium-emphasis mb-3">
            Patient-Level Prediction typically requires fixed-time windows (e.g., 365 days from cohort start) rather than on-treatment definitions.
          </p>
          <AtlasDataTable
            :headers="tarHeaders"
            :items="store.plpTimeAtRiskOverride"
            density="compact"
          >
            <template #item.label="{ item }">
              <AtlasTextField
                v-model="item.label"
              />
            </template>
            <template #item.riskWindowStart="{ item }">
              <AtlasTextField
                v-model.number="item.riskWindowStart"
                type="number"
                style="max-width: 80px"
              />
            </template>
            <template #item.startAnchor="{ item }">
              <AtlasSelect
                v-model="item.startAnchor"
                :items="anchorOptions"
                style="min-width: 140px"
              />
            </template>
            <template #item.riskWindowEnd="{ item }">
              <AtlasTextField
                v-model.number="item.riskWindowEnd"
                type="number"
                style="max-width: 80px"
              />
            </template>
            <template #item.endAnchor="{ item }">
              <AtlasSelect
                v-model="item.endAnchor"
                :items="anchorOptions"
                style="min-width: 140px"
              />
            </template>
            <template #item.actions="{ index }">
              <AtlasIconButton
                icon="mdi-delete-outline"
                size="sm"
                variant="text"
                tone="danger"
                ariaLabel="Remove window"
                :disabled="store.plpTimeAtRiskOverride.length <= 1"
                @click="removePlpWindow(index)"
              />
            </template>
          </AtlasDataTable>
          <div class="pa-2">
            <AtlasButton
              prepend-icon="mdi-plus"
              variant="ghost"
              size="sm"
              @click="addPlpWindow"
            >
              Add Window
            </AtlasButton>
          </div>
        </div>
      </AtlasCard>
    </AdvancedSection>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { AtlasCard, AtlasDataTable, AtlasTextField, AtlasSelect, AtlasButton, AtlasIconButton, AtlasCheckbox } from '@ohdsi/atlas-ui';
import { useStrategusStore } from '../store/useStrategusStore';
import { createDefaultTimeAtRisk } from '../services/DefaultsFactory';
import AdvancedSection from '../components/AdvancedSection.vue';

const props = defineProps<{ embedded?: boolean }>();
const store = useStrategusStore();

const anchorOptions: Array<'cohort start' | 'cohort end'> = ['cohort start', 'cohort end'];

const tarHeaders = [
  { key: 'label', title: 'Label', sortable: false },
  { key: 'riskWindowStart', title: 'Start (days)', sortable: false },
  { key: 'startAnchor', title: 'Start Anchor', sortable: false },
  { key: 'riskWindowEnd', title: 'End (days)', sortable: false },
  { key: 'endAnchor', title: 'End Anchor', sortable: false },
  { key: 'actions', title: '', sortable: false },
];

const sccsOverrideEnabled = computed({
  get: () => store.sccsTimeAtRiskOverride !== null,
  set: (val: boolean) => {
    if (val) {
      store.sccsTimeAtRiskOverride = [createDefaultTimeAtRisk()];
    } else {
      store.sccsTimeAtRiskOverride = null;
    }
  },
});

function onSccsOverrideToggle(val: boolean) {
  sccsOverrideEnabled.value = val;
}

// Shared windows
function addSharedWindow() {
  store.timeAtRisk.push(createDefaultTimeAtRisk());
}

function removeSharedWindow(idx: number) {
  if (store.timeAtRisk.length > 1) {
    store.timeAtRisk.splice(idx, 1);
  }
}

// SCCS override windows
function addSccsWindow() {
  if (store.sccsTimeAtRiskOverride) {
    store.sccsTimeAtRiskOverride.push(createDefaultTimeAtRisk());
  }
}

function removeSccsWindow(idx: number) {
  if (store.sccsTimeAtRiskOverride && store.sccsTimeAtRiskOverride.length > 1) {
    store.sccsTimeAtRiskOverride.splice(idx, 1);
  }
}

// PLP override windows
function addPlpWindow() {
  store.plpTimeAtRiskOverride.push(createDefaultTimeAtRisk());
}

function removePlpWindow(idx: number) {
  if (store.plpTimeAtRiskOverride.length > 1) {
    store.plpTimeAtRiskOverride.splice(idx, 1);
  }
}
</script>

<style scoped>
:deep(.v-field__input) {
  padding-top: 4px;
  padding-bottom: 4px;
}
</style>
