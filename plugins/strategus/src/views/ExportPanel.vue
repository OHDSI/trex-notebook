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
        <AtlasButton
          variant="tonal"
          size="sm"
          prepend-icon="mdi-content-copy"
          @click="copyJson"
        >
          Copy JSON
        </AtlasButton>
        <AtlasButton
          variant="tonal"
          tone="primary"
          size="sm"
          prepend-icon="mdi-download"
          :disabled="!validation.canExport.value"
          @click="downloadJson"
        >
          Export JSON
        </AtlasButton>
        <AtlasButton
          variant="primary"
          tone="primary"
          size="sm"
          prepend-icon="mdi-play"
          data-test="run-analysis"
          :disabled="!validation.canExport.value"
          @click="showRun = true"
        >
          Run analysis
        </AtlasButton>
      </div>
    </div>

    <RunAnalysisDialog
      :open="showRun"
      :spec="spec"
      @close="showRun = false"
      @submitted="onSubmitted"
    />

    <!-- Validation card -->
    <AtlasCard
      variant="outlined"
      class="mb-4"
      padding="none"
    >
      <div class="card-title-row pa-4 pb-2">
        <AtlasIcon
          :color="allValid ? 'success' : 'warning'"
          class="mr-2"
        >
          {{ allValid ? 'mdi-check-circle' : 'mdi-alert-circle' }}
        </AtlasIcon>
        <span class="text-subtitle-1 font-weight-medium">Validation</span>
        <AtlasSpacer />
        <AtlasChip
          :tone="allValid ? 'success' : 'warning'"
          size="sm"
        >
          {{ allValid ? 'All checks passed' : 'Issues found' }}
        </AtlasChip>
      </div>

      <AtlasList class="pa-0">
        <AtlasDivider />
        <AtlasListItem
          v-for="check in validationChecks"
          :key="check.key"
        >
          <template #prepend>
            <AtlasIcon
              :color="check.result.status === 'valid' ? 'success' : check.result.status === 'error' ? 'error' : 'warning'"
              size="small"
              class="mr-1"
            >
              {{ check.result.status === 'valid' ? 'mdi-check-circle-outline' : 'mdi-alert-outline' }}
            </AtlasIcon>
          </template>
          <v-list-item-title class="text-body-2">
            {{ check.label }}
          </v-list-item-title>
          <v-list-item-subtitle class="text-caption">
            {{ check.result.message }}
          </v-list-item-subtitle>
        </AtlasListItem>
      </AtlasList>
    </AtlasCard>

    <!-- JSON Preview card -->
    <AtlasCard
      variant="outlined"
      padding="none"
    >
      <div class="card-title-row pa-4 pb-2">
        <AtlasIcon class="mr-2">
          mdi-code-json
        </AtlasIcon>
        <span class="text-subtitle-1 font-weight-medium">JSON Preview</span>
        <AtlasSpacer />
        <AtlasButton
          variant="ghost"
          size="sm"
          :prepend-icon="fullscreen ? 'mdi-fullscreen-exit' : 'mdi-fullscreen'"
          @click="fullscreen = !fullscreen"
        >
          {{ fullscreen ? 'Collapse' : 'Full screen' }}
        </AtlasButton>
      </div>
      <AtlasDivider />
      <div
        class="json-preview-wrapper"
        :style="{ maxHeight: fullscreen ? '80vh' : '300px' }"
      >
        <pre class="json-preview">{{ jsonPreview }}</pre>
      </div>
    </AtlasCard>

    <!-- Copy confirmation snackbar -->
    <AtlasSnackbar
      v-model="snackbar"
      :timeout="2000"
      severity="success"
      location="bottom"
      closable
    >
      <AtlasIcon class="mr-2">
        mdi-check
      </AtlasIcon>
      JSON copied to clipboard
    </AtlasSnackbar>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { AtlasButton, AtlasCard, AtlasDivider, AtlasIcon, AtlasSpacer, AtlasChip, AtlasList, AtlasListItem, AtlasSnackbar } from '@ohdsi/atlas-ui';
import { useStrategusStore } from '../store/useStrategusStore';
import { useValidation } from '../store/validation';
import { serializeSpec } from '../services/SpecSerializer';
import RunAnalysisDialog from '../components/RunAnalysisDialog.vue';

const store = useStrategusStore();
const validation = useValidation();

const fullscreen = ref(false);
const snackbar = ref(false);
const showRun = ref(false);

const spec = computed(() => serializeSpec(store));
const jsonPreview = computed(() => JSON.stringify(spec.value, null, 2));

function onSubmitted(jobId: string) {
  showRun.value = false;
  // Deep-link to the jobs plugin focused on this run.
  window.location.assign(`/plugins/jobs-plugin/?job=${encodeURIComponent(jobId)}`);
}

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

.card-title-row {
  display: flex;
  align-items: center;
}
</style>
