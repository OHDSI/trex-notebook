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
          <p class="text-body-2 text-medium-emphasis mb-4">
            Shared across all modules. Override per module in Advanced.
          </p>
        </div>
      </div>
    </template>

    <!-- Shared Windows card -->
    <v-card
      variant="outlined"
      class="mb-4"
    >
      <v-card-title class="pa-4 pb-2 d-flex align-center justify-space-between">
        <span class="text-subtitle-1 font-weight-medium">Shared Windows</span>
      </v-card-title>
      <v-table density="compact">
        <thead>
          <tr>
            <th>Label</th>
            <th>Start (days)</th>
            <th>Start Anchor</th>
            <th>End (days)</th>
            <th>End Anchor</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(tar, idx) in store.timeAtRisk"
            :key="idx"
          >
            <td>
              <v-text-field
                v-model="tar.label"
                variant="plain"
                density="compact"
                hide-details
              />
            </td>
            <td>
              <v-text-field
                v-model.number="tar.riskWindowStart"
                variant="plain"
                density="compact"
                type="number"
                hide-details
                style="max-width: 80px"
              />
            </td>
            <td>
              <v-select
                v-model="tar.startAnchor"
                :items="anchorOptions"
                variant="plain"
                density="compact"
                hide-details
                style="min-width: 140px"
              />
            </td>
            <td>
              <v-text-field
                v-model.number="tar.riskWindowEnd"
                variant="plain"
                density="compact"
                type="number"
                hide-details
                style="max-width: 80px"
              />
            </td>
            <td>
              <v-select
                v-model="tar.endAnchor"
                :items="anchorOptions"
                variant="plain"
                density="compact"
                hide-details
                style="min-width: 140px"
              />
            </td>
            <td>
              <v-btn
                icon="mdi-delete-outline"
                size="small"
                variant="text"
                color="error"
                :disabled="store.timeAtRisk.length <= 1"
                @click="removeSharedWindow(idx)"
              />
            </td>
          </tr>
        </tbody>
      </v-table>
      <v-card-actions class="pa-4 pt-2">
        <v-btn
          prepend-icon="mdi-plus"
          variant="text"
          size="small"
          @click="addSharedWindow"
        >
          Add Window
        </v-btn>
      </v-card-actions>
    </v-card>

    <!-- Advanced overrides -->
    <AdvancedSection>
      <!-- SCCS Override -->
      <v-card
        variant="outlined"
        class="mb-3 mt-2"
      >
        <v-card-title class="text-subtitle-1 pa-4 pb-2 font-weight-medium">
          SCCS Override
        </v-card-title>
        <v-card-text class="pa-4 pt-0">
          <p class="text-body-2 text-medium-emphasis mb-3">
            Avoid intent-to-treat time-at-risk windows for SCCS. On-treatment or similarly defined TARs are more appropriate.
          </p>
          <v-checkbox
            v-model="sccsOverrideEnabled"
            label="Override shared time-at-risk for SCCS"
            density="compact"
            hide-details
            class="mb-3"
            @update:model-value="onSccsOverrideToggle"
          />
          <template v-if="store.sccsTimeAtRiskOverride">
            <v-table density="compact">
              <thead>
                <tr>
                  <th>Label</th>
                  <th>Start (days)</th>
                  <th>Start Anchor</th>
                  <th>End (days)</th>
                  <th>End Anchor</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(tar, idx) in store.sccsTimeAtRiskOverride"
                  :key="idx"
                >
                  <td>
                    <v-text-field
                      v-model="tar.label"
                      variant="plain"
                      density="compact"
                      hide-details
                    />
                  </td>
                  <td>
                    <v-text-field
                      v-model.number="tar.riskWindowStart"
                      variant="plain"
                      density="compact"
                      type="number"
                      hide-details
                      style="max-width: 80px"
                    />
                  </td>
                  <td>
                    <v-select
                      v-model="tar.startAnchor"
                      :items="anchorOptions"
                      variant="plain"
                      density="compact"
                      hide-details
                      style="min-width: 140px"
                    />
                  </td>
                  <td>
                    <v-text-field
                      v-model.number="tar.riskWindowEnd"
                      variant="plain"
                      density="compact"
                      type="number"
                      hide-details
                      style="max-width: 80px"
                    />
                  </td>
                  <td>
                    <v-select
                      v-model="tar.endAnchor"
                      :items="anchorOptions"
                      variant="plain"
                      density="compact"
                      hide-details
                      style="min-width: 140px"
                    />
                  </td>
                  <td>
                    <v-btn
                      icon="mdi-delete-outline"
                      size="small"
                      variant="text"
                      color="error"
                      :disabled="store.sccsTimeAtRiskOverride!.length <= 1"
                      @click="removeSccsWindow(idx)"
                    />
                  </td>
                </tr>
              </tbody>
            </v-table>
            <div class="pa-2">
              <v-btn
                prepend-icon="mdi-plus"
                variant="text"
                size="small"
                @click="addSccsWindow"
              >
                Add Window
              </v-btn>
            </div>
          </template>
        </v-card-text>
      </v-card>

      <!-- PLP Override -->
      <v-card variant="outlined">
        <v-card-title class="text-subtitle-1 pa-4 pb-2 font-weight-medium">
          PLP Override
        </v-card-title>
        <v-card-text class="pa-4 pt-0">
          <p class="text-body-2 text-medium-emphasis mb-3">
            Patient-Level Prediction typically requires fixed-time windows (e.g., 365 days from cohort start) rather than on-treatment definitions.
          </p>
          <v-table density="compact">
            <thead>
              <tr>
                <th>Label</th>
                <th>Start (days)</th>
                <th>Start Anchor</th>
                <th>End (days)</th>
                <th>End Anchor</th>
                <th />
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(tar, idx) in store.plpTimeAtRiskOverride"
                :key="idx"
              >
                <td>
                  <v-text-field
                    v-model="tar.label"
                    variant="plain"
                    density="compact"
                    hide-details
                  />
                </td>
                <td>
                  <v-text-field
                    v-model.number="tar.riskWindowStart"
                    variant="plain"
                    density="compact"
                    type="number"
                    hide-details
                    style="max-width: 80px"
                  />
                </td>
                <td>
                  <v-select
                    v-model="tar.startAnchor"
                    :items="anchorOptions"
                    variant="plain"
                    density="compact"
                    hide-details
                    style="min-width: 140px"
                  />
                </td>
                <td>
                  <v-text-field
                    v-model.number="tar.riskWindowEnd"
                    variant="plain"
                    density="compact"
                    type="number"
                    hide-details
                    style="max-width: 80px"
                  />
                </td>
                <td>
                  <v-select
                    v-model="tar.endAnchor"
                    :items="anchorOptions"
                    variant="plain"
                    density="compact"
                    hide-details
                    style="min-width: 140px"
                  />
                </td>
                <td>
                  <v-btn
                    icon="mdi-delete-outline"
                    size="small"
                    variant="text"
                    color="error"
                    :disabled="store.plpTimeAtRiskOverride.length <= 1"
                    @click="removePlpWindow(idx)"
                  />
                </td>
              </tr>
            </tbody>
          </v-table>
          <div class="pa-2">
            <v-btn
              prepend-icon="mdi-plus"
              variant="text"
              size="small"
              @click="addPlpWindow"
            >
              Add Window
            </v-btn>
          </div>
        </v-card-text>
      </v-card>
    </AdvancedSection>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useStrategusStore } from '../store/useStrategusStore';
import { createDefaultTimeAtRisk } from '../services/DefaultsFactory';
import AdvancedSection from '../components/AdvancedSection.vue';

const props = defineProps<{ embedded?: boolean }>();
const store = useStrategusStore();

const anchorOptions: Array<'cohort start' | 'cohort end'> = ['cohort start', 'cohort end'];

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
