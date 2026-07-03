<template>
  <div class="sidebar-actions">
    <div class="sidebar-actions__row">
      <AtlasButton size="sm" :loading="saving" @click="onSave">Save</AtlasButton>
      <AtlasButton size="sm" variant="ghost" :disabled="!validation.canExport.value" @click="runOpen = true">Run</AtlasButton>
      <AtlasButton v-if="networkActive" size="sm" variant="ghost" @click="submitOpen = true">Submit</AtlasButton>
    </div>
    <div class="sidebar-actions__row">
      <AtlasButton size="sm" variant="ghost" tone="danger" :disabled="!studies.currentRowId" @click="confirmOpen = true">Delete</AtlasButton>
      <span class="sidebar-actions__state" :class="{ 'is-error': stateError }">{{ stateText }}</span>
    </div>
    <RunAnalysisDialog :open="runOpen" :spec="spec" @close="runOpen = false" @submitted="onRun" />
    <SubmitToNetworkDialog :open="submitOpen" @close="submitOpen = false" @submitted="onNetworkSubmitted" />
    <AtlasSnackbar v-model="snack" :timeout="3000" :text="snackText" severity="success" location="bottom" />
    <AtlasDialog :model-value="confirmOpen" eyebrow="DELETE" title="Delete study" :max-width="420"
      @close="confirmOpen=false" @update:model-value="(v:boolean)=>{ if(!v) confirmOpen=false }">
      <p class="text-body-2">Delete this study? It is soft-deleted on the server and can be restored by an admin.</p>
      <template #actions>
        <AtlasButton variant="ghost" @click="confirmOpen=false">Cancel</AtlasButton>
        <AtlasButton tone="danger" :loading="deleting" @click="onDelete">Delete</AtlasButton>
      </template>
    </AtlasDialog>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { AtlasButton, AtlasDialog, AtlasSnackbar } from '@ohdsi/atlas-ui';
import RunAnalysisDialog from './RunAnalysisDialog.vue';
import SubmitToNetworkDialog from './SubmitToNetworkDialog.vue';
import { useStrategusStore } from '../store/useStrategusStore';
import { useStudiesStore } from '../store/useStudiesStore';
import { useValidation } from '../store/validation';
import { serializeSpec } from '../services/SpecSerializer';
import { isNetworkActive } from '../api/networkClient';

const store = useStrategusStore();
const studies = useStudiesStore();
const validation = useValidation();
const spec = computed(() => serializeSpec(store as unknown as Parameters<typeof serializeSpec>[0]));
const saving = ref(false), deleting = ref(false), stateError = ref(false);
const snack = ref(false), snackText = ref('');
const runOpen = ref(false), submitOpen = ref(false), confirmOpen = ref(false);
// Submit is only shown once a network is configured and this site is an
// active member; the probe fails closed (false) so an unconfigured/local
// deployment never shows an action that would just error.
const networkActive = ref(false);
onMounted(async () => {
  networkActive.value = await isNetworkActive();
});

// The persisted state is derived from the store's currentRowId so it agrees with the
// sidebar header badge and is correct on open without needing a Save click. A transient
// message (save timestamp, or an error) overrides it after an explicit action.
const savedState = computed(() => (studies.currentRowId ? 'Saved' : 'Unsaved'));
const transient = ref<string | null>(null);
const stateText = computed(() => transient.value ?? savedState.value);

async function onSave() {
  saving.value = true; stateError.value = false; transient.value = null;
  try { await studies.saveCurrent(); transient.value = 'Saved · ' + new Date().toLocaleTimeString(); }
  catch (e) { stateError.value = true; transient.value = e instanceof Error ? e.message : String(e); }
  finally { saving.value = false; }
}
async function onDelete() {
  deleting.value = true; stateError.value = false;
  try { await studies.deleteCurrent(); confirmOpen.value = false; }
  catch (e) { stateError.value = true; transient.value = e instanceof Error ? e.message : String(e); }
  finally { deleting.value = false; }
}
function onRun() { runOpen.value = false; snackText.value = 'Run started — track in Jobs'; snack.value = true; }
function onNetworkSubmitted() {
  submitOpen.value = false;
  snackText.value = 'Submitted to network';
  snack.value = true;
}
</script>
<style scoped>
.sidebar-actions { padding: 8px 10px; border-top: 1px solid rgba(0,0,0,.06); display:flex; flex-direction:column; gap:6px; }
.sidebar-actions__row { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
.sidebar-actions__state { font-size:11px; color: rgba(0,0,0,.5); }
.sidebar-actions__state.is-error { color:#c62828; }
</style>
