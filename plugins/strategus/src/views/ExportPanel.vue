<template>
  <div>
    <!-- Page header -->
    <div class="text-overline text-medium-emphasis">
      Export
    </div>
    <div style="width: 28px; height: 2px; background: #eb6622; margin-bottom: 8px" />
    <div class="d-flex align-start justify-space-between mb-4">
      <div>
        <h1 class="text-h4 font-weight-light text-primary mb-1">
          Review &amp; Export
        </h1>
        <p class="text-body-2 text-medium-emphasis">
          Validate your analysis specification and export it as JSON for Strategus execution.
        </p>
      </div>
      <div class="d-flex gap-2 mt-1">
        <v-btn
          variant="tonal"
          size="small"
          prepend-icon="mdi-content-copy"
          @click="copyJson"
        >
          Copy JSON
        </v-btn>
        <v-btn
          color="primary"
          variant="tonal"
          size="small"
          prepend-icon="mdi-download"
          :disabled="!validation.canExport.value"
          @click="downloadJson"
        >
          Export JSON
        </v-btn>
      </div>
    </div>

    <!-- Validation card -->
    <v-card
      variant="outlined"
      class="mb-4"
    >
      <v-card-title class="d-flex align-center pa-4 pb-2">
        <v-icon
          :color="allValid ? 'success' : 'warning'"
          class="mr-2"
        >
          {{ allValid ? 'mdi-check-circle' : 'mdi-alert-circle' }}
        </v-icon>
        <span class="text-subtitle-1 font-weight-medium">Validation</span>
        <v-spacer />
        <v-chip
          :color="allValid ? 'success' : 'warning'"
          size="small"
          variant="tonal"
        >
          {{ allValid ? 'All checks passed' : 'Issues found' }}
        </v-chip>
      </v-card-title>

      <v-list
        density="compact"
        class="pa-0"
      >
        <v-divider />
        <v-list-item
          v-for="check in validationChecks"
          :key="check.key"
        >
          <template #prepend>
            <v-icon
              :color="check.result.status === 'valid' ? 'success' : check.result.status === 'error' ? 'error' : 'warning'"
              size="small"
              class="mr-1"
            >
              {{ check.result.status === 'valid' ? 'mdi-check-circle-outline' : 'mdi-alert-outline' }}
            </v-icon>
          </template>
          <v-list-item-title class="text-body-2">
            {{ check.label }}
          </v-list-item-title>
          <v-list-item-subtitle class="text-caption">
            {{ check.result.message }}
          </v-list-item-subtitle>
        </v-list-item>
      </v-list>
    </v-card>

    <!-- JSON Preview card -->
    <v-card variant="outlined">
      <v-card-title class="d-flex align-center pa-4 pb-2">
        <v-icon class="mr-2">
          mdi-code-json
        </v-icon>
        <span class="text-subtitle-1 font-weight-medium">JSON Preview</span>
        <v-spacer />
        <v-btn
          variant="text"
          size="small"
          :prepend-icon="fullscreen ? 'mdi-fullscreen-exit' : 'mdi-fullscreen'"
          @click="fullscreen = !fullscreen"
        >
          {{ fullscreen ? 'Collapse' : 'Full screen' }}
        </v-btn>
      </v-card-title>
      <v-divider />
      <div
        class="json-preview-wrapper"
        :style="{ maxHeight: fullscreen ? '80vh' : '300px' }"
      >
        <pre class="json-preview">{{ jsonPreview }}</pre>
      </div>
    </v-card>

    <!-- Copy confirmation snackbar -->
    <v-snackbar
      v-model="snackbar"
      :timeout="2000"
      color="success"
      location="bottom right"
    >
      <v-icon class="mr-2">
        mdi-check
      </v-icon>
      JSON copied to clipboard
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useStrategusStore } from '../store/useStrategusStore';
import { useValidation } from '../store/validation';
import { serializeSpec } from '../services/SpecSerializer';

const store = useStrategusStore();
const validation = useValidation();

const fullscreen = ref(false);
const snackbar = ref(false);

const jsonPreview = computed(() => JSON.stringify(serializeSpec(store), null, 2));

const validationChecks = computed(() => [
  { key: 'setup', label: 'Study name', result: validation.statusFor('setup') },
  { key: 'cohorts', label: 'Cohort definitions', result: validation.statusFor('cohorts') },
  { key: 'comparisons', label: 'Comparisons', result: validation.statusFor('comparisons') },
  { key: 'outcomes', label: 'Outcomes', result: validation.statusFor('outcomes') },
  { key: 'tar', label: 'Time-at-risk', result: validation.statusFor('tar') },
]);

const allValid = computed(() => validation.canExport.value);

async function copyJson() {
  try {
    await navigator.clipboard.writeText(jsonPreview.value);
    snackbar.value = true;
  } catch {
    // Fallback: select a textarea
    const el = document.createElement('textarea');
    el.value = jsonPreview.value;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    snackbar.value = true;
  }
}

function downloadJson() {
  const blob = new Blob([jsonPreview.value], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'analysisSpecification.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
</script>

<style scoped>
.json-preview-wrapper {
  overflow-y: auto;
  transition: max-height 0.25s ease;
}

.json-preview {
  margin: 0;
  padding: 16px;
  background: #1e1e2e;
  color: #cdd6f4;
  font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: 12px;
  line-height: 1.6;
  overflow-x: auto;
  white-space: pre;
}
</style>
